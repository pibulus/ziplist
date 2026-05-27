/**
 * PartyKit room for ZipList live sharing.
 *
 * The room stores one validated list snapshot and broadcasts snapshot updates.
 * Presence is derived from active connections so stale users do not become
 * durable data.
 */

import type * as Party from "partykit/server";
import {
  LIVE_MESSAGE_TYPES,
  normalizeLiveMessage,
  sanitizeAvatar,
  sanitizeLiveListData,
  sanitizeLivePassword,
} from "../src/lib/services/realtime/liveListProtocol.js";

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

    const listData = await this.getListData();
    if (!listData) {
      conn.close(1008, "Live list not found");
      return;
    }

    const avatar = sanitizeAvatar(url.searchParams.get("avatar"));
    conn.setState({
      avatar,
      joinedAt: Date.now(),
    } satisfies ConnectionState);

    conn.send(
      JSON.stringify({
        type: LIVE_MESSAGE_TYPES.INIT,
        data: listData,
      }),
    );

    this.broadcastPresence();
  }

  onClose(conn: Party.Connection) {
    this.broadcastPresence(conn.id);
  }

  async onMessage(message: string, sender: Party.Connection) {
    const listData = await this.getListData();
    if (!listData) {
      sender.close(1008, "Live list not found");
      return;
    }

    const parsedMessage = this.parseMessage(message);
    const normalizedMessage = normalizeLiveMessage(parsedMessage);
    if (!normalizedMessage) return;

    if (normalizedMessage.type === LIVE_MESSAGE_TYPES.LIST_UPDATE) {
      await this.saveListData(normalizedMessage.data as ListData);
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

      const data = sanitizeLiveListData(payload) as ListData | null;
      if (!data) {
        return this.json({ error: "Invalid list data." }, 400);
      }

      await this.saveListData(data);

      const url = new URL(req.url);
      const password = sanitizeLivePassword(url.searchParams.get("pwd"));
      if (password) {
        await this.room.storage.put("password", password);
      }

      return this.json({
        roomId: this.room.id,
        listId: data.id,
      });
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      if (!(await this.isPasswordAllowed(url))) {
        return this.json({ error: "Forbidden" }, 403);
      }

      const listData = await this.getListData();
      if (!listData) {
        return this.json({ error: "Live list not found" }, 404);
      }

      return this.json(listData);
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

  private authorizeCreateRequest(req: Party.Request) {
    const createSecret = String(this.room.env?.PARTYKIT_CREATE_SECRET || "");
    const authHeader = req.headers.get("authorization") || "";

    if (!createSecret && !this.isLocalRequest(req)) {
      return this.json(
        { error: "PartyKit room creation secret is not configured." },
        503,
      );
    }

    if (createSecret && authHeader !== `Bearer ${createSecret}`) {
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
    const roomPassword = await this.room.storage.get<string>("password");
    return !roomPassword || roomPassword === url.searchParams.get("pwd");
  }

  private async getListData(): Promise<ListData | null> {
    return (await this.room.storage.get<ListData>("listData")) || null;
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
