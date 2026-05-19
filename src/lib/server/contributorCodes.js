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
  if (!normalizedCode) return false;

  return validCodes.includes(normalizedCode);
}
