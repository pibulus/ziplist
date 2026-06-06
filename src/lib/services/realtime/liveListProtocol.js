const ROOM_PREFIX = "zl_";

export const LIVE_MESSAGE_TYPES = Object.freeze({
  INIT: "init",
  PRESENCE: "presence",
  LIST_UPDATE: "list_update",
  TYPING_START: "typing_start",
  TYPING_STOP: "typing_stop",
  DRAFT_UPDATE: "draft_update",
  DRAFT_CLEAR: "draft_clear",
  ITEM_FOCUS: "item_focus",
  VOICE_ACTIVITY: "voice_activity",
});

export const LIVE_CLOSE_CODES = Object.freeze({
  ROOM_NOT_FOUND: 4004,
  ROOM_EXPIRED: 4005,
});

export const LIVE_ROOM_TIERS = Object.freeze({
  FREE: "free",
  SUPPORTER: "supporter",
});

export const LIVE_ROOM_TTL_MS = Object.freeze({
  [LIVE_ROOM_TIERS.FREE]: 24 * 60 * 60 * 1000,
  [LIVE_ROOM_TIERS.SUPPORTER]: 365 * 24 * 60 * 60 * 1000,
});

export const LIVE_LIST_LIMITS = Object.freeze({
  MAX_ITEMS: 120,
  MAX_ITEM_TEXT_LENGTH: 140,
  MAX_LIST_NAME_LENGTH: 64,
  MAX_ID_LENGTH: 128,
  MAX_COLOR_VALUE_LENGTH: 80,
  MAX_AVATAR_LENGTH: 48,
  MAX_ALIAS_LENGTH: 64,
  MAX_PASSWORD_LENGTH: 120,
  MAX_VOICE_STAGE_LENGTH: 32,
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

function normalizeLiveRoomTier(value) {
  return value === LIVE_ROOM_TIERS.SUPPORTER
    ? LIVE_ROOM_TIERS.SUPPORTER
    : LIVE_ROOM_TIERS.FREE;
}

function getRoomTtlMs(tier) {
  return LIVE_ROOM_TTL_MS[normalizeLiveRoomTier(tier)];
}

export function createLiveRoomMetadata(input = {}) {
  const now = new Date().toISOString();
  const tier = normalizeLiveRoomTier(input.tier);
  const createdAt = normalizeTimestamp(input.createdAt, now);
  const lastActiveAt = normalizeTimestamp(input.lastActiveAt, now);
  const updatedAt = normalizeTimestamp(input.updatedAt, lastActiveAt);
  const fallbackExpiry = new Date(
    new Date(lastActiveAt).getTime() + getRoomTtlMs(tier),
  ).toISOString();
  const expiresAt = normalizeTimestamp(input.expiresAt, fallbackExpiry);

  return {
    createdAt,
    updatedAt,
    lastActiveAt,
    expiresAt,
    tier,
    alias: normalizeOptionalString(
      input.alias,
      LIVE_LIST_LIMITS.MAX_ALIAS_LENGTH,
    ),
  };
}

export function touchLiveRoomMetadata(input = {}) {
  const now = new Date().toISOString();
  const tier = normalizeLiveRoomTier(input.tier);

  return createLiveRoomMetadata({
    ...input,
    tier,
    updatedAt: now,
    lastActiveAt: now,
    expiresAt: new Date(Date.now() + getRoomTtlMs(tier)).toISOString(),
  });
}

export function isLiveRoomExpired(metadata, now = Date.now()) {
  if (!metadata?.expiresAt) return false;

  const expiresAt = Date.parse(metadata.expiresAt);
  return !Number.isNaN(expiresAt) && expiresAt <= now;
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

function normalizeDraftData(data) {
  if (!isRecord(data)) return null;

  const text = normalizeString(
    data.text,
    LIVE_LIST_LIMITS.MAX_ITEM_TEXT_LENGTH,
  );
  const mode = data.mode === "voice" ? "voice" : "typing";
  const itemId = normalizeOptionalString(
    data.itemId,
    LIVE_LIST_LIMITS.MAX_ID_LENGTH,
  );

  return {
    text,
    mode,
    itemId,
  };
}

function normalizeItemFocusData(data) {
  if (!isRecord(data)) return { itemId: null };

  return {
    itemId:
      normalizeOptionalString(data.itemId, LIVE_LIST_LIMITS.MAX_ID_LENGTH) ||
      null,
  };
}

function normalizeVoiceActivityData(data) {
  if (!isRecord(data)) return null;

  return {
    active: data.active === true,
    stage:
      normalizeOptionalString(
        data.stage,
        LIVE_LIST_LIMITS.MAX_VOICE_STAGE_LENGTH,
      ) || "recording",
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

    case LIVE_MESSAGE_TYPES.DRAFT_UPDATE: {
      const data = normalizeDraftData(input.data);
      return data ? { type: LIVE_MESSAGE_TYPES.DRAFT_UPDATE, data } : null;
    }

    case LIVE_MESSAGE_TYPES.DRAFT_CLEAR:
      return { type: LIVE_MESSAGE_TYPES.DRAFT_CLEAR, data: {} };

    case LIVE_MESSAGE_TYPES.ITEM_FOCUS:
      return {
        type: LIVE_MESSAGE_TYPES.ITEM_FOCUS,
        data: normalizeItemFocusData(input.data),
      };

    case LIVE_MESSAGE_TYPES.VOICE_ACTIVITY: {
      const data = normalizeVoiceActivityData(input.data);
      return data ? { type: LIVE_MESSAGE_TYPES.VOICE_ACTIVITY, data } : null;
    }

    default:
      return null;
  }
}
