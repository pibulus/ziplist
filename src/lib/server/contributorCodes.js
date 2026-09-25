export function normalizeContributorCode(value) {
  return value?.toString().trim().toUpperCase() || "";
}

export function parseContributorCodes(...values) {
  return values
    .filter(Boolean)
    .flatMap((value) => value.split(","))
    .map(normalizeContributorCode)
    .filter(Boolean);
}

export function isContributorCodeValid(code, validCodes) {
  const normalizedCode = normalizeContributorCode(code);
  if (!normalizedCode || !Array.isArray(validCodes)) return false;

  // Constant-time comparison across the whole allowlist so response timing
  // can't narrow down a manual code character by character.
  let matched = false;
  for (const validCode of validCodes) {
    if (timingSafeStringEqual(normalizedCode, validCode)) {
      matched = true;
    }
  }
  return matched;
}

function timingSafeStringEqual(a, b) {
  const aStr = String(a);
  const bStr = String(b);
  const length = Math.max(aStr.length, bStr.length);

  let mismatch = aStr.length === bStr.length ? 0 : 1;
  for (let i = 0; i < length; i++) {
    mismatch |= (aStr.charCodeAt(i) || 0) ^ (bStr.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}
