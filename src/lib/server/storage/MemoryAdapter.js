export class MemoryAdapter {
  constructor() {
    this.store = new Map();
    console.warn(
      "[MemoryAdapter] Using in-memory storage. Data resets on server restart.",
    );
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async set(key, value) {
    this.store.set(key, value);
    return true;
  }
}
