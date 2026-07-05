import fs from "fs";
import path from "path";

export class FileSystemAdapter {
  constructor(baseDir) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async get(key) {
    const filePath = path.join(this.baseDir, `${key}.json`);
    try {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      // A missing file is normal (empty store); anything else — permissions,
      // disk, corrupt JSON — must be loud, or an outage looks like an empty
      // store and licenses "vanish" silently.
      if (error?.code !== "ENOENT") {
        console.error(`[FileSystemAdapter] Error reading ${key}:`, error);
      }
      return null;
    }
  }

  async set(key, value) {
    const filePath = path.join(this.baseDir, `${key}.json`);
    const tmpPath = `${filePath}.tmp`;
    try {
      // Write-then-rename so a crash mid-write can never truncate the live
      // file (rename is atomic on the same filesystem).
      fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2));
      fs.renameSync(tmpPath, filePath);
      return true;
    } catch (error) {
      console.error(`[FileSystemAdapter] Error writing ${key}:`, error);
      fs.rmSync(tmpPath, { force: true });
      return false;
    }
  }
}
