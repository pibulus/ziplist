# Icon/Header Cleanup Plan 🧹

**Goal**: Remove all outdated ghost icon/header stuff

---

## Files to Delete:

1. ✅ `src/lib/components/mainPage/GhostContainer.svelte` - Unused wrapper
2. ✅ Remove import from `MainContainer.svelte`

---

## Files to Check:

- `Ghost.svelte` - Keep (still used elsewhere)
- `DisplayGhost.svelte` - Keep (used in settings modal)
- Ghost animations/stores - Keep (used by Ghost component)

---

## Changes:

### MainContainer.svelte
- Remove line 5: `import GhostContainer from './GhostContainer.svelte';`

---

**Status**: Ready to execute
