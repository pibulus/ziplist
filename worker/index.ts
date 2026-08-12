/**
 * ZipList live rooms — Cloudflare Worker + Durable Object.
 *
 * This is a port of party/listRoom.ts off PartyKit and onto Pablo's own
 * Cloudflare account. PartyKit's last release (Sept 2025) predates Cloudflare
 * requiring `new_sqlite_classes` for free-plan Durable Objects, so its deploy
 * pipeline can no longer ship — existing rooms run, but no worker change can
 * ever be published again. The logic here is unchanged; only the runtime
 * plumbing moved.
 *
 * Deliberately serves the SAME url shape PartyKit used —
 * /parties/main/<roomId> — so `partysocket`, the create endpoint and the whole
 * message protocol carry over untouched. The only thing that changes anywhere
 * else in the app is which host VITE_PARTYKIT_HOST points at.
 *
 * Storage: Durable Object storage exposes the same get/put/delete KV API
 * PartyKit's room.storage did, so every persistence line below is a copy.
 *
 * Connections: uses the WebSocket Hibernation API, so an idle room costs
 * nothing and survives eviction. Per-connection state (id, avatar, joinedAt)
 * lives in the socket's attachment rather than in memory, which is what makes
 * hibernation safe.
 */

import {
  createLiveRoomMetadata,
  isLiveRoomExpired,
  LIVE_CLOSE_CODES,
  LIVE_MESSAGE_TYPES,
  normalizeLiveMessage,
  sanitizeAvatar,
  sanitizeLiveListData,
  sanitizeLivePassword,
  touchLiveRoomMetadata,
} from "../src/lib/services/realtime/liveListProtocol.js";

export interface Env {
  LIST_ROOM: DurableObjectNamespace;
  PARTYKIT_CREATE_SECRET?: string;
}

export interface LiveListItem {
  id: string;
  text: string;
  checked: boolean;
  order?: number;
  completedAt?: string;
}

export interface ListData {
  id: string;
  name: string;
  color?: string;
  primaryColor?: string;
  accentColor?: string;
  glowColor?: string;
  items: LiveListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PresenceUser {
  id: string;
  avatar: string;
  joinedAt: number;
}

export interface LiveRoomMetadata {
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
  expiresAt: string;
  tier: "free" | "supporter";
  alias?: string;
}

type ConnectionState = {
  id: string;
  avatar: string;
  joinedAt: number;
};

// SHA-256 hash of the room password, hex-encoded. Salting is intentionally
// skipped: the goal is at-rest opacity, not defending offline cracking of a
// value the user already shares in a link.
async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time-ish comparison so a shared secret can't be probed byte by
// byte via response timing.
function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export class ListRoom {
  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleUpgrade(request, url);
    }

    if (request.method === "POST") {
      return this.handleCreate(request, url);
    }

    if (request.method === "GET") {
      if (!(await this.isPasswordAllowed(url))) {
        return json({ error: "Forbidden" }, 403);
      }

      const roomState = await this.getRoomState();
      if (!roomState.listData) {
        return json({ error: "Live list not found" }, 404);
      }

      if (roomState.expired) {
        return json(
          { code: "room_expired", error: "This live room has popped." },
          410,
        );
      }

      return json(roomState.listData);
    }

    return new Response("Method not allowed", { status: 405 });
  }

  // ── Connections ──────────────────────────────────────────────────────

  private async handleUpgrade(request: Request, url: URL): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);

    // Rejections accept the socket first and then close with a code, rather
    // than returning an HTTP error. The client distinguishes "room not found"
    // from "expired" by close code, and a failed upgrade carries neither.
    const reject = (code: number, reason: string) => {
      server.close(code, reason);
      return new Response(null, { status: 101, webSocket: client });
    };

    if (!(await this.isPasswordAllowed(url))) {
      return reject(1008, "Wrong password");
    }

    const roomState = await this.getRoomState();
    if (!roomState.listData) {
      return reject(LIVE_CLOSE_CODES.ROOM_NOT_FOUND, "Live list not found");
    }
    if (roomState.expired) {
      return reject(LIVE_CLOSE_CODES.ROOM_EXPIRED, "Live list expired");
    }

    const metadata = await this.touchRoomMetadata(roomState.metadata);

    server.serializeAttachment({
      id: crypto.randomUUID(),
      avatar: sanitizeAvatar(url.searchParams.get("avatar")),
      joinedAt: Date.now(),
    } satisfies ConnectionState);

    server.send(
      JSON.stringify({
        type: LIVE_MESSAGE_TYPES.INIT,
        data: roomState.listData,
        meta: metadata,
      }),
    );

    this.broadcastPresence();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;

    const roomState = await this.getRoomState();
    if (!roomState.listData) {
      ws.close(LIVE_CLOSE_CODES.ROOM_NOT_FOUND, "Live list not found");
      return;
    }
    if (roomState.expired) {
      ws.close(LIVE_CLOSE_CODES.ROOM_EXPIRED, "Live list expired");
      return;
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }

    const normalized = normalizeLiveMessage(parsed);
    if (!normalized) return;

    if (normalized.type === LIVE_MESSAGE_TYPES.LIST_UPDATE) {
      await this.saveListData(normalized.data as ListData);
      await this.touchRoomMetadata(roomState.metadata);
    }

    const sender = this.getPresenceUser(ws);
    this.broadcast(
      JSON.stringify({ ...normalized, sender }),
      sender?.id ?? null,
    );
  }

  webSocketClose(ws: WebSocket) {
    // The closing socket is still in getWebSockets() at this point, so it has
    // to be excluded explicitly or it lingers in the roster it just left.
    this.broadcastPresence(this.getPresenceUser(ws)?.id ?? null);
  }

  webSocketError(ws: WebSocket) {
    this.broadcastPresence(this.getPresenceUser(ws)?.id ?? null);
  }

  private broadcast(payload: string, excludeId: string | null = null) {
    for (const socket of this.ctx.getWebSockets()) {
      if (excludeId && this.getPresenceUser(socket)?.id === excludeId) continue;
      try {
        socket.send(payload);
      } catch {
        // A socket that died between roster and send isn't worth a throw —
        // its close handler will tidy the presence list.
      }
    }
  }

  private getPresenceUser(ws: WebSocket): PresenceUser | null {
    const state = ws.deserializeAttachment() as ConnectionState | null;
    if (!state?.id) return null;
    return {
      id: state.id,
      avatar: sanitizeAvatar(state.avatar),
      joinedAt: state.joinedAt || Date.now(),
    };
  }

  private getPresence(excludeId: string | null = null): PresenceUser[] {
    const users: PresenceUser[] = [];
    for (const socket of this.ctx.getWebSockets()) {
      const user = this.getPresenceUser(socket);
      if (user && user.id !== excludeId) users.push(user);
    }
    return users;
  }

  private broadcastPresence(excludeId: string | null = null) {
    this.broadcast(
      JSON.stringify({
        type: LIVE_MESSAGE_TYPES.PRESENCE,
        data: this.getPresence(excludeId),
      }),
    );
  }

  // ── Room creation ────────────────────────────────────────────────────

  private async handleCreate(request: Request, url: URL): Promise<Response> {
    const authResponse = this.authorizeCreateRequest(request, url);
    if (authResponse) return authResponse;

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON." }, 400);
    }

    const createPayload = this.getCreatePayload(payload);
    const data = sanitizeLiveListData(
      createPayload.listData,
    ) as ListData | null;
    if (!data) {
      return json({ error: "Invalid list data." }, 400);
    }

    await this.saveListData(data);
    const metadata = createLiveRoomMetadata(
      createPayload.metadata,
    ) as LiveRoomMetadata;
    await this.saveRoomMetadata(metadata);

    const password = sanitizeLivePassword(url.searchParams.get("pwd"));
    if (password) {
      // Store only a hash so a storage compromise never reveals the
      // shareable-link password. The plaintext still travels in the link
      // itself (that's how collaborators join), so this is at-rest only.
      await this.ctx.storage.put("passwordHash", await hashPassword(password));
    }

    return json({
      roomId: decodeURIComponent(url.pathname.split("/").pop() || ""),
      listId: data.id,
      tier: metadata.tier,
      expiresAt: metadata.expiresAt,
    });
  }

  private authorizeCreateRequest(request: Request, url: URL) {
    const createSecret = String(this.env.PARTYKIT_CREATE_SECRET || "");
    const authHeader = request.headers.get("authorization") || "";

    if (!createSecret && !this.isLocalRequest(url)) {
      return json({ error: "Room creation secret is not configured." }, 503);
    }

    if (
      createSecret &&
      !timingSafeStringEqual(authHeader, `Bearer ${createSecret}`)
    ) {
      return json({ error: "Forbidden" }, 403);
    }

    return null;
  }

  private isLocalRequest(url: URL) {
    const hostname = url.hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    );
  }

  private getCreatePayload(payload: unknown) {
    if (this.isRecord(payload) && "listData" in payload) {
      return {
        listData: payload.listData,
        metadata: this.isRecord(payload.metadata) ? payload.metadata : {},
      };
    }
    return { listData: payload, metadata: {} };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  // ── Storage ──────────────────────────────────────────────────────────

  private async isPasswordAllowed(url: URL) {
    const storedHash = await this.ctx.storage.get<string>("passwordHash");

    // Legacy rooms created before hashing stored plaintext under "password".
    // Honor them, then transparently upgrade to a hash on first match.
    if (!storedHash) {
      const legacy = await this.ctx.storage.get<string>("password");
      if (!legacy) return true;
      const supplied = sanitizeLivePassword(url.searchParams.get("pwd"));
      if (supplied && timingSafeStringEqual(legacy, supplied)) {
        await this.ctx.storage.put("passwordHash", await hashPassword(legacy));
        await this.ctx.storage.delete("password");
        return true;
      }
      return false;
    }

    const supplied = sanitizeLivePassword(url.searchParams.get("pwd"));
    if (!supplied) return false;
    return timingSafeStringEqual(storedHash, await hashPassword(supplied));
  }

  private async getListData(): Promise<ListData | null> {
    return (await this.ctx.storage.get<ListData>("listData")) || null;
  }

  private async getRoomMetadata(
    listData: ListData | null = null,
  ): Promise<LiveRoomMetadata> {
    const storedMetadata =
      (await this.ctx.storage.get<LiveRoomMetadata>("roomMetadata")) || null;

    const metadata = createLiveRoomMetadata(
      storedMetadata || {
        tier: "supporter",
        createdAt: listData?.createdAt,
        updatedAt: listData?.updatedAt,
        lastActiveAt: listData?.updatedAt || listData?.createdAt,
      },
    ) as LiveRoomMetadata;

    if (!storedMetadata && listData) {
      await this.saveRoomMetadata(metadata);
    }

    return metadata;
  }

  private async getRoomState() {
    const listData = await this.getListData();
    if (!listData) {
      return { listData: null, metadata: null, expired: false };
    }

    const metadata = await this.getRoomMetadata(listData);
    return { listData, metadata, expired: isLiveRoomExpired(metadata) };
  }

  private async saveRoomMetadata(metadata: LiveRoomMetadata) {
    await this.ctx.storage.put("roomMetadata", metadata);
  }

  private async touchRoomMetadata(metadata: LiveRoomMetadata | null) {
    const next = touchLiveRoomMetadata(metadata || {}) as LiveRoomMetadata;
    await this.saveRoomMetadata(next);
    return next;
  }

  private async saveListData(data: ListData) {
    const sanitized = sanitizeLiveListData({
      ...data,
      updatedAt: new Date().toISOString(),
    }) as ListData | null;

    if (!sanitized) {
      throw new Error("Cannot store invalid live list data.");
    }

    await this.ctx.storage.put("listData", sanitized);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // The exact path shape PartyKit served, kept on purpose so nothing on the
    // client had to learn a new one: /parties/<party>/<roomId>
    const match = url.pathname.match(/^\/parties\/[^/]+\/([^/]+)\/?$/);
    if (!match) {
      return new Response("Not found", { status: 404 });
    }

    const roomId = decodeURIComponent(match[1]);
    const id = env.LIST_ROOM.idFromName(roomId);
    return env.LIST_ROOM.get(id).fetch(request);
  },
};
