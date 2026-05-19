import { env } from "$env/dynamic/private";
import path from "path";
import { FileSystemAdapter } from "./FileSystemAdapter.js";
import { MemoryAdapter } from "./MemoryAdapter.js";

function createStorage() {
  const requestedAdapter = env.ZIPLIST_STORAGE_ADAPTER?.trim();

  if (requestedAdapter === "memory") {
    return new MemoryAdapter();
  }

  const dataDir =
    env.ZIPLIST_DATA_DIR?.trim() || path.join(process.cwd(), "data");

  return new FileSystemAdapter(dataDir);
}

export const storage = createStorage();
