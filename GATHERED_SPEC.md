# Gathered — Full Build Spec
*Private Family & Friends Photo Sharing · PWA · Firebase Backend · PolyForm Noncommercial License*

---

## Overview

Gathered is a mobile-first Progressive Web App for sharing photos with private groups of family and friends. No ads. No algorithm. No bloat. Just the people you choose, seeing what you share.

Users sign in with Google, create or join private groups via invite link, and post photos with captions. Others in the group can comment and react. Each user has a profile showing their posts. The main view is a chronological feed of everyone's posts in the current group.

**Tech stack:**
- **Frontend:** Vanilla HTML, CSS, JavaScript — no framework, no build step
- **Backend:** Firebase (Firestore database, Firebase Storage, Firebase Auth)
- **Hosting:** GitHub Pages (static frontend only — Firebase handles all backend)
- **PWA:** Service worker + Web App Manifest for installable, offline-capable experience

---

## Guiding Principles

- **No algorithm.** Feed is strictly chronological, newest first. No ranking, no "for you."
- **No ads, ever.** Clean interface. No tracking pixels, no third-party analytics.
- **Private by default.** Nothing is visible outside your group. Groups are invite-only.
- **Mobile first.** Designed for one hand on a phone. Every tap target ≥ 44px.
- **Simple enough for grandparents.** Sign in with Google, tap to join, tap to post. No technical knowledge required.
- **Free to run.** Designed to stay within Firebase's free Spark tier for small family groups.

---

## File Structure

```
/
├── index.html
├── manifest.json
├── sw.js                        (service worker)
├── firebase-config.js           (Firebase project config — user fills this in)
├── css/
│   ├── styles.css               (global styles, design tokens)
│   ├── auth.css                 (sign-in screen)
│   ├── feed.css                 (home feed, post cards)
│   ├── post.css                 (create post, post detail)
│   ├── profile.css              (profile screen)
│   └── groups.css               (group management screens)
├── js/
│   ├── app.js                   (init, routing, navigation)
│   ├── auth.js                  (Firebase Auth, sign-in/sign-out)
│   ├── feed.js                  (feed rendering, real-time listener)
│   ├── post.js                  (create post, post detail, comments)
│   ├── profile.js               (profile screen rendering)
│   ├── groups.js                (create group, join group, manage members)
│   ├── storage.js               (image upload, compression)
│   └── utils.js                 (shared helpers)
├── icons/
│   ├── icon-192.png             (copy from gathered.png, resize to 192x192)
│   ├── icon-512.png             (copy from gathered.png, resize to 512x512)
│   └── apple-touch-icon.png    (copy from gathered.png, resize to 180x180)
└── README.md
```

**Important:** `firebase-config.js` contains the user's Firebase project credentials. It must be listed in `.gitignore` so credentials are not committed to the repository. Include a `firebase-config.example.js` with empty placeholder values and instructions.

---

## Design System

### Color Palette
Draw from the Gathered app icon: a warm blue-to-orange gradient with white text. The UI itself should be clean and light — the gradient is reserved for key brand moments (header, FAB, buttons), not the whole screen.

```css
:root {
  /* Brand gradient — matches the app icon */
  --brand-start: #3a4fd4;       /* deep blue */
  --brand-end:   #f5820a;       /* warm orange */
  --brand-mid:   #7b4dd4;       /* purple midpoint for gradients */

  /* UI surfaces */
  --bg:          #f8f9fb;       /* page background — very light grey */
  --surface:     #ffffff;       /* card/panel background */
  --surface-2:   #f0f2f5;       /* input backgrounds, secondary surfaces */

  /* Text */
  --text-primary:   #1a1a2e;    /* near-black — 16:1 on white ✓ */
  --text-secondary: #4a4a6a;    /* medium — 7.2:1 on white ✓ */
  --text-muted:     #6e6e8e;    /* subtle — 4.6:1 on white ✓ */

  /* Borders & dividers */
  --border:      #e2e4e9;
  --border-strong: #c8cad4;

  /* Semantic */
  --danger:      #c0392b;       /* 5.1:1 on white ✓ */
  --success:     #1e7e34;       /* 5.6:1 on white ✓ */

  /* Shadows */
  --shadow-sm:   0 1px 4px rgba(26,26,46,0.08);
  --shadow-md:   0 4px 16px rgba(26,26,46,0.12);
  --shadow-lg:   0 8px 32px rgba(26,26,46,0.18);

  /* Radii */
  --radius-sm:   8px;
  --radius-md:   14px;
  --radius-lg:   20px;
  --radius-full: 9999px;
}
```

### Dark Mode Tokens

All CSS custom properties must be overridden for dark and system modes. The brand gradient never changes — only the neutral surfaces and text colors flip.

```css
/* System default: respect OS preference */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg:             #0f0f1a;
    --surface:        #1a1a2e;
    --surface-2:      #252540;
    --text-primary:   #f0f0fa;   /* 14:1 on #1a1a2e ✓ */
    --text-secondary: #b0b0cc;   /* 6.8:1 on #1a1a2e ✓ */
    --text-muted:     #8080a8;   /* 4.5:1 on #1a1a2e ✓ */
    --border:         #2e2e50;
    --border-strong:  #4a4a70;
    --shadow-sm:      0 1px 4px rgba(0,0,0,0.3);
    --shadow-md:      0 4px 16px rgba(0,0,0,0.4);
    --shadow-lg:      0 8px 32px rgba(0,0,0,0.5);
  }
}

/* Explicit dark mode (user chose dark regardless of OS) */
:root[data-theme="dark"] {
  --bg:             #0f0f1a;
  --surface:        #1a1a2e;
  --surface-2:      #252540;
  --text-primary:   #f0f0fa;
  --text-secondary: #b0b0cc;
  --text-muted:     #8080a8;
  --border:         #2e2e50;
  --border-strong:  #4a4a70;
  --shadow-sm:      0 1px 4px rgba(0,0,0,0.3);
  --shadow-md:      0 4px 16px rgba(0,0,0,0.4);
  --shadow-lg:      0 8px 32px rgba(0,0,0,0.5);
}

/* Explicit light mode (user chose light regardless of OS) */
:root[data-theme="light"] {
  /* All values are the :root defaults — no overrides needed */
}
```

### Theme Toggle

Store the user's preference in `localStorage` under the key `gathered_theme`. Values: `'light'`, `'dark'`, or `'system'` (default).

On app init (before first render, to avoid flash):
```javascript
function applyTheme() {
  const pref = localStorage.getItem('gathered_theme') || 'system';
  if (pref === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', pref);
  }
}
// Call this immediately in <head> via an inline <script> to prevent flash
applyTheme();
```

A theme selector is available in the Profile screen (see Profile spec). Three options displayed as icon buttons:
- ☀️ Light
- 🌙 Dark  
- 🔁 System (default)

The active selection is highlighted. Changing the selection calls `applyTheme()` immediately — no page reload required.

### Brand Gradient (for buttons, FAB, top bar accent)
```css
.brand-gradient {
  background: linear-gradient(135deg, var(--brand-start), var(--brand-mid), var(--brand-end));
}
```

### Typography
- **Display/headings:** `'DM Sans'` from Google Fonts — weights 400, 500, 600, 700. Modern, friendly, highly legible.
- **Body:** Same font family, weight 400.
- **Fallback:** `system-ui, -apple-system, sans-serif`

Load via Google Fonts in `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Accessibility

Gathered must meet WCAG 2.1 Level AA throughout. The following requirements are non-negotiable and apply to every screen.

#### Contrast
- Normal text (< 18pt / 14pt bold): minimum **4.5:1** against its background
- Large text (≥ 18pt or 14pt bold): minimum **3:1**
- UI components, icons, and input borders: minimum **3:1**
- All color token pairs are pre-verified in the Design System above (light and dark). Do not introduce new color combinations that haven't been checked.

#### Interactive Elements
- Every interactive element must have a visible **focus style** — a 2px solid outline in `--brand-start`, offset by 2px. Never use `outline: none` without a custom replacement.
- Every button, link, and interactive element must have a minimum tap target of **44×44px**, even if the visual element is smaller (use padding or a pseudo-element to expand the hit area).
- All icon-only buttons (back arrow, close X, ··· menu, send, reactions) must have an `aria-label` describing their action. Example: `<button aria-label="Close post editor">×</button>`
- All form inputs must have an associated `<label>` element — either wrapping the input or linked via `for`/`id`. Placeholder text alone does not count as a label.
- Never use `alert()`, `confirm()`, or `prompt()` anywhere in the codebase. Use custom toast notifications and bottom sheet confirmations instead.

#### Semantic HTML
Use the correct HTML element for the job. Claude Code must not use `<div>` or `<span>` with `onclick` handlers in place of proper interactive elements.

| Element | Use for |
|---------|---------|
| `<nav>` | Bottom navigation bar |
| `<main>` | Primary content area (feed, profile, post detail) |
| `<article>` | Individual post cards |
| `<button>` | All clickable actions |
| `<a href>` | Navigation that changes the URL |
| `<h1>`–`<h3>` | Headings in correct hierarchy — never skip levels |
| `<ul>` / `<li>` | Comment lists, member lists, group chip rows |
| `<dialog>` or `role="dialog"` | Bottom sheets and modal overlays |
| `<time datetime="...">` | All timestamps (e.g. `<time datetime="2026-03-23">2 hours ago</time>`) |

#### Image Alt Text
Every `<img>` must have a meaningful `alt` attribute:
- If the photo has a caption: use the caption text as alt (`alt="Birthday cake at the party"`)
- If no caption: use `alt="{author's display name}'s photo"` (e.g. `alt="Sarah's photo"`)
- For UI icons and decorative images: use `alt=""` (empty string, not missing)
- Never use `alt="image"` or `alt="photo"` — these are meaningless to screen readers

#### ARIA Live Regions
Dynamic content that appears without a page reload must be announced to screen readers. Apply these attributes at app init and leave them in place permanently:

```html
<!-- Toast notification container — announces errors, confirmations, etc. -->
<div id="toast-region" aria-live="polite" aria-atomic="true"></div>

<!-- Feed container — announces when new posts arrive in real time -->
<div id="feed-list" aria-live="polite" aria-relevant="additions"></div>

<!-- Comment list — announces new comments -->
<div id="comment-list" aria-live="polite" aria-relevant="additions"></div>
```

Use `aria-live="assertive"` only for genuine errors that require immediate attention (e.g. upload failed). Use `aria-live="polite"` for everything else so announcements don't interrupt the user.

#### Focus Management in Modals and Bottom Sheets
When a bottom sheet or modal opens:
1. Move focus to the first focusable element inside the sheet (typically the close button or first input)
2. Trap tab focus inside the sheet — tabbing past the last element must wrap back to the first, not escape to the page behind
3. Pressing Escape must close the sheet and return focus to the element that triggered it
4. When the sheet closes, return focus to the triggering element

```javascript
// Minimal focus trap implementation
function trapFocus(element) {
  const focusable = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  element.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  first.focus();
}
```

Call `trapFocus(sheetElement)` whenever a bottom sheet or modal opens. Store a reference to the triggering element before opening so focus can be restored on close.

#### Screen Reader Testing Guidance
Before considering the build complete, manually verify these behaviors using VoiceOver (iOS) or TalkBack (Android):
- Navigating the feed by swiping reads post author, time, caption, and reaction counts
- Tapping the reaction button announces the reaction type and new count
- Opening a bottom sheet announces the sheet title
- Toasts are read aloud when they appear
- Image descriptions are read for each photo

---

## Firebase Services Used

| Service | Purpose |
|---------|---------|
| Firebase Auth | Google Sign-In only |
| Cloud Firestore | All structured data (users, groups, posts, comments, reactions) |
| Firebase Storage | Photo uploads |

No Firebase Functions, no Realtime Database, no hosting via Firebase (GitHub Pages handles hosting).

---

## Firestore Data Model

### `/users/{userId}`
```javascript
{
  uid: string,           // Firebase Auth UID
  displayName: string,   // From Google account
  email: string,
  photoURL: string,      // Google profile photo URL
  createdAt: timestamp,
  groupIds: [string],    // Array of group IDs the user belongs to
}
```

### `/groups/{groupId}`
```javascript
{
  id: string,            // Auto-generated
  name: string,          // e.g. "Smith Family"
  photoURL: string|null, // Group cover photo (Firebase Storage URL)
  createdBy: string,     // userId of creator
  createdAt: timestamp,
  members: {             // Map of userId → member object
    [userId]: {
      displayName: string,
      photoURL: string,
      role: 'admin' | 'member',  // creator is 'admin'
      joinedAt: timestamp,
    }
  },
  inviteToken: string,   // Random UUID — used in invite links
  memberCount: number,   // Denormalized for display
}
```

### `/groups/{groupId}/posts/{postId}`
```javascript
{
  id: string,
  authorId: string,
  authorName: string,
  authorPhotoURL: string,
  groupId: string,
  caption: string,       // Optional overall caption for the post
  photos: [              // Array of photo objects (1–10 photos per post)
    {
      url: string,       // Firebase Storage download URL
      storagePath: string, // Path in Storage (for deletion)
      caption: string,   // Optional per-photo caption
      width: number,     // Original dimensions (after compression)
      height: number,
    }
  ],
  reactionCounts: {      // Denormalized counts for display
    heart: number,
    haha: number,
    wow: number,
    sad: number,
  },
  commentCount: number,  // Denormalized
  createdAt: timestamp,
  editedAt: timestamp|null,  // null if never edited
}
```

### `/groups/{groupId}/posts/{postId}/comments/{commentId}`
```javascript
{
  id: string,
  authorId: string,
  authorName: string,
  authorPhotoURL: string,
  text: string,
  createdAt: timestamp,
}
```

### `/groups/{groupId}/posts/{postId}/reactions/{userId}`
```javascript
{
  userId: string,
  type: 'heart' | 'haha' | 'wow' | 'sad',
  createdAt: timestamp,
}
```

---

## Firestore Security Rules

Generate the following security rules in a `firestore.rules` file. The user will paste these into the Firebase Console.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can read any user profile, but only write their own
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Groups
    match /groups/{groupId} {
      // Any authenticated user can read a group they are a member of
      allow read: if request.auth != null &&
        request.auth.uid in resource.data.members;

      // Any authenticated user can create a group
      allow create: if request.auth != null;

      // Only group admins can update group data
      allow update: if request.auth != null &&
        resource.data.members[request.auth.uid].role == 'admin';

      // Only group admins can delete a group
      allow delete: if request.auth != null &&
        resource.data.members[request.auth.uid].role == 'admin';

      // Posts subcollection
      match /posts/{postId} {
        // Only group members can read posts
        allow read: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/groups/$(groupId)).data.members;

        // Only group members can create posts
        allow create: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/groups/$(groupId)).data.members;

        // Only post author or group admin can update/delete
        allow update, delete: if request.auth != null && (
          request.auth.uid == resource.data.authorId ||
          get(/databases/$(database)/documents/groups/$(groupId)).data.members[request.auth.uid].role == 'admin'
        );

        // Comments subcollection
        match /comments/{commentId} {
          allow read: if request.auth != null &&
            request.auth.uid in get(/databases/$(database)/documents/groups/$(groupId)).data.members;
          allow create: if request.auth != null &&
            request.auth.uid in get(/databases/$(database)/documents/groups/$(groupId)).data.members;
          allow update, delete: if request.auth != null &&
            request.auth.uid == resource.data.authorId;
        }

        // Reactions subcollection
        match /reactions/{userId} {
          allow read: if request.auth != null &&
            request.auth.uid in get(/databases/$(database)/documents/groups/$(groupId)).data.members;
          // Users can only write their own reaction
          allow write: if request.auth != null && request.auth.uid == userId;
        }
      }
    }
  }
}
```

### Firebase Storage Rules

Generate a `storage.rules` file:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Group photos: only members can read/write
    match /groups/{groupId}/posts/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.size < 10 * 1024 * 1024  // 10MB max per file
        && request.resource.contentType.matches('image/.*');
    }

    // Group cover photos
    match /groups/{groupId}/cover/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }

    // User profile photos (if needed)
    match /users/{userId}/avatar/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## PWA Configuration

### manifest.json
```json
{
  "name": "Gathered",
  "short_name": "Gathered",
  "description": "Share photos privately with family and friends. No ads, no algorithm.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f8f9fb",
  "theme_color": "#3a4fd4",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/apple-touch-icon.png",
      "sizes": "180x180",
      "type": "image/png"
    }
  ]
}
```

Note: If deploying to a GitHub Pages subdirectory (e.g. `username.github.io/gathered/`), update `start_url` to `"/gathered/"` and all icon `src` paths accordingly.

### Service Worker (sw.js)

Use a **cache-first** strategy for the app shell. Network-first for Firestore/Firebase API calls (those are handled by the Firebase SDK directly — do not intercept them).

**Precache these files on install:**
```javascript
const CACHE_NAME = 'gathered-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/css/auth.css',
  '/css/feed.css',
  '/css/post.css',
  '/css/profile.css',
  '/css/groups.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/feed.js',
  '/js/post.js',
  '/js/profile.js',
  '/js/groups.js',
  '/js/storage.js',
  '/js/utils.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];
```

**Do NOT intercept** requests to:
- `firestore.googleapis.com`
- `firebase.googleapis.com`
- `storage.googleapis.com`
- `accounts.google.com`
- `fonts.googleapis.com` (use stale-while-revalidate for these)

Register the service worker in `app.js`:
```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .catch(err => console.warn('SW registration failed:', err));
  });
}
```

### index.html head
```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<meta name="theme-color" content="#3a4fd4">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Gathered">
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
```

---

## App Icons

The provided `gathered.png` file is the source icon. Generate three sizes from it:
- `icons/icon-192.png` — 192×192px
- `icons/icon-512.png` — 512×512px
- `icons/apple-touch-icon.png` — 180×180px

Use sharp, canvas, or any image processing available to resize. The icon has a transparent/checkered background in the source — ensure final PNGs have the rounded square shape filled with the blue-to-orange gradient (matching the icon itself), not a transparent background.

---

## Authentication (js/auth.js)

Use **Firebase Auth with Google Sign-In only.** No email/password auth.

### Sign-In Screen
Shown to unauthenticated users. Full-screen, centered layout.

**Contents:**
- Gathered app icon (120×120px)
- App name "Gathered" in large heading
- Tagline: "Share moments with the people who matter."
- "Sign in with Google" button — standard Google branding (white background, Google logo, "Sign in with Google" text per Google's brand guidelines)
- Small print: "By signing in you agree to keep this space kind and private."

**Sign-in flow:**
```javascript
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const provider = new GoogleAuthProvider();
const result = await signInWithPopup(auth, provider);
```

On successful sign-in:
1. Check if user document exists in `/users/{uid}`
2. If not, create it with data from `result.user`
3. Navigate to main app

### Sign-Out
Available from the profile screen. Call `auth.signOut()`, clear local state, redirect to sign-in screen.

### Auth State Listener
In `app.js`, listen to `onAuthStateChanged`. If user is null, show auth screen. If user exists, initialize app and show main navigation.

---

## Navigation

Single-page app. No URL routing required. Screens are shown/hidden via JavaScript.

### Bottom Navigation Bar
Fixed at bottom. Four tabs:

| Tab | Icon | Label | Screen |
|-----|------|-------|--------|
| Feed | 🏠 | Home | Main feed for current group |
| Search | 🔍 | Search | Search posts/people in group (v2 — show "Coming soon" placeholder for now) |
| Post | ➕ | (no label — FAB style) | Create post sheet |
| Profile | 👤 | Profile | Current user's profile |

The center "Post" tab is styled as a gradient FAB button embedded in the nav bar, elevated above the bar. Tapping it opens the Create Post bottom sheet.

### Group Switcher
At the top of the Feed screen, a horizontally scrollable row of group chips/pills. Tapping a chip switches the active group. The active group is highlighted. A "＋ New" chip at the end opens the Create Group flow.

---

## Screens

### 1. Feed (Home)

**Top bar:**
- App name "Gathered" on the left (DM Sans, 22px, 600 weight)
- Right: notification bell icon (v2 placeholder) + group settings gear (if user is admin of current group)

**Group switcher:**
- Horizontal scroll row of group name pills
- Active group: gradient background, white text
- Inactive: surface-2 background, text-secondary
- "＋" button at end to create or join a group

**Feed list:**
- Chronological, newest first
- Real-time listener via Firestore `onSnapshot`
- Each post card (see Post Card spec below)
- Pull-to-refresh gesture support
- Infinite scroll — load 20 posts at a time, load more when user nears bottom

**Empty state (no groups):**
- Illustration or icon
- "You're not in any groups yet."
- Two buttons: "Create a group" and "Join with invite link"

**Empty state (group has no posts):**
- "Nothing shared yet. Be the first to post!"
- Arrow pointing to the Post FAB

### Post Card
```
┌──────────────────────────────────────┐
│ [Avatar] Name · 2 hours ago    [···] │  ← author row. ··· = options menu
│                                      │
│ [Photo(s) — full width]              │  ← single photo or carousel
│                                      │
│ Caption text here                    │
│                                      │
│ ❤️ 3  😂 1  😮 0  😢 0    💬 5 comments │  ← reaction row + comment count
└──────────────────────────────────────┘
```

**Photo display:**
- Single photo: full card width, aspect ratio preserved, max height 400px, object-fit cover
- Multiple photos: horizontal carousel with dot indicators. Swipeable on touch.

**Reaction row:**
- Four emoji reactions: ❤️ Heart, 😂 Haha, 😮 Wow, 😢 Sad
- Tapping a reaction toggles it (add/remove your reaction)
- If user has already reacted, their reaction type is highlighted
- Counts shown next to each emoji
- Tapping the comment count or "N comments" opens Post Detail

**Author options (···):**
- Post author sees: "Edit post" and "Delete post"
- Group admin sees: "Delete post" (for any post, but only "Edit post" for their own)
- Others: no menu shown

### 2. Post Detail

Full screen view of a single post.

**Top:** back arrow + "Post" title

**Photo viewer:**
- Full-width swipeable photo carousel
- Per-photo captions shown below each photo if set
- Dot indicators

**Post caption** (if set) below photos

**Reaction bar** — same as feed card

**Comments section:**
- All comments, oldest first
- Each comment: avatar + name (bold) + comment text + time
- "Be the first to comment" empty state
- Comment input fixed at bottom of screen (above keyboard when focused):
  - User avatar (small, 32px)
  - Text input: "Add a comment..."
  - Send button (gradient, disabled until text entered)

**Delete comment:** long-press own comment → confirm delete

---

### 2b. Edit Post (Bottom Sheet)

Tapping "Edit post" from the ··· menu opens a bottom sheet pre-populated with the post's existing content.

**What can be edited:**
- Overall post caption
- Per-photo captions

**What cannot be edited:**
- The photos themselves (adding or removing photos is not supported in v1 editing)
- The group the post was shared to

**Layout:** identical to the Create Post sheet's Step 2 (captions only), but with existing values pre-filled.

**Save button:** "Save changes" — full-width, gradient background. Disabled if nothing has changed.

**On save:**
```javascript
await updateDoc(doc(db, 'groups', groupId, 'posts', postId), {
  caption: newCaption,
  'photos': updatedPhotosArray,  // only captions updated, URLs unchanged
  editedAt: serverTimestamp(),
});
```

**Edited indicator:** Posts that have been edited show a small "Edited" label in muted text next to the timestamp on the post card and in Post Detail. This keeps things honest without being intrusive.

**Cancel:** X button at top right. If changes were made, show a "Discard changes?" confirmation sheet before closing.

---

### 3. Create Post (Bottom Sheet)

Slides up from bottom. Full-height on small phones.

**Steps:**

**Step 1 — Select Photos**
- Large "tap to select photos" area
- Native file picker: `<input type="file" accept="image/*" multiple>`
- After selection: thumbnail grid of selected photos (up to 10)
- Tap thumbnail to remove it
- Tap "+" to add more (up to 10 total)
- Selected count shown: "3 of 10 photos"

**Step 2 — Add Captions**
- Overall post caption textarea: "What's happening?" placeholder
- Below each thumbnail: optional per-photo caption input (small, collapsible)
- "Post to [Group Name]" dropdown if user is in multiple groups (defaults to current active group)

**Post button:**
- "Share with [Group Name]"
- Full-width, gradient background
- Shows upload progress bar while uploading

**Cancel:** X button at top right, confirms if photos are selected

### Image Compression (js/storage.js)

Before uploading, compress all images client-side using the Canvas API:

```javascript
async function compressImage(file, maxDimension = 1920, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // Scale down if larger than maxDimension
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          resolve(blob);
        },
        'image/jpeg',
        quality
      );
    };
    img.src = url;
  });
}
```

Target output: images under 500KB for typical phone photos. This gives ~10x more runway on Firebase's 5GB free storage tier.

**Upload path in Firebase Storage:**
`groups/{groupId}/posts/{postId}/{index}.jpg`

---

### 4. Profile Screen

Shows the current user's profile and their posts.

**Header:**
- Large avatar (80px circle) — Google profile photo
- Display name (large, bold)
- Email (muted)
- "X posts" count
- Groups the user is in (small chips)
- "Sign Out" button (text style, muted, at bottom of header)

**Posts grid:**
- Instagram-style 3-column grid of post thumbnails
- Tap thumbnail → opens Post Detail
- Empty state: "You haven't posted yet. Share your first moment!"

**Theme selector:**
- Shown in the profile header section, below the user info
- Label: "Appearance"
- Three segmented button options: ☀️ Light · 🌙 Dark · 🔁 System
- Active option highlighted with gradient background
- Selection persists in localStorage and applies immediately

**Viewing other users' profiles:**
- Same layout but without sign-out button or theme selector
- Navigate to by tapping author name/avatar on any post card

---

### 5. Group Management

#### Create Group Screen
- Group name field (required)
- Group cover photo (optional — tap to upload)
- "Create Group" button
- On create: generates a random `inviteToken` (UUID), creates Firestore document, adds creator as admin member

#### Group Settings Screen (admin only, accessible via gear icon on feed)

**Sections:**

**Group Info**
- Editable group name
- Group cover photo (tap to change)
- "Save changes" button

**Members list**
- Each member row: avatar + name + joined date + role badge
- Admin members have a crown icon
- Remove member button (×) on each row (admin only, cannot remove self if sole admin)
- Confirmation sheet before removing: "Remove [Name] from [Group]? They will lose access to all posts in this group."

**Invite Link**
- Displays current invite link: `https://[your-github-pages-url]/join?token={inviteToken}`
- "Copy Link" button
- "Reset Link" button — generates new inviteToken, invalidates old link
- Explanation: "Anyone with this link can join your group."

**Danger Zone**
- "Delete Group" button (danger style)
- Confirmation: "This will permanently delete all posts and photos in this group."

#### Join Group Flow
When a user opens the app with `?token=xxx` in the URL:
1. If not signed in → sign in first, then process token
2. Look up group where `inviteToken == token`
3. If found and user is not already a member → show join confirmation screen:
   - Group name and cover photo
   - Member count
   - "Join [Group Name]" button
4. On confirm: add user to `group.members`, add groupId to `user.groupIds`
5. Navigate to the group feed

---

## Image Gallery / Carousel

For multi-photo posts, implement a touch-swipeable carousel using pointer events (no library needed):

```javascript
// Minimal swipe detection
let startX = 0;
carousel.addEventListener('pointerdown', e => { startX = e.clientX; });
carousel.addEventListener('pointerup', e => {
  const diff = e.clientX - startX;
  if (Math.abs(diff) > 50) {
    diff < 0 ? nextPhoto() : prevPhoto();
  }
});
```

Full-screen photo viewer: tapping a photo in detail view opens a full-screen overlay with pinch-to-zoom (use CSS `touch-action: manipulation` and the native browser zoom behavior — no need to implement custom pinch zoom).

---

## Real-Time Updates

Use Firestore `onSnapshot` for the feed so new posts appear without refresh:

```javascript
const q = query(
  collection(db, 'groups', groupId, 'posts'),
  orderBy('createdAt', 'desc'),
  limit(20)
);

const unsubscribe = onSnapshot(q, (snapshot) => {
  snapshot.docChanges().forEach(change => {
    if (change.type === 'added') prependPostCard(change.doc);
    if (change.type === 'modified') updatePostCard(change.doc);
    if (change.type === 'removed') removePostCard(change.doc.id);
  });
});
```

Unsubscribe when navigating away from the feed to avoid memory leaks.

---

## Offline Behavior

Firebase SDK handles Firestore offline caching automatically. Enable persistence:

```javascript
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});
```

When offline:
- Previously loaded feed content is visible
- Posting is disabled — show a "You're offline" toast if user tries to post
- Comment/reaction attempts queue and sync when back online (Firestore handles this automatically)

---

## Toast Notifications

A simple toast system for user feedback. Show toasts for:
- "Post shared!" (success)
- "Comment deleted"
- "Copied invite link!"
- "You're offline — posts will sync when reconnected"
- Error states: "Something went wrong. Please try again."

Implementation: a fixed `div` at top of screen, slides down, auto-dismisses after 3 seconds. Stack multiple toasts if needed.

---

## Loading States

Every async operation must have a loading state:
- Feed initial load: skeleton cards (grey pulsing placeholder shapes matching card layout)
- Photo upload: progress bar in the create post sheet (0–100% based on Firebase Storage upload task)
- Post submit button: disabled + spinner while uploading
- Profile grid: skeleton grid squares while loading
- Comments: skeleton rows while loading

---

## Validation Rules

| Field | Rule |
|-------|------|
| Group name | Required, 1–50 characters |
| Post caption | Optional, max 500 characters |
| Per-photo caption | Optional, max 200 characters |
| Comment | Required, 1–500 characters, trimmed |
| Photos per post | 1–10 images |
| Photo file size (pre-compression) | No hard limit — compression handles it |
| Photo file type | image/* only |

---

## Error Handling

- Wrap all Firebase calls in try/catch
- Show user-friendly toast messages — never show raw Firebase error codes
- Network errors: "Check your connection and try again."
- Permission errors: "You don't have permission to do that."
- Not found: "This content no longer exists."
- Log errors to console in development

---

## firebase-config.js

This file is filled in by the user (see README Firebase Setup section). Structure:

```javascript
// firebase-config.js
// Copy your Firebase project config here from the Firebase Console
// Settings → General → Your apps → Web app → SDK setup and configuration

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});
```

---

## .gitignore

```
firebase-config.js
node_modules/
.env
.DS_Store
```

---

## README.md

The README must include the following sections:

### Header
- App name, logo, one-line description
- License badge (PolyForm Noncommercial)
- Screenshot or demo GIF (placeholder note if not available yet)

### What is Gathered?
2–3 paragraph description of the app and its philosophy (no ads, no algorithm, private groups).

### Features
Bullet list of v1 features.

### For Users: Getting Started
How to install the PWA on iOS (Safari → Share → Add to Home Screen) and Android (Chrome → menu → Add to Home Screen).

### For Developers: Self-Hosting Your Own Instance

This is the key section for people who want to run their own copy. Include:

#### Step 1 — Fork the Repository
Instructions to fork on GitHub.

#### Step 2 — Create a Firebase Project

**Exact step-by-step with console navigation:**

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Enter a project name (e.g. "gathered-myfamily") → Continue
4. Disable Google Analytics (not needed) → **Create project**
5. Wait for project creation → Click **Continue**

**Enable Google Sign-In:**
1. In the left sidebar, click **Build → Authentication**
2. Click **"Get started"**
3. Under **Sign-in method**, click **Google**
4. Toggle **Enable** to on
5. Enter a support email (your email) → Click **Save**

**Create a Firestore Database:**
1. In the left sidebar, click **Build → Firestore Database**
2. Click **"Create database"**
3. Select **"Start in production mode"** → Next
4. Choose a location (pick the region closest to your users, e.g. `us-central`) → **Enable**
5. Once created, click the **Rules** tab
6. Replace the existing rules with the contents of `firestore.rules` from this repo
7. Click **Publish**

**Enable Firebase Storage:**
1. In the left sidebar, click **Build → Storage**
2. Click **"Get started"**
3. Select **"Start in production mode"** → Next
4. Accept the default storage location → **Done**
5. Once created, click the **Rules** tab
6. Replace the existing rules with the contents of `storage.rules` from this repo
7. Click **Publish**

**Get your Firebase config:**
1. Click the **gear icon** (⚙️) next to "Project Overview" → **Project settings**
2. Scroll down to **"Your apps"**
3. Click the **web icon** (`</>`)
4. Enter an app nickname (e.g. "gathered-web") → Click **Register app**
5. You will see a `firebaseConfig` object. Copy it — you'll need it in the next step.

**Add your GitHub Pages domain to authorized domains:**
1. Go back to **Build → Authentication → Settings → Authorized domains**
2. Click **"Add domain"**
3. Enter your GitHub Pages domain: `YOUR-USERNAME.github.io`
4. Click **Add**

#### Step 3 — Configure the App
1. Copy `firebase-config.example.js` → rename to `firebase-config.js`
2. Paste your Firebase config values into the file
3. **Do not commit `firebase-config.js`** — it is in `.gitignore`

#### Step 4 — Deploy to GitHub Pages
1. Push all files to your GitHub repository's `main` branch
2. Go to repository **Settings → Pages**
3. Under **Source**, select **Deploy from a branch**
4. Select `main` branch, `/ (root)` folder → **Save**
5. Wait 1–3 minutes → your app is live at `https://YOUR-USERNAME.github.io/gathered/`

#### Step 5 — Update start_url (if using subdirectory)
If your app is at `username.github.io/gathered/` (not a root domain):
1. Open `manifest.json` — change `"start_url": "/"` to `"start_url": "/gathered/"`
2. Open `sw.js` — update all cached paths to include `/gathered/` prefix
3. Push the update

#### Firebase Free Tier Limits
Explain the Firebase Spark (free) tier limits:
- 1GB Firestore storage
- 5GB Firebase Storage
- 50,000 Firestore reads/day
- 20,000 Firestore writes/day
- 1GB/day Storage downloads

For a family group of 10–20 people sharing casual photos, this is typically sufficient indefinitely. The app automatically compresses photos before upload to maximize storage efficiency.

### License
PolyForm Noncommercial License 1.0. Free for personal and family use. Commercial use requires a separate license — contact [repository owner].

### Contributing
Standard open source contributing note.

---

## Things NOT in v1

Do not build these. Deferred to v2:

- Push notifications (Web Push API)
- Video upload support
- Search within a group
- @mentions in comments
- Read receipts
- Direct messaging
- Group discovery / public groups

---

## Testing Checklist

Before considering the build complete, verify all of the following:

**Auth:**
- [ ] Sign in with Google works on mobile browser
- [ ] Signing out clears state and returns to sign-in screen
- [ ] User document created in Firestore on first sign-in
- [ ] Returning user's data loads correctly

**Groups:**
- [ ] Create group saves to Firestore with creator as admin
- [ ] Invite link includes correct token
- [ ] Joining via invite link adds user to group members
- [ ] Admin can remove a member
- [ ] Removed member loses access to feed
- [ ] Admin can reset invite link (old link no longer works)
- [ ] Group name is editable and saves

**Posts:**
- [ ] Single photo post creates correctly
- [ ] Multi-photo post (up to 10) creates correctly
- [ ] Photos are compressed before upload (verify file sizes in Firebase Console)
- [ ] Upload progress bar shows during upload
- [ ] Post appears in feed immediately via real-time listener
- [ ] Caption appears correctly
- [ ] Per-photo captions appear in detail view
- [ ] Author can delete their own post
- [ ] Group admin can delete any post
- [ ] Deleting post removes photos from Firebase Storage

**Reactions:**
- [ ] Tapping a reaction adds it
- [ ] Tapping the same reaction removes it
- [ ] Counts update in real time
- [ ] User's active reaction is visually highlighted
- [ ] Only one reaction type per user per post

**Comments:**
- [ ] Adding a comment saves and appears
- [ ] Comment count updates on post card
- [ ] Author can delete their own comment
- [ ] Long pressing own comment shows delete option

**Profile:**
- [ ] Profile shows correct post count
- [ ] Post grid shows user's posts
- [ ] Tapping post in grid opens detail view
- [ ] Tapping author name/avatar navigates to their profile

**PWA:**
- [ ] App installs to iOS home screen via Safari
- [ ] App installs to Android home screen via Chrome
- [ ] App launches full-screen (no browser chrome) after install
- [ ] App icon appears correctly (Gathered icon, not blank)
- [ ] Previously loaded feed is visible when offline
- [ ] "You're offline" message shows when trying to post offline

**Accessibility:**
- [ ] All text passes WCAG AA contrast (4.5:1 minimum) in light mode
- [ ] All text passes WCAG AA contrast (4.5:1 minimum) in dark mode
- [ ] All icon-only buttons have `aria-label` attributes
- [ ] All form inputs have associated `<label>` elements
- [ ] Keyboard navigation works for all interactive elements
- [ ] Focus styles are visible on every interactive element (never hidden with `outline:none`)
- [ ] Minimum 44×44px tap target on all buttons and links
- [ ] Bottom sheets trap focus when open — tab cannot escape to background
- [ ] Escape key closes bottom sheets and returns focus to trigger element
- [ ] Toast notifications are announced by screen readers (`aria-live` region)
- [ ] New feed posts announced when they arrive in real time
- [ ] Every photo has a meaningful `alt` attribute (caption or author fallback)
- [ ] Correct semantic elements used throughout (`<nav>`, `<main>`, `<article>`, `<button>`, `<time>`)
- [ ] No `<div onclick>` or `<span onclick>` used in place of `<button>`
- [ ] No `alert()`, `confirm()`, or `prompt()` calls anywhere
- [ ] Heading hierarchy is correct — no skipped levels (h1 → h2 → h3)

**General:**
- [ ] No `alert()`, `confirm()`, or `prompt()` anywhere
- [ ] No console errors on normal usage
- [ ] Loading skeletons show before content loads
- [ ] All error states show friendly messages
- [ ] App works correctly on iOS Safari, Android Chrome, and desktop Chrome

**Post editing:**
- [ ] "Edit post" appears in ··· menu for post author
- [ ] Edit sheet pre-populates with existing caption and per-photo captions
- [ ] Saving updates Firestore and reflects immediately in feed and detail view
- [ ] "Edited" label appears on edited posts
- [ ] Photos cannot be added or removed via edit
- [ ] "Discard changes?" confirmation shown when cancelling with unsaved changes

**Theme / dark mode:**
- [ ] System mode respects OS dark/light preference
- [ ] Manual light and dark modes override OS preference
- [ ] Theme preference persists across sessions (localStorage)
- [ ] No flash of wrong theme on load (inline script in head)
- [ ] All text passes WCAG AA contrast in both light and dark modes
- [ ] Theme selector visible on profile screen
