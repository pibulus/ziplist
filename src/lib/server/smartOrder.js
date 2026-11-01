// A tidy pass may only permute the items it was given. Anything added,
// dropped, duplicated or invented fails validation and the list stays as it
// was — the model is never trusted to reshape a list.
export function validateOrder(requested, suppliedIds) {
  if (!Array.isArray(requested)) return null;
  if (requested.length !== suppliedIds.length) return null;

  const allowed = new Set(suppliedIds);
  const seen = new Set();

  for (const id of requested) {
    if (typeof id !== "string" || !allowed.has(id) || seen.has(id)) return null;
    seen.add(id);
  }

  return [...requested];
}
