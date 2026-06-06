#!/usr/bin/env node

import fs from "node:fs";

const DEFAULT_APP_ORIGIN = "http://localhost:3001";
const ROOM_PATH = "/parties/main";
const TIMEOUT_MS = 10000;

function readDotEnvValue(key) {
  if (!fs.existsSync(".env")) return "";

  const line = fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${key}=`));

  if (!line) return "";
  return line
    .slice(key.length + 1)
    .trim()
    .replace(/\s+#.*$/, "")
    .replace(/^['"]|['"]$/g, "");
}

function normalizeHost(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^wss?:\/\//i, "")
    .replace(/\/+$/, "");
}

function isLocalHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function getAppOrigin() {
  return (process.env.LIVE_SMOKE_APP_ORIGIN || DEFAULT_APP_ORIGIN).replace(
    /\/+$/,
    "",
  );
}

function getPartyKitHost(appOrigin) {
  const appUrl = new URL(appOrigin);
  if (isLocalHost(appUrl.hostname)) {
    return `${appUrl.hostname}:1999`;
  }

  const configuredHost =
    process.env.LIVE_SMOKE_PARTYKIT_HOST ||
    process.env.PARTYKIT_HOST ||
    process.env.VITE_PARTYKIT_HOST ||
    readDotEnvValue("PARTYKIT_HOST") ||
    readDotEnvValue("VITE_PARTYKIT_HOST");

  if (configuredHost) return normalizeHost(configuredHost);

  throw new Error(
    "Set LIVE_SMOKE_PARTYKIT_HOST when smoking a non-local app origin.",
  );
}

function getContributorToken() {
  return (
    process.env.LIVE_SMOKE_CONTRIBUTOR_TOKEN ||
    process.env.CONTRIBUTOR_TOKEN ||
    ""
  ).trim();
}

function getPartyKitProtocol(host) {
  return isLocalHost(host.split(":")[0]) ? "http" : "https";
}

function getPartyKitWsProtocol(host) {
  return getPartyKitProtocol(host) === "http" ? "ws" : "wss";
}

function createListData(label, itemText) {
  const now = new Date().toISOString();
  return {
    id: `smoke-${label}-${Date.now()}`,
    name: `Smoke ${label}`,
    color: "blue",
    primaryColor: "#00d4ff",
    accentColor: "#4dd0e1",
    glowColor: "rgba(0, 212, 255, 0.3)",
    items: [
      {
        id: `${label}-item-1`,
        text: itemText,
        checked: false,
        order: 0,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { text };
  }
}

async function createRoom({ appOrigin, token, label, itemText }) {
  const listData = createListData(label, itemText);
  const response = await fetch(`${appOrigin}/api/live/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: appOrigin,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ listData }),
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(
      `create ${label} failed ${response.status}: ${JSON.stringify(payload)}`,
    );
  }

  if (!payload.roomId) {
    throw new Error(`create ${label} did not return a roomId`);
  }

  return { roomId: payload.roomId, listData };
}

async function getRoom({ partyHost, roomId }) {
  const protocol = getPartyKitProtocol(partyHost);
  const response = await fetch(
    `${protocol}://${partyHost}${ROOM_PATH}/${encodeURIComponent(roomId)}`,
  );
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(
      `GET ${roomId} failed ${response.status}: ${JSON.stringify(payload)}`,
    );
  }

  return payload;
}

function waitForSocket(socket, eventName) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for websocket ${eventName}`));
    }, TIMEOUT_MS);

    const onEvent = (event) => {
      cleanup();
      resolve(event);
    };

    const onError = () => {
      cleanup();
      reject(new Error("WebSocket error"));
    };

    function cleanup() {
      clearTimeout(timeout);
      socket.removeEventListener(eventName, onEvent);
      socket.removeEventListener("error", onError);
    }

    socket.addEventListener(eventName, onEvent);
    socket.addEventListener("error", onError);
  });
}

function closeSocket(socket) {
  return new Promise((resolve) => {
    if (socket.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }

    const timeout = setTimeout(resolve, 1000);
    socket.addEventListener(
      "close",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
    socket.close();
  });
}

async function updateRoomViaSocket({ partyHost, roomId, nextData }) {
  const protocol = getPartyKitWsProtocol(partyHost);
  const socket = new WebSocket(
    `${protocol}://${partyHost}${ROOM_PATH}/${encodeURIComponent(
      roomId,
    )}?avatar=Live%20Smoke`,
  );

  try {
    const initPromise = waitForSocket(socket, "message");
    await waitForSocket(socket, "open");
    const initEvent = await initPromise;
    const initMessage = JSON.parse(initEvent.data);

    if (initMessage.type !== "init") {
      throw new Error(`Expected init message, got ${initMessage.type}`);
    }

    socket.send(JSON.stringify({ type: "list_update", data: nextData }));
    await new Promise((resolve) => setTimeout(resolve, 500));
  } finally {
    await closeSocket(socket);
  }
}

function assertItem(roomData, text) {
  if (!roomData.items?.some((item) => item.text === text)) {
    throw new Error(`Expected room ${roomData.id} to include item "${text}"`);
  }
}

function assertNoItem(roomData, text) {
  if (roomData.items?.some((item) => item.text === text)) {
    throw new Error(`Expected room ${roomData.id} not to include "${text}"`);
  }
}

async function main() {
  const appOrigin = getAppOrigin();
  const partyHost = getPartyKitHost(appOrigin);
  const token = getContributorToken();

  console.log(`app=${appOrigin}`);
  console.log(`partykit=${partyHost}`);

  const roomA = await createRoom({
    appOrigin,
    token,
    label: "a",
    itemText: "Apples",
  });
  const roomB = await createRoom({
    appOrigin,
    token,
    label: "b",
    itemText: "Bananas",
  });

  const initialA = await getRoom({ partyHost, roomId: roomA.roomId });
  const initialB = await getRoom({ partyHost, roomId: roomB.roomId });
  assertItem(initialA, "Apples");
  assertItem(initialB, "Bananas");

  const nextA = {
    ...initialA,
    items: [
      ...initialA.items,
      {
        id: "a-item-2",
        text: "Carrots",
        checked: false,
        order: initialA.items.length,
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  await updateRoomViaSocket({
    partyHost,
    roomId: roomA.roomId,
    nextData: nextA,
  });

  const finalA = await getRoom({ partyHost, roomId: roomA.roomId });
  const finalB = await getRoom({ partyHost, roomId: roomB.roomId });
  assertItem(finalA, "Carrots");
  assertNoItem(finalB, "Carrots");
  assertItem(finalB, "Bananas");

  console.log(`room_a=${roomA.roomId}`);
  console.log(`room_b=${roomB.roomId}`);
  console.log("live smoke=ok");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
