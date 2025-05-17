# ZipList: List Sharing Feature

## Feature Specification Document

### 1. Overview & Problem Statement

ZipList users need to share entire lists with others. Currently, there's no way to send a complete list to another person who could then import it into their own ZipList app. This feature will enable full list sharing with proper formatting and easy importing.

**Solution:** Create a system that allows users to share an entire list and enables recipients to import that list into their ZipList app.

### 2. User Stories

- As a user, I want to share my grocery list and have the recipient receive the complete list with all items
- As a user, I want to import a list that someone shared with me
- As a user, I want an easy way to open shared lists in the ZipList app
- As a user, I want lists to maintain their structure and completion status when shared

### 3. Technical Implementation

#### Sharing Mechanism

- Use Web Share API to share the list as a specially formatted URL
- Encode list data in URL parameters or fragments using base64
- Create a route handler to process incoming shared list URLs
- Add import functionality to create new lists from shared data

#### Data Encoding

```javascript
// Process for sharing
function encodeListForSharing(list) {
  // Strip unnecessary metadata
  const essentialData = {
    name: list.name,
    items: list.items.map((item) => ({
      text: item.text,
      checked: item.checked,
    })),
  };

  // Compress and encode
  return btoa(JSON.stringify(essentialData));
}

// URL format
// https://ziplist.app/import#listdata=base64encodedlistdata
```

#### Import Process

```javascript
// Process for importing
function decodeSharedList(encodedData) {
  try {
    const listData = JSON.parse(atob(encodedData));

    // Generate new IDs for the list and items
    return {
      id: `list_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: listData.name,
      items: listData.items.map((item) => ({
        id: Date.now() + Math.floor(Math.random() * 1000),
        text: item.text,
        checked: item.checked,
        completedAt: item.checked ? new Date().toISOString() : null,
        order: 0,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error("Failed to decode shared list", e);
    return null;
  }
}
```

### 4. User Experience

#### Share Flow

1. User taps "Share" button on a list
2. System generates a shareable URL with encoded list data
3. Native share sheet opens with pre-populated message
4. User selects sharing method (text, email, messaging app, etc.)
5. Recipient receives message with link

#### Import Flow

1. Recipient taps shared link
2. Link opens ZipList app and triggers import route
3. System decodes list data from URL
4. User is prompted to confirm import with list preview
5. On confirmation, list is added to recipient's lists
6. Success confirmation shows with option to view imported list

#### UI Components

- Share button in list header
- Import confirmation dialog with list preview
- Success notification after import

### 5. Implementation Components

#### New Files

```
/src/lib/services/share/
├── shareService.js    // List sharing utilities
└── index.js           // Public API

/src/routes/import/
└── +page.svelte       // Import handler page
```

#### Required Changes

- Add share button to SingleList.svelte
- Create import route and handler
- Add list encoding/decoding utilities
- Implement deep linking support for mobile

### 6. Technical Considerations

- Maximum URL length limitations (use URL fragments for larger lists)
- Cross-browser compatibility for URL handling
- Mobile deep linking configuration
- Graceful error handling for malformed data

---

## UI Elements

### Share Button

```
+--------------------------------+
|  My Grocery List    [🔄] [↑↓]  |
|                                |
|  • Milk                        |
|  • Eggs                        |
|  • Bread                       |
|                                |
+--------------------------------+
```

### Import Confirmation

```
+--------------------------------+
|       Import Shared List       |
|--------------------------------|
|                                |
|  "Grocery List" (3 items)      |
|                                |
|  • Milk                        |
|  • Eggs                        |
|  • Bread                       |
|                                |
|                                |
|    [Cancel]    [Import List]   |
+--------------------------------+
```
