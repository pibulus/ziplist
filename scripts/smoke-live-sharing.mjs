#!/usr/bin/env node

import crypto from "node:crypto";
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

function getPartyKitCreateSecret() {
  return (
    process.env.PARTYKIT_CREATE_SECRET ||
    readDotEnvValue("PARTYKIT_CREATE_SECRET") ||
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

  if (!payload.tier || !payload.expiresAt) {
    throw new Error(`create ${label} did not return room lifecycle metadata`);
  }

  return {
    roomId: payload.roomId,
    listData,
    tier: payload.tier,
    expiresAt: payload.expiresAt,
  };
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

async function createExpiredRoomDirect({ partyHost }) {
  const protocol = getPartyKitProtocol(partyHost);
  const roomId = `zl_smoke_expired_${crypto.randomUUID()}`;
  const listData = createListData("expired", "Old note");
  const expiredAt = new Date(Date.now() - 60_000).toISOString();
  const createSecret = getPartyKitCreateSecret();
  const response = await fetch(
    `${protocol}://${partyHost}${ROOM_PATH}/${encodeURIComponent(roomId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(createSecret ? { Authorization: `Bearer ${createSecret}` } : {}),
      },
      body: JSON.stringify({
        listData,
        metadata: {
          tier: "free",
          createdAt: expiredAt,
          updatedAt: expiredAt,
          lastActiveAt: expiredAt,
          expiresAt: expiredAt,
        },
      }),
    },
  );
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(
      `create expired room failed ${response.status}: ${JSON.stringify(
        payload,
      )}`,
    );
  }

  return roomId;
}

async function assertExpiredRoom({ partyHost, roomId }) {
  const protocol = getPartyKitProtocol(partyHost);
  const response = await fetch(
    `${protocol}://${partyHost}${ROOM_PATH}/${encodeURIComponent(roomId)}`,
  );
  const payload = await readJson(response);

  if (response.status !== 410 || payload.code !== "room_expired") {
    throw new Error(
      `expired GET expected 410 room_expired, got ${response.status}: ${JSON.stringify(
        payload,
      )}`,
    );
  }
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

function waitForSocketMessage(socket, type, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for websocket message ${type}`));
    }, TIMEOUT_MS);

    const onMessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.type !== type || !predicate(message)) return;

      cleanup();
      resolve(message);
    };

    const onError = () => {
      cleanup();
      reject(new Error("WebSocket error"));
    };

    function cleanup() {
      clearTimeout(timeout);
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("error", onError);
    }

    socket.addEventListener("message", onMessage);
    socket.addEventListener("error", onError);
  });
}

function waitForSocketClose(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for websocket close"));
    }, TIMEOUT_MS);

    const onClose = (event) => {
      cleanup();
      resolve(event);
    };

    const onError = () => {
      cleanup();
      reject(new Error("WebSocket error"));
    };

    function cleanup() {
      clearTimeout(timeout);
      socket.removeEventListener("close", onClose);
      socket.removeEventListener("error", onError);
    }

    socket.addEventListener("close", onClose);
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

async function openRoomSocket({ partyHost, roomId, avatar }) {
  const protocol = getPartyKitWsProtocol(partyHost);
  const socket = new WebSocket(
    `${protocol}://${partyHost}${ROOM_PATH}/${encodeURIComponent(
      roomId,
    )}?avatar=${encodeURIComponent(avatar)}`,
  );

  const initPromise = waitForSocketMessage(socket, "init");
  await waitForSocket(socket, "open");
  await initPromise;

  return socket;
}

async function assertEphemeralRelay({ partyHost, roomId }) {
  const sender = await openRoomSocket({
    partyHost,
    roomId,
    avatar: "Live Smoke Sender",
  });
  const receiver = await openRoomSocket({
    partyHost,
    roomId,
    avatar: "Live Smoke Receiver",
  });

  try {
    const fromSender = (message) =>
      message.sender?.avatar === "Live Smoke Sender";

    const draftPromise = waitForSocketMessage(
      receiver,
      "draft_update",
      (message) => fromSender(message) && message.data?.text === "Olive oil",
    );
    sender.send(
      JSON.stringify({
        type: "draft_update",
        data: { text: "Olive oil", mode: "typing" },
      }),
    );
    await draftPromise;

    const focusPromise = waitForSocketMessage(
      receiver,
      "item_focus",
      (message) => fromSender(message) && message.data?.itemId === "a-item-1",
    );
    sender.send(
      JSON.stringify({
        type: "item_focus",
        data: { itemId: "a-item-1" },
      }),
    );
    await focusPromise;

    const voicePromise = waitForSocketMessage(
      receiver,
      "voice_activity",
      (message) =>
        fromSender(message) &&
        message.data?.active === true &&
        message.data?.stage === "recording",
    );
    sender.send(
      JSON.stringify({
        type: "voice_activity",
        data: { active: true, stage: "recording" },
      }),
    );
    await voicePromise;

    const clearPromise = waitForSocketMessage(
      receiver,
      "draft_clear",
      fromSender,
    );
    sender.send(JSON.stringify({ type: "draft_clear", data: {} }));
    await clearPromise;
  } finally {
    await Promise.all([closeSocket(sender), closeSocket(receiver)]);
  }
}

async function assertExpiredSocket({ partyHost, roomId }) {
  const protocol = getPartyKitWsProtocol(partyHost);
  const socket = new WebSocket(
    `${protocol}://${partyHost}${ROOM_PATH}/${encodeURIComponent(
      roomId,
    )}?avatar=Expired%20Smoke`,
  );

  const closeEvent = await waitForSocketClose(socket);
  if (closeEvent.code !== 4005) {
    throw new Error(
      `expired socket expected close 4005, got ${closeEvent.code}`,
    );
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

  await assertEphemeralRelay({ partyHost, roomId: roomA.roomId });

  const finalA = await getRoom({ partyHost, roomId: roomA.roomId });
  const finalB = await getRoom({ partyHost, roomId: roomB.roomId });
  assertItem(finalA, "Carrots");
  assertNoItem(finalB, "Carrots");
  assertItem(finalB, "Bananas");
  assertNoItem(finalA, "Olive oil");

  if (isLocalHost(partyHost.split(":")[0])) {
    const expiredRoomId = await createExpiredRoomDirect({ partyHost });
    await assertExpiredRoom({ partyHost, roomId: expiredRoomId });
    await assertExpiredSocket({ partyHost, roomId: expiredRoomId });
  }

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
