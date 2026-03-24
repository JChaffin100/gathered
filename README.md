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

Anyone can host their own private Gathered instance for free using GitHub Pages and Firebase's free Spark tier. This guide prioritizes security — your Firebase credentials are stored as encrypted GitHub Secrets and never committed to the repository.

**What you'll need:**
- A free [GitHub account](https://github.com)
- A free [Google account](https://accounts.google.com) (for Firebase)
- About 30 minutes

---

### Step 1 — Fork the Repository

1. Click **Fork** at the top of this repository page
2. Give it any name (e.g. `gathered-myfamily`)
3. Keep it **Public** — required for free GitHub Pages and free GitHub Actions

---

### Step 2 — Create a Firebase Project

#### 2a. Create the project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Enter a project name (e.g. `gathered-myfamily`) → Continue
4. Disable Google Analytics (not needed) → **Create project**
5. Wait for project creation → Click **Continue**

#### 2b. Enable Google Sign-In
1. In the left sidebar: **Build → Authentication**
2. Click **"Get started"**
3. Under **Sign-in method**, click **Google**
4. Toggle **Enable** to on
5. Enter a support email (your email address) → **Save**

#### 2c. Create a Firestore Database
1. In the left sidebar: **Build → Firestore Database**
2. Click **"Create database"**
3. Select **"Start in production mode"** → Next
4. Choose a region close to your users (e.g. `us-central`) → **Enable**
5. Once created, click the **Rules** tab
6. Replace the existing rules with the full contents of `firestore.rules` from this repo
7. Click **Publish**

#### 2d. Enable Firebase Storage
1. In the left sidebar: **Build → Storage**
2. Click **"Get started"**
3. Select **"Start in production mode"** → Next
4. Accept the default storage location → **Done**
5. Once created, click the **Rules** tab
6. Replace the existing rules with the full contents of `storage.rules` from this repo
7. Click **Publish**

#### 2e. Register a Web App and get your config
1. Click the **⚙️ gear icon** next to "Project Overview" → **Project settings**
2. Scroll down to **"Your apps"** section
3. Click the **web icon** (`</>`)
4. Enter an app nickname (e.g. `gathered-web`) → **Register app**
5. You will see a `firebaseConfig` object — **copy and save these values somewhere safe** (a password manager works well). You will need them in Step 4.
6. Click **Continue to console**

#### 2f. Authorize your GitHub Pages domain
1. Go to **Build → Authentication → Settings → Authorized domains**
2. Click **"Add domain"**
3. Enter your GitHub Pages domain: `YOUR-USERNAME.github.io`
4. Click **Add**

---

### Step 3 — Harden Your Firebase Security

These steps protect your Firebase project even if your config values are ever seen by someone else. Do not skip them.

#### 3a. Restrict your API key to your domain only

Your Firebase `apiKey` is not a traditional secret, but restricting it to your domain means it cannot be used from any other website or script.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Make sure your Firebase project is selected in the top project dropdown
3. In the left sidebar: **APIs & Services → Credentials**
4. Under **API Keys**, click on your key (named something like "Browser key (auto created by Firebase)")
5. Under **Application restrictions**, select **"Websites"**
6. Click **"Add an item"** and enter: `https://YOUR-USERNAME.github.io/*`
7. Click **Done** → **Save**

Now your API key will be rejected if anyone tries to use it from a different domain.

#### 3b. Enable Firebase App Check

App Check enforces that only your app — running on your approved domain — can access your Firebase project. Even if someone copies your config values, they cannot use them from their own site.

1. In the Firebase Console left sidebar: **Build → App Check**
2. Click **"Get started"**
3. Select your web app from the list
4. Under **reCAPTCHA v3**, click **"Manage"**
5. Follow the link to the [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
6. Click **"+"** to register a new site
   - Label: `Gathered`
   - reCAPTCHA type: **Score based (v3)**
   - Domain: `YOUR-USERNAME.github.io`
   - Accept the terms → **Submit**
7. Copy the **Site Key** shown
8. Return to Firebase App Check, paste the Site Key in → **Save**
9. Back in the App Check overview, click **"Enforce"** next to both **Firestore** and **Storage**

> ⚠️ **Before enforcing:** make sure your app is deployed and working (complete Steps 4–6 first). Enforcing App Check on a misconfigured app will lock everyone out, including you. You can always enforce it after confirming the app works.

#### 3c. Set a billing budget alert

This ensures you receive an email warning if usage ever approaches a chargeable level, giving you time to investigate before any cost is incurred.

1. Go to [console.cloud.google.com/billing](https://console.cloud.google.com/billing)
2. Select your project's billing account
3. Click **Budgets & alerts** in the left sidebar
4. Click **"Create budget"**
5. Set a budget amount of `$5`
6. Set alert thresholds at **50%** and **100%**
7. Make sure your email is listed under notification recipients
8. Click **Finish**

Firebase's free Spark tier does not charge you anything under normal family use, but this alert acts as an early warning system if something unexpected happens.

---

### Step 4 — Add Firebase Config as GitHub Secrets

Your Firebase config values live in GitHub's encrypted secret store — they are never written to any file in your repository and are not visible to anyone after you save them, including you.

1. Go to your forked repository on GitHub
2. Click **Settings → Secrets and variables → Actions**
3. Click **"New repository secret"** and add each of the following:

| Secret name | Where to find the value |
|---|---|
| `FIREBASE_API_KEY` | `apiKey` from your Firebase config |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` from your Firebase config |
| `FIREBASE_PROJECT_ID` | `projectId` from your Firebase config |
| `FIREBASE_STORAGE_BUCKET` | `storageBucket` from your Firebase config |
| `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` from your Firebase config |
| `FIREBASE_APP_ID` | `appId` from your Firebase config |

Secret names are **case-sensitive** — type them exactly as shown above. If you lose the values, you can retrieve them again from the Firebase Console (⚙️ → Project settings → Your apps).

---

### Step 5 — Enable GitHub Actions Deployment

GitHub Actions will automatically build and deploy your app every time you push to `main`. Your Firebase config is injected from your encrypted secrets at build time — it is never stored in the repository.

#### 5a. Configure GitHub Pages to use Actions

1. In your repository: **Settings → Pages**
2. Under **Source**, select **"GitHub Actions"**
3. Click **Save**

#### 5b. Grant Actions permission to deploy

1. In your repository: **Settings → Actions → General**
2. Scroll to **"Workflow permissions"**
3. Select **"Read and write permissions"**
4. Check **"Allow GitHub Actions to create and approve pull requests"**
5. Click **Save**

#### 5c. About the workflow file

The file `.github/workflows/deploy.yml` is already in the repository. It is safe to view and safe to commit publicly — it contains only references like `${{ secrets.FIREBASE_API_KEY }}`, never the actual values. When the workflow runs, GitHub substitutes the real values in memory on its build server. The values are never logged or stored anywhere.

#### 5d. Trigger your first deployment

1. Make any small edit to a file (e.g. update a line in README.md)
2. Commit and push to `main`
3. Go to your repository → **Actions** tab
4. You will see a workflow run appear — click it to watch the progress
5. Once it shows a green checkmark (usually under 60 seconds), your app is live

Your app is now available at: `https://YOUR-USERNAME.github.io/REPO-NAME/`

---

### Step 6 — Update Paths for Your Subdirectory

If your app lives at `username.github.io/gathered/` rather than a root custom domain, update two files:

**manifest.json** — change `start_url`:
```json
"start_url": "/gathered/"
```

**sw.js** — prefix every path in `APP_SHELL` with `/gathered/`:
```javascript
const APP_SHELL = [
  '/gathered/',
  '/gathered/index.html',
  '/gathered/manifest.json',
  // ... every other file, with the /gathered/ prefix
];
```

Commit and push — the workflow redeploys automatically.

---

### Step 7 — Enforce App Check (if you deferred it)

If you skipped enforcing App Check in Step 3b, now is the time:

1. Confirm your app is working correctly end-to-end
2. Go to **Firebase Console → Build → App Check**
3. Click **"Enforce"** next to Firestore and Storage
4. Test the app once more — sign in, post a photo, confirm everything still works

Once App Check is enforced, any request that doesn't originate from your approved domain will be blocked at the Firebase level, regardless of whether the caller has your config values.

---

### Step 8 — Verify Everything Works

Run through this checklist before sharing the link with family:

- [ ] App loads at your GitHub Pages URL
- [ ] Sign in with Google works
- [ ] You can create a group
- [ ] The invite link works (open it in an incognito window and join)
- [ ] You can post a photo
- [ ] The photo appears in the feed in real time
- [ ] Reactions and comments work
- [ ] You can edit a post caption
- [ ] Install to home screen works on your phone (iOS: Safari; Android: Chrome)
- [ ] App loads previously seen content when offline
- [ ] App Check is enforced on Firestore and Storage
- [ ] Budget alert email is set up

---

### Firebase Free Tier Limits (Spark Plan)

| Resource | Free limit |
|---|---|
| Firestore storage | 1 GB |
| Firestore reads | 50,000 / day |
| Firestore writes | 20,000 / day |
| Firebase Storage | 5 GB total |
| Storage downloads | 1 GB / day |
| GitHub Actions (public repo) | Unlimited — free |

For a family group of 10–20 people sharing casual photos, these limits are typically sufficient indefinitely. Gathered compresses photos before upload (targeting under 500 KB each), giving roughly 10,000 photos before hitting the 5 GB storage limit.

---

### Troubleshooting

**The Actions workflow fails**
Check the Actions tab for the specific error. The most common cause is a mistyped secret name — they are case-sensitive. Verify each name matches the table in Step 4 exactly.

**"Permission denied" errors in the app**
Your Firestore or Storage security rules may not have saved correctly. Re-open the Rules tab for each service, re-paste the contents of `firestore.rules` and `storage.rules`, and click Publish.

**"This domain is not authorized" on sign-in**
Your GitHub Pages domain is not in Firebase's authorized domains list. Go to **Build → Authentication → Settings → Authorized domains** and add `YOUR-USERNAME.github.io`.

**App installs but shows a blank screen**
The `start_url` in `manifest.json` or the cached paths in `sw.js` do not match your subdirectory. Follow Step 6.

**Photos upload but don't appear**
Check the browser console for errors. Most likely the Storage rules were not published correctly (Step 2d) or App Check is blocking requests before your domain was registered.

**App Check is blocking legitimate requests**
Make sure your GitHub Pages domain is registered in the reCAPTCHA Admin Console and in Firebase App Check. Double-check that the Site Key was entered correctly. You can temporarily switch App Check from "Enforce" to "Monitor" mode to diagnose without locking users out.

---

## License

[PolyForm Noncommercial License 1.0.0](LICENSE)

Free for personal and family use. Commercial use requires a separate license — open an issue to discuss.

---

## Contributing

Bug reports and pull requests are welcome. Please open an issue first to discuss what you'd like to change. Keep pull requests focused and small.
