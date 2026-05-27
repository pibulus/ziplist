const ROOM_PREFIX = "zl_";

export const LIVE_MESSAGE_TYPES = Object.freeze({
  INIT: "init",
  PRESENCE: "presence",
  LIST_UPDATE: "list_update",
  TYPING_START: "typing_start",
  TYPING_STOP: "typing_stop",
});

export const LIVE_LIST_LIMITS = Object.freeze({
  MAX_ITEMS: 120,
  MAX_ITEM_TEXT_LENGTH: 140,
  MAX_LIST_NAME_LENGTH: 64,
  MAX_ID_LENGTH: 128,
  MAX_COLOR_VALUE_LENGTH: 80,
  MAX_AVATAR_LENGTH: 48,
  MAX_PASSWORD_LENGTH: 120,
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value, maxLength) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .replace(/\s+/g, " ")
    .split("")
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .trim()
    .slice(0, maxLength);
}

function normalizeTimestamp(value, fallback = new Date().toISOString()) {
  if (typeof value !== "string" && typeof value !== "number") return fallback;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function normalizeOptionalString(value, maxLength) {
  const normalized = normalizeString(value, maxLength);
  return normalized || undefined;
}

function sanitizeLiveItem(item, index) {
  if (!isRecord(item)) return null;

  const id = normalizeString(item.id, LIVE_LIST_LIMITS.MAX_ID_LENGTH);
  const text = normalizeString(
    item.text,
    LIVE_LIST_LIMITS.MAX_ITEM_TEXT_LENGTH,
  );

  if (!id || !text) return null;

  const sanitized = {
    id,
    text,
    checked: item.checked === true,
  };

  if (Number.isFinite(item.order)) {
    sanitized.order = item.order;
  } else {
    sanitized.order = index;
  }

  const completedAt = normalizeOptionalString(item.completedAt, 40);
  if (completedAt) {
    sanitized.completedAt = completedAt;
  }

  return sanitized;
}

export function generateLiveRoomId() {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (!randomId) {
    throw new Error("Secure random IDs are not available.");
  }

  return `${ROOM_PREFIX}${randomId}`;
}

export function sanitizeAvatar(value) {
  return normalizeString(value, LIVE_LIST_LIMITS.MAX_AVATAR_LENGTH) || "Guest";
}

export function sanitizeLivePassword(value) {
  return normalizeOptionalString(value, LIVE_LIST_LIMITS.MAX_PASSWORD_LENGTH);
}

export function sanitizeLiveListData(input) {
  if (!isRecord(input) || !Array.isArray(input.items)) return null;

  const id = normalizeString(input.id, LIVE_LIST_LIMITS.MAX_ID_LENGTH);
  if (!id) return null;

  const name =
    normalizeString(input.name, LIVE_LIST_LIMITS.MAX_LIST_NAME_LENGTH) ||
    "Live List";
  const createdAt = normalizeTimestamp(input.createdAt);
  const updatedAt = normalizeTimestamp(input.updatedAt, createdAt);
  const items = input.items
    .slice(0, LIVE_LIST_LIMITS.MAX_ITEMS)
    .map(sanitizeLiveItem)
    .filter(Boolean);

  return {
    id,
    name,
    color: normalizeOptionalString(
      input.color,
      LIVE_LIST_LIMITS.MAX_COLOR_VALUE_LENGTH,
    ),
    primaryColor: normalizeOptionalString(
      input.primaryColor,
      LIVE_LIST_LIMITS.MAX_COLOR_VALUE_LENGTH,
    ),
    accentColor: normalizeOptionalString(
      input.accentColor,
      LIVE_LIST_LIMITS.MAX_COLOR_VALUE_LENGTH,
    ),
    glowColor: normalizeOptionalString(
      input.glowColor,
      LIVE_LIST_LIMITS.MAX_COLOR_VALUE_LENGTH,
    ),
    items,
    createdAt,
    updatedAt,
  };
}

export function normalizeLiveMessage(input) {
  if (!isRecord(input)) return null;

  switch (input.type) {
    case LIVE_MESSAGE_TYPES.LIST_UPDATE: {
      const data = sanitizeLiveListData(input.data);
      return data ? { type: LIVE_MESSAGE_TYPES.LIST_UPDATE, data } : null;
    }

    case LIVE_MESSAGE_TYPES.TYPING_START:
      return { type: LIVE_MESSAGE_TYPES.TYPING_START, data: {} };

    case LIVE_MESSAGE_TYPES.TYPING_STOP:
      return { type: LIVE_MESSAGE_TYPES.TYPING_STOP, data: {} };

    default:
      return null;
  }
}
