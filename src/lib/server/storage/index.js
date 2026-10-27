import { env } from "$env/dynamic/private";
import path from "path";
import os from "os";
import { FileSystemAdapter } from "./FileSystemAdapter.js";
import { MemoryAdapter } from "./MemoryAdapter.js";
import { NetlifyBlobsAdapter } from "./NetlifyBlobsAdapter.js";

function createStorage() {
  const requestedAdapter = env.ZIPLIST_STORAGE_ADAPTER?.trim();

  if (requestedAdapter === "memory") {
    return new MemoryAdapter();
  }

  const isNetlifyProd =
    requestedAdapter === "netlify-blobs" ||
    Boolean(
      env.NETLIFY === "true" ||
      process.env.NETLIFY === "true" ||
      process.env.NETLIFY_BLOBS_CONTEXT ||
      process.env.AWS_LAMBDA_FUNCTION_NAME,
    );

  if (isNetlifyProd) {
    return new NetlifyBlobsAdapter();
  }

  const isServerless = Boolean(
    env.NETLIFY ||
    process.env.NETLIFY ||
    env.VERCEL ||
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME,
  );

  const defaultDir = isServerless
    ? path.join(os.tmpdir(), "ziplist-data")
    : path.join(process.cwd(), "data");

  const dataDir = env.ZIPLIST_DATA_DIR?.trim() || defaultDir;

  return new FileSystemAdapter(dataDir);
}

export const storage = createStorage();
