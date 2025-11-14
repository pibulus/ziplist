/**
 * PartyKit Server for Live List Collaboration
 *
 * Features:
 * - Persistent storage using Durable Objects
 * - Real-time broadcasting to all connected users
 * - Presence tracking (see who's online)
 * - Optional password protection
 */

import type * as Party from "partykit/server";

export interface ListData {
  id: string;
  name: string;
  items: Array<{
    id: string;
    text: string;
    checked: boolean;
  }>;
  createdAt: number;
  updatedAt: number;
}

export interface PresenceUser {
  id: string;
  avatar: string;
  joinedAt: number;
}

export interface Message {
  type:
    | "init"           // Send initial state to new joiner
    | "presence"       // Presence update
    | "list_update"    // Full list update
    | "item_add"       // Add item
    | "item_update"    // Update item
    | "item_delete"    // Delete item
    | "item_toggle";   // Toggle item checked state
  data?: any;
  sender?: PresenceUser;
}

export default class ListRoom implements Party.Server {
  constructor(public party: Party.Party) {}

  /**
   * Called when a new connection joins the room
   */
  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // Get user's avatar name from query params
    const url = new URL(ctx.request.url);
    const avatar = url.searchParams.get('avatar') || 'Anonymous';
    const userId = conn.id;

    // Check password if room is password-protected
    const roomPassword = await this.party.storage.get<string>('password');
    const providedPassword = url.searchParams.get('pwd');

    if (roomPassword && roomPassword !== providedPassword) {
      conn.close(1008, "Wrong password");
      return;
    }

    // Add user to presence
    const presence = await this.getPresence();
    presence[userId] = {
      id: userId,
      avatar,
      joinedAt: Date.now()
    };
    await this.party.storage.put('presence', presence);

    // Send initial list state to the new joiner
    const listData = await this.getListData();
    conn.send(JSON.stringify({
      type: 'init',
      data: listData
    } as Message));

    // Broadcast presence update to everyone
    this.party.broadcast(JSON.stringify({
      type: 'presence',
      data: Object.values(presence)
    } as Message));

    console.log(`[ListRoom ${this.party.id}] User ${avatar} joined (${Object.keys(presence).length} online)`);
  }

  /**
   * Called when a connection closes
   */
  async onClose(conn: Party.Connection) {
    // Remove user from presence
    const presence = await this.getPresence();
    const user = presence[conn.id];
    delete presence[conn.id];
    await this.party.storage.put('presence', presence);

    // Broadcast presence update
    this.party.broadcast(JSON.stringify({
      type: 'presence',
      data: Object.values(presence)
    } as Message));

    console.log(`[ListRoom ${this.party.id}] User ${user?.avatar || conn.id} left (${Object.keys(presence).length} online)`);
  }

  /**
   * Called when a message is received from a connection
   */
  async onMessage(message: string, sender: Party.Connection) {
    const msg: Message = JSON.parse(message);
    const presence = await this.getPresence();
    const senderUser = presence[sender.id];

    // Add sender info to message
    msg.sender = senderUser;

    // Handle different message types
    switch (msg.type) {
      case 'list_update':
        // Full list update - save to storage
        await this.saveListData(msg.data);
        break;

      case 'item_add':
      case 'item_update':
      case 'item_delete':
      case 'item_toggle':
        // Partial update - apply to stored list
        const listData = await this.getListData();
        const updatedList = this.applyUpdate(listData, msg);
        await this.saveListData(updatedList);
        break;
    }

    // Broadcast to all connected users (except sender)
    this.party.broadcast(message, [sender.id]);

    console.log(`[ListRoom ${this.party.id}] ${senderUser?.avatar || 'Unknown'} sent ${msg.type}`);
  }

  /**
   * Handle HTTP requests (for creating/fetching rooms)
   */
  async onRequest(req: Party.Request) {
    if (req.method === 'POST') {
      // Create new list
      const data = await req.json<ListData>();
      await this.saveListData(data);

      // Optionally set password
      const url = new URL(req.url);
      const password = url.searchParams.get('pwd');
      if (password) {
        await this.party.storage.put('password', password);
      }

      return new Response(JSON.stringify({
        roomId: this.party.id,
        listId: data.id
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET') {
      // Get current list state
      const listData = await this.getListData();
      return new Response(JSON.stringify(listData), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', { status: 405 });
  }

  /**
   * Get list data from storage
   */
  private async getListData(): Promise<ListData | null> {
    return await this.party.storage.get<ListData>('listData') || null;
  }

  /**
   * Save list data to storage
   */
  private async saveListData(data: ListData) {
    data.updatedAt = Date.now();
    await this.party.storage.put('listData', data);
  }

  /**
   * Get presence data
   */
  private async getPresence(): Promise<Record<string, PresenceUser>> {
    return await this.party.storage.get<Record<string, PresenceUser>>('presence') || {};
  }

  /**
   * Apply a partial update to the list
   */
  private applyUpdate(listData: ListData | null, msg: Message): ListData {
    if (!listData) {
      throw new Error('Cannot update non-existent list');
    }

    const items = [...listData.items];

    switch (msg.type) {
      case 'item_add':
        items.push(msg.data);
        break;

      case 'item_update':
        const updateIndex = items.findIndex(item => item.id === msg.data.id);
        if (updateIndex !== -1) {
          items[updateIndex] = { ...items[updateIndex], ...msg.data };
        }
        break;

      case 'item_delete':
        const deleteIndex = items.findIndex(item => item.id === msg.data.id);
        if (deleteIndex !== -1) {
          items.splice(deleteIndex, 1);
        }
        break;

      case 'item_toggle':
        const toggleIndex = items.findIndex(item => item.id === msg.data.id);
        if (toggleIndex !== -1) {
          items[toggleIndex].checked = !items[toggleIndex].checked;
        }
        break;
    }

    return {
      ...listData,
      items
    };
  }
}
