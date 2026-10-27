import { getStore } from "@netlify/blobs";
import { env } from "$env/dynamic/private";
import path from "path";
import os from "os";
import { FileSystemAdapter } from "./FileSystemAdapter.js";

export class NetlifyBlobsAdapter {
  constructor() {
    this.storeName = "ziplist-data";
    this._store = null;
    this._fallback = null;
  }

  getFallback() {
    if (!this._fallback) {
      this._fallback = new FileSystemAdapter(
        path.join(os.tmpdir(), "ziplist-data"),
      );
    }
    return this._fallback;
  }

  getStoreInstance() {
    if (this._store) return this._store;
    const siteID = env.NETLIFY_SITE_ID || env.SITE_ID;
    const token = env.NETLIFY_BLOBS_TOKEN || env.NETLIFY_AUTH_TOKEN;
    if (siteID && token) {
      this._store = getStore({
        name: this.storeName,
        siteID,
        token,
        consistency: "strong",
      });
    } else {
      this._store = getStore({ name: this.storeName, consistency: "strong" });
    }
    return this._store;
  }

  async snapshot(key) {
    try {
      const entry = await this.getStoreInstance().getWithMetadata(key, {
        type: "json",
        consistency: "strong",
      });
      return { data: entry?.data || null, version: entry?.etag || null };
    } catch (error) {
      console.warn(
        `[NetlifyBlobsAdapter] snapshot fallback for ${key}:`,
        error?.message,
      );
      return this.getFallback().snapshot(key);
    }
  }

  async compareAndSet(key, version, value) {
    try {
      const result = await this.getStoreInstance().setJSON(
        key,
        value,
        version ? { onlyIfMatch: version } : { onlyIfNew: true },
      );
      return result.modified;
    } catch (error) {
      console.warn(
        `[NetlifyBlobsAdapter] compareAndSet fallback for ${key}:`,
        error?.message,
      );
      return this.getFallback().compareAndSet(key, version, value);
    }
  }

  async get(key) {
    try {
      const store = this.getStoreInstance();
      const data = await store.get(key, { type: "json" });
      return data || null;
    } catch (error) {
      console.warn(
        `[NetlifyBlobsAdapter] get fallback for ${key}:`,
        error?.message,
      );
      return this.getFallback().get(key);
    }
  }

  async set(key, value) {
    try {
      const store = this.getStoreInstance();
      await store.setJSON(key, value);
      return true;
    } catch (error) {
      console.warn(
        `[NetlifyBlobsAdapter] set fallback for ${key}:`,
        error?.message,
      );
      return this.getFallback().set(key, value);
    }
  }
}
