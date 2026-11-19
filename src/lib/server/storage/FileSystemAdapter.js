import fs from "fs";
import path from "path";
import crypto from "crypto";

export class FileSystemAdapter {
  constructor(baseDir) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  _hashRaw(raw) {
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  async get(key) {
    const filePath = path.join(this.baseDir, `${key}.json`);
    try {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.error(`[FileSystemAdapter] Error reading ${key}:`, error);
      }
      return null;
    }
  }

  async set(key, value) {
    const filePath = path.join(this.baseDir, `${key}.json`);
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2));
      fs.renameSync(tmpPath, filePath);
      return true;
    } catch (error) {
      console.error(`[FileSystemAdapter] Error writing ${key}:`, error);
      fs.rmSync(tmpPath, { force: true });
      return false;
    }
  }

  async snapshot(key) {
    const filePath = path.join(this.baseDir, `${key}.json`);
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return {
        data: JSON.parse(raw),
        version: this._hashRaw(raw),
      };
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.error(`[FileSystemAdapter] Error snapshotting ${key}:`, error);
      }
      return { data: null, version: null };
    }
  }

  async compareAndSet(key, version, value) {
    const current = await this.snapshot(key);
    if (current.version !== version) {
      return false;
    }
    return this.set(key, value);
  }
}
