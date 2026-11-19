export class MemoryAdapter {
  constructor() {
    this.store = new Map();
    this.versions = new Map();
    this.seq = 0;
    console.warn(
      "[MemoryAdapter] Using in-memory storage. Data resets on server restart.",
    );
  }

  async get(key) {
    const val = this.store.get(key);
    return val !== undefined ? structuredClone(val) : null;
  }

  async set(key, value) {
    this.seq += 1;
    this.store.set(key, structuredClone(value));
    this.versions.set(key, `v${this.seq}`);
    return true;
  }

  async snapshot(key) {
    if (!this.store.has(key)) {
      return { data: null, version: null };
    }
    return {
      data: structuredClone(this.store.get(key)),
      version: this.versions.get(key) || "v0",
    };
  }

  async compareAndSet(key, version, value) {
    const currentVersion = this.store.has(key)
      ? this.versions.get(key) || "v0"
      : null;
    if (version !== currentVersion) {
      return false;
    }
    await this.set(key, value);
    return true;
  }
}
