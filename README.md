# Gathered

**Private photo sharing for family and friends. No ads. No algorithm. Just the people you choose.**

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-blue)](https://polyformproject.org/licenses/noncommercial/1.0.0/)

---

## What is Gathered?

Gathered is a mobile-first Progressive Web App for sharing photos with private groups of family and friends. Install it on your home screen like a native app — no App Store, no Play Store, no waiting.

The feed is strictly chronological, newest first. No algorithm decides what you see. No ads compete for your attention. No strangers can find your photos. Every post goes only to the group you choose, and only people you invite can join.

Gathered is designed to stay within Firebase's free tier for small family groups — 10–20 people sharing casual photos can typically run it indefinitely at zero cost. Photos are compressed client-side before upload, giving you roughly 10× more storage runway on Firebase's 5 GB free limit.

---

## Features

- **Google Sign-In** — one tap to sign in, no passwords
- **Private groups** — invite-only via shareable link; nothing is public
- **Photo posts** — up to 10 photos per post, with optional captions per photo
- **Real-time feed** — new posts appear instantly via Firestore live listeners
- **Reactions** — ❤️ 😂 😮 😢 with live counts
- **Comments** — threaded under each post with live updates
- **Edit posts** — update captions after publishing (photos cannot be changed)
- **Delete posts** — authors and group admins can delete any post
- **Group management** — rename group, manage members, reset invite link, delete group
- **Dark mode** — system, light, or dark — your choice, remembered across sessions
- **Installable PWA** — add to home screen on iOS and Android
- **Offline support** — previously loaded content available offline; Firestore queues writes automatically
- **Accessible** — WCAG 2.1 AA, keyboard navigable, screen-reader friendly

---

## For Users: Getting Started

### Install on iPhone / iPad
1. Open the app URL in **Safari**
2. Tap the **Share** button (box with arrow pointing up)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** — the Gathered icon appears on your home screen

### Install on Android
1. Open the app URL in **Chrome**
2. Tap the **⋮ menu** (three dots, top right)
3. Tap **"Add to Home screen"**
4. Tap **"Add"**

### Joining a Group
If someone sent you an invite link, just open it in your browser. Sign in with Google if prompted, then tap **"Join [Group Name]"**.

---

## For Developers: Self-Hosting Your Own Instance

Anyone can host their own private Gathered instance for free using GitHub Pages and Firebase's free Spark tier.

### Step 1 — Fork the Repository

1. Click **Fork** at the top of this repository page
2. Give it any name (e.g. `gathered-myfamily`)
3. Clone it to your computer

### Step 2 — Create a Firebase Project

#### Create the project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Enter a project name (e.g. `gathered-myfamily`) → Continue
4. Disable Google Analytics (not needed) → **Create project**
5. Wait for project creation → Click **Continue**

#### Enable Google Sign-In
1. In the left sidebar: **Build → Authentication**
2. Click **"Get started"**
3. Under **Sign-in method**, click **Google**
4. Toggle **Enable** to on
5. Enter a support email → **Save**

#### Create a Firestore Database
1. In the left sidebar: **Build → Firestore Database**
2. Click **"Create database"**
3. Select **"Start in production mode"** → Next
4. Choose a region close to your users (e.g. `us-central`) → **Enable**
5. Once created, click the **Rules** tab
6. Replace the existing rules with the contents of `firestore.rules` from this repo
7. Click **Publish**

#### Enable Firebase Storage
1. In the left sidebar: **Build → Storage**
2. Click **"Get started"**
3. Select **"Start in production mode"** → Next
4. Accept the default storage location → **Done**
5. Once created, click the **Rules** tab
6. Replace the existing rules with the contents of `storage.rules` from this repo
7. Click **Publish**

#### Get your Firebase config
1. Click the **⚙️ gear icon** next to "Project Overview" → **Project settings**
2. Scroll down to **"Your apps"**
3. Click the **web icon** (`</>`)
4. Enter an app nickname (e.g. `gathered-web`) → **Register app**
5. Copy the `firebaseConfig` object shown — you'll need it next

#### Authorize your GitHub Pages domain
1. Go to **Build → Authentication → Settings → Authorized domains**
2. Click **"Add domain"**
3. Enter your GitHub Pages domain: `YOUR-USERNAME.github.io`
4. Click **Add**

---

### Step 3 — Configure the App

1. Copy `firebase-config.example.js` and rename the copy to `firebase-config.js`
2. Open `firebase-config.js` and paste your Firebase config values:

```javascript
const firebaseConfig = {
  apiKey:            "AIza...",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

3. **Do not commit `firebase-config.js`** — it is already in `.gitignore`

---

### Step 4 — Deploy to GitHub Pages

1. Push all files (except `firebase-config.js`) to your repository's `main` branch
2. Go to your repository on GitHub → **Settings → Pages**
3. Under **Source**, select **"Deploy from a branch"**
4. Select `main` branch, `/ (root)` folder → **Save**
5. Wait 1–3 minutes → your app is live at `https://YOUR-USERNAME.github.io/gathered/`

---

### Step 5 — Update paths if using a subdirectory

If your app lives at `username.github.io/gathered/` (not a root custom domain), update two files:

**manifest.json** — change `start_url`:
```json
"start_url": "/gathered/"
```

**sw.js** — add the `/gathered/` prefix to every path in `APP_SHELL`:
```javascript
const APP_SHELL = [
  '/gathered/',
  '/gathered/index.html',
  '/gathered/manifest.json',
  // ... etc
];
```

Then push the update.

---

### Firebase Free Tier Limits (Spark Plan)

| Resource | Free limit |
|----------|-----------|
| Firestore storage | 1 GB |
| Firestore reads | 50,000 / day |
| Firestore writes | 20,000 / day |
| Firebase Storage | 5 GB |
| Storage downloads | 1 GB / day |

For a family group of 10–20 people sharing casual photos, these limits are typically sufficient indefinitely. Gathered compresses photos to JPEG before upload (targeting < 500 KB each), which gives roughly 10,000 compressed photos before hitting the 5 GB storage limit.

---

## License

[PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)

Free for personal and family use. Commercial use requires a separate license — open an issue to discuss.

---

## Contributing

Bug reports and pull requests are welcome. Please open an issue first to discuss what you'd like to change. Keep pull requests focused and small.
