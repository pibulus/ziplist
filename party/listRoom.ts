/**
 * PartyKit room for ZipList live sharing.
 *
 * The room stores one validated list snapshot and broadcasts snapshot updates.
 * Presence is derived from active connections so stale users do not become
 * durable data.
 */

import type * as Party from "partykit/server";
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

// SHA-256 hash of the room password, hex-encoded. Uses the Web Crypto API
// available in the PartyKit (workerd) runtime. Salting is intentionally
// skipped: the goal is at-rest opacity, not defending offline cracking of a
// value the user already shares in a link.
async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time-ish string comparison to avoid leaking match position via
// early exit. Both inputs here are fixed-length hex hashes in the common path.
function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
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
  avatar: string;
  joinedAt: number;
};

type Message = {
  type: string;
  data?: unknown;
  sender?: PresenceUser;
};

export default class ListRoom implements Party.Server {
  constructor(readonly room: Party.Room) {}

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);

    if (!(await this.isPasswordAllowed(url))) {
      conn.close(1008, "Wrong password");
      return;
    }

    const roomState = await this.getRoomState();
    if (!roomState.listData) {
      conn.close(LIVE_CLOSE_CODES.ROOM_NOT_FOUND, "Live list not found");
      return;
    }

    if (roomState.expired) {
      conn.close(LIVE_CLOSE_CODES.ROOM_EXPIRED, "Live list expired");
      return;
    }

    const metadata = await this.touchRoomMetadata(roomState.metadata);
    const avatar = sanitizeAvatar(url.searchParams.get("avatar"));
    conn.setState({
      avatar,
      joinedAt: Date.now(),
    } satisfies ConnectionState);

    conn.send(
      JSON.stringify({
        type: LIVE_MESSAGE_TYPES.INIT,
        data: roomState.listData,
        meta: metadata,
      }),
    );

    this.broadcastPresence();
  }

  onClose(conn: Party.Connection) {
    this.broadcastPresence(conn.id);
  }

  async onMessage(message: string, sender: Party.Connection) {
    const roomState = await this.getRoomState();
    if (!roomState.listData) {
      sender.close(LIVE_CLOSE_CODES.ROOM_NOT_FOUND, "Live list not found");
      return;
    }

    if (roomState.expired) {
      sender.close(LIVE_CLOSE_CODES.ROOM_EXPIRED, "Live list expired");
      return;
    }

    const parsedMessage = this.parseMessage(message);
    const normalizedMessage = normalizeLiveMessage(parsedMessage);
    if (!normalizedMessage) return;

    if (normalizedMessage.type === LIVE_MESSAGE_TYPES.LIST_UPDATE) {
      await this.saveListData(normalizedMessage.data as ListData);
      await this.touchRoomMetadata(roomState.metadata);
    }

    this.room.broadcast(
      JSON.stringify({
        ...normalizedMessage,
        sender: this.getPresenceUser(sender),
      } satisfies Message),
      [sender.id],
    );
  }

  async onRequest(req: Party.Request) {
    if (req.method === "POST") {
      const authResponse = this.authorizeCreateRequest(req);
      if (authResponse) return authResponse;

      let payload: unknown;
      try {
        payload = await req.json();
      } catch {
        return this.json({ error: "Invalid JSON." }, 400);
      }

      const createPayload = this.getCreatePayload(payload);
      const data = sanitizeLiveListData(
        createPayload.listData,
      ) as ListData | null;
      if (!data) {
        return this.json({ error: "Invalid list data." }, 400);
      }

      await this.saveListData(data);
      const metadata = createLiveRoomMetadata(createPayload.metadata);
      await this.saveRoomMetadata(metadata);

      const url = new URL(req.url);
      const password = sanitizeLivePassword(url.searchParams.get("pwd"));
      if (password) {
        // Store only a hash so a storage/infra compromise never reveals the
        // shareable-link password. The plaintext still travels in the link
        // itself (that's how collaborators join), so this is at-rest only.
        await this.room.storage.put(
          "passwordHash",
          await hashPassword(password),
        );
      }

      return this.json({
        roomId: this.room.id,
        listId: data.id,
        tier: metadata.tier,
        expiresAt: metadata.expiresAt,
      });
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      if (!(await this.isPasswordAllowed(url))) {
        return this.json({ error: "Forbidden" }, 403);
      }

      const roomState = await this.getRoomState();
      if (!roomState.listData) {
        return this.json({ error: "Live list not found" }, 404);
      }

      if (roomState.expired) {
        return this.json(
          { code: "room_expired", error: "This live room has popped." },
          410,
        );
      }

      return this.json(roomState.listData);
    }

    return new Response("Method not allowed", { status: 405 });
  }

  private parseMessage(message: string): unknown {
    try {
      return JSON.parse(message);
    } catch {
      return null;
    }
  }

  private getCreatePayload(payload: unknown) {
    if (this.isRecord(payload) && "listData" in payload) {
      return {
        listData: payload.listData,
        metadata: this.isRecord(payload.metadata) ? payload.metadata : {},
      };
    }

    return {
      listData: payload,
      metadata: {},
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  private authorizeCreateRequest(req: Party.Request) {
    const createSecret = String(this.room.env?.PARTYKIT_CREATE_SECRET || "");
    const authHeader = req.headers.get("authorization") || "";

    if (!createSecret && !this.isLocalRequest(req)) {
      return this.json(
        { error: "PartyKit room creation secret is not configured." },
        503,
      );
    }

    // Timing-safe compare so the shared create secret can't be probed
    // byte-by-byte via response timing.
    if (
      createSecret &&
      !timingSafeStringEqual(authHeader, `Bearer ${createSecret}`)
    ) {
      return this.json({ error: "Forbidden" }, 403);
    }

    return null;
  }

  private isLocalRequest(req: Party.Request) {
    const hostname = new URL(req.url).hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    );
  }

  private async isPasswordAllowed(url: URL) {
    const storedHash = await this.room.storage.get<string>("passwordHash");

    // Legacy rooms created before hashing stored plaintext under "password".
    // Honor them, then transparently upgrade to a hash on first match.
    if (!storedHash) {
      const legacy = await this.room.storage.get<string>("password");
      if (!legacy) return true;
      const supplied = sanitizeLivePassword(url.searchParams.get("pwd"));
      if (supplied && timingSafeStringEqual(legacy, supplied)) {
        await this.room.storage.put("passwordHash", await hashPassword(legacy));
        await this.room.storage.delete("password");
        return true;
      }
      return false;
    }

    const supplied = sanitizeLivePassword(url.searchParams.get("pwd"));
    if (!supplied) return false;
    return timingSafeStringEqual(storedHash, await hashPassword(supplied));
  }

  private async getListData(): Promise<ListData | null> {
    return (await this.room.storage.get<ListData>("listData")) || null;
  }

  private async getRoomMetadata(
    listData: ListData | null = null,
  ): Promise<LiveRoomMetadata> {
    const storedMetadata =
      (await this.room.storage.get<LiveRoomMetadata>("roomMetadata")) || null;

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
      return {
        listData: null,
        metadata: null,
        expired: false,
      };
    }

    const metadata = await this.getRoomMetadata(listData);

    return {
      listData,
      metadata,
      expired: isLiveRoomExpired(metadata),
    };
  }

  private async saveRoomMetadata(metadata: LiveRoomMetadata) {
    await this.room.storage.put("roomMetadata", metadata);
  }

  private async touchRoomMetadata(metadata: LiveRoomMetadata | null) {
    const nextMetadata = touchLiveRoomMetadata(
      metadata || {},
    ) as LiveRoomMetadata;
    await this.saveRoomMetadata(nextMetadata);
    return nextMetadata;
  }

  private async saveListData(data: ListData) {
    const sanitized = sanitizeLiveListData({
      ...data,
      updatedAt: new Date().toISOString(),
    }) as ListData | null;

    if (!sanitized) {
      throw new Error("Cannot store invalid live list data.");
    }

    await this.room.storage.put("listData", sanitized);
  }

  private getPresence(excludeId: string | null = null): PresenceUser[] {
    return Array.from(
      this.room.getConnections<ConnectionState>(),
      (connection) => this.getPresenceUser(connection),
    ).filter((user) => user.id !== excludeId);
  }

  private getPresenceUser(connection: Party.Connection): PresenceUser {
    const state = connection.state as ConnectionState | null;
    return {
      id: connection.id,
      avatar: sanitizeAvatar(state?.avatar),
      joinedAt: state?.joinedAt || Date.now(),
    };
  }

  private broadcastPresence(excludeId: string | null = null) {
    this.room.broadcast(
      JSON.stringify({
        type: LIVE_MESSAGE_TYPES.PRESENCE,
        data: this.getPresence(excludeId),
      }),
    );
  }

  private json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
