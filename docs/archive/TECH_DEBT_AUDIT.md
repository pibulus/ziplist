# Tech Debt Audit 🔍

**Date**: 2025-11-23  
**Status**: Minor issues found

---

## 🚨 **Issues Found**

### **1. Settings Modal - Outdated Theme Names** ⚠️

**File**: `src/lib/components/mainPage/settings/SettingsModal.svelte`

**Problem**: Theme names don't match actual theme IDs

**Current (Lines 38-55)**:
```javascript
const vibeOptions = [
  { id: 'peach', name: 'Peach' },      // ❌ Should be 'focus'
  { id: 'mint', name: 'Mint' },        // ❌ Should be 'chill'
  { id: 'bubblegum', name: 'Bubblegum' }, // ❌ Should be 'zen'
  { id: 'rainbow', name: 'Rainbow' }   // ❌ Should be 'nocturne'
];
```

**Actual theme IDs** (from `theme-variables.css`):
- `focus` (peachy tangerine)
- `chill` (mint/cyan)
- `zen` (lavender/purple)
- `nocturne` (moonlight blue)

**Impact**: 
- Settings modal won't change themes properly
- Clicking theme buttons does nothing
- User confusion

**Fix**: Update theme IDs to match actual themes

---

### **2. Ghost Component - Legacy Theme Names** ⚠️

**Files**: 
- `src/lib/components/ghost/DisplayGhost.svelte`
- `src/lib/components/ghost/ghostStore.js`
- `src/lib/components/ghost/ghost-animations.css`

**Problem**: Ghost still uses old theme names (`peach`, `mint`, `bubblegum`, `rainbow`)

**Impact**:
- Ghost might not match selected theme
- Theme switching might not update ghost colors

**Fix**: Update ghost theme mapping to new names

---

### **3. Advanced Features - "Coming Soon" Items** 📝

**File**: `src/lib/components/mainPage/settings/SettingsModal.svelte` (Lines 273-314)

**Items marked as "Coming Soon"**:
- ✅ Privacy Mode (offline-only) - **ALREADY IMPLEMENTED!** (Whisper auto-downloads)
- ❌ Export lists (CSV/JSON) - Not implemented
- ❌ Multi-list management - Not implemented
- ❌ Whisper model selection - Not needed (tiny-only now)

**Fix**: 
- Remove "Privacy Mode" from coming soon (it's live!)
- Remove "Whisper model selection" (no longer applicable)
- Keep export and multi-list as future features

---

### **4. List Component - Old vs New** 📦

**Files**:
- `src/lib/components/list/SingleList.svelte` (1,510 lines - OLD)
- `src/lib/components/list/List.svelte` (180 lines - NEW)
- `src/lib/components/list/list-components.css` (766 lines - OLD)
- `src/lib/components/list/list-components-fixed.css` (784 lines - OLD)

**Problem**: Old files still exist alongside new clean implementation

**Impact**: 
- Confusion about which to use
- Larger bundle size
- Maintenance burden

**Fix**: Delete old files after testing new List component

---

## ✅ **Good News**

### **No TalkType References** ✅
- Searched entire codebase
- Zero mentions of "TalkType"
- All branding is ZipList

### **No TODO Comments** ✅
- No TODO markers found
- Code is relatively clean

### **Build Passes** ✅
- No errors
- Only a11y warnings (minor)

---

## 🔧 **Recommended Fixes**

### **Priority 1: Fix Settings Modal Themes** 🔥

**File**: `src/lib/components/mainPage/settings/SettingsModal.svelte`

**Change lines 38-55**:
```javascript
const vibeOptions = [
  {
    id: 'focus',
    name: 'Focus',
    description: 'Peachy tangerine sunrise'
  },
  {
    id: 'chill',
    name: 'Chill',
    description: 'Cool mint vibes'
  },
  {
    id: 'zen',
    name: 'Zen',
    description: 'Regal violet lo-fi'
  },
  {
    id: 'nocturne',
    name: 'Nocturne',
    description: 'Dreamy moonlight'
  }
];
```

---

### **Priority 2: Update Advanced Features Section**

**Remove from "Coming Soon"**:
- ✅ Privacy Mode (it's live!)
- ✅ Whisper model selection (not applicable)

**Keep as "Coming Soon"**:
- Export lists (CSV/JSON)
- Multi-list management

---

### **Priority 3: Update Ghost Theme Mapping**

**File**: `src/lib/components/ghost/ghostStore.js`

**Add theme mapping**:
```javascript
const THEME_MAPPING = {
  'focus': 'peach',      // Map new theme to ghost theme
  'chill': 'mint',
  'zen': 'bubblegum',
  'nocturne': 'rainbow'
};
```

---

### **Priority 4: Clean Up Old List Files** (After testing)

**Delete**:
- `src/lib/components/list/SingleList.svelte`
- `src/lib/components/list/list-components.css`
- `src/lib/components/list/list-components-fixed.css`

**Keep**:
- `src/lib/components/list/List.svelte` (new)
- `src/lib/components/list/ListItem.svelte` (new)
- `src/lib/components/list/list.css` (new)

---

## 📊 **Tech Debt Summary**

| Issue | Severity | Impact | Effort | Status |
|-------|----------|--------|--------|--------|
| **Settings Modal Themes** | 🔴 High | Broken functionality | 15min | Not fixed |
| **Ghost Theme Names** | 🟡 Medium | Visual inconsistency | 30min | Not fixed |
| **Advanced Features** | 🟢 Low | Misleading UI | 10min | Not fixed |
| **Old List Files** | 🟡 Medium | Bundle bloat | 5min | Waiting for test |

---

## 🎯 **Quick Wins**

### **Win 1: Fix Settings Modal** (15 minutes)
- Update theme IDs
- Test theme switching
- Verify ghost updates

### **Win 2: Update Advanced Features** (10 minutes)
- Remove Privacy Mode from "Coming Soon"
- Remove Whisper model selection
- Update copy

### **Win 3: Add Theme Descriptions** (5 minutes)
- Add descriptions to theme buttons
- Improve UX

---

## 🚀 **Action Plan**

1. **Immediate** (30 min):
   - Fix settings modal theme IDs
   - Update advanced features section
   - Test theme switching

2. **Soon** (1 hour):
   - Update ghost theme mapping
   - Test ghost with all themes
   - Verify consistency

3. **After Testing** (5 min):
   - Delete old list files
   - Clean up unused CSS

---

**Total Tech Debt**: Minimal  
**Critical Issues**: 1 (Settings Modal)  
**Estimated Fix Time**: ~2 hours total

**Overall Assessment**: 😊 **Pretty clean!** Just need to fix the theme mapping.
