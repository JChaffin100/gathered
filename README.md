# Gathered

**Private photo sharing for family and friends. No ads. No algorithm. Just the people you choose.**

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-blue)](https://polyformproject.org/licenses/noncommercial/1.0.0/)

> **Note:** This guide was last verified working in March 2026. Firebase has changed its pricing and setup requirements significantly in recent years — if something doesn't match these instructions, check the Firebase Console carefully as the UI and requirements may have changed.

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

Anyone can host their own private Gathered instance for free using Firebase Hosting and Firebase's free Spark tier. This guide prioritizes security — your Firebase credentials are stored as encrypted GitHub Secrets and never committed to the repository. Deployment is fully automated via GitHub Actions.

**What you'll need:**
- A free [GitHub account](https://github.com)
- A free [Google account](https://accounts.google.com) (for Firebase)
- [Node.js](https://nodejs.org) installed on your computer (for the Firebase CLI)
- About 45 minutes

**Important:** This app uses Firebase Hosting — not GitHub Pages. Firebase Hosting is required because Google Sign-In uses a redirect flow that depends on the app and the auth handler being on the same domain. GitHub Pages does not support this correctly due to browser third-party cookie and storage restrictions.

---

### Step 1 — Fork the Repository

1. Click **Fork** at the top of this repository page
2. Give it any name (e.g. `gathered-myfamily`)
3. Keep it **Public** — required for free GitHub Actions

---

### Step 2 — Create a Firebase Project

#### 2a. Create the project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Enter a project name (e.g. `gathered-myfamily`) → Continue
4. Disable Google Analytics (not needed) → **Create project**
5. Wait for project creation → Click **Continue**

#### 2b. Upgrade to Blaze (pay-as-you-go) plan
Firebase Storage now requires the Blaze plan to provision a new bucket. The free usage quota still applies — you will not be charged unless you exceed the free limits.

1. In the Firebase Console left sidebar, click **"Spark"** at the bottom
2. Click **"Upgrade to Blaze"**
3. Link a credit card (required, but not charged within free limits)
4. When prompted, set up a **budget alert at $5** — this protects you from unexpected charges

#### 2c. Enable Google Sign-In
1. In the left sidebar: **Build → Authentication**
2. Click **"Get started"**
3. Under **Sign-in method**, click **Google**
4. Toggle **Enable** to on
5. Enter a support email (your email address) → **Save**

#### 2d. Create a Firestore Database
1. In the left sidebar: **Build → Firestore Database**
2. Click **"Create database"**
3. Select **"Start in production mode"** → Next
4. Choose a region close to your users — **important:** for Storage free tier, choose `us-central`, `us-east1`, or `us-west1`
5. Click **Enable**
6. Once created, click the **Rules** tab
7. Replace the existing rules with the full contents of `firestore.rules` from this repo
8. Click **Publish**

#### 2e. Enable Firebase Storage
1. In the left sidebar: **Build → Storage**
2. Click **"Get started"**
3. Select **"Start in production mode"** → Next
4. Accept the default storage location → **Done**
5. Once created, click the **Rules** tab
6. Replace the existing rules with the full contents of `storage.rules` from this repo
7. Click **Publish**

#### 2f. Register a Web App and get your config
1. Click the **⚙️ gear icon** next to "Project Overview" → **Project settings**
2. Scroll down to **"Your apps"** section
3. Click the **web icon** (`</>`)
4. Enter an app nickname (e.g. `gathered-web`) → **Register app**
5. On the next screen, select **"Use a `<script>` tag"** (not npm)
6. Copy the values inside the `firebaseConfig` object and save them somewhere safe (a password manager works well). You will need them in Step 4.
7. Click **Continue to console**

#### 2g. Enable Firebase Hosting
1. In the left sidebar: **Build → Hosting**
2. Click **"Get started"** and follow the prompts
3. You do not need to install anything — just click through to complete setup
4. Your app will be hosted at `https://YOUR-PROJECT-ID.web.app`

#### 2h. Set your authDomain to your web.app URL
This is critical. Firebase Auth must use your Firebase Hosting domain, not the default `firebaseapp.com` domain, to avoid browser cross-origin storage restrictions that break sign-in.

In Step 4 when you add your secrets, use your `YOUR-PROJECT-ID.web.app` URL as the `authDomain` value — **not** the `firebaseapp.com` URL from your Firebase config.

#### 2i. Authorize your domains for Google Sign-In

**In Firebase Console:**
1. Go to **Build → Authentication → Settings → Authorized domains**
2. Add `YOUR-PROJECT-ID.web.app`

**In Google Cloud Console:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → select your project (look under "No Organization" if you don't see it)
2. Go to **APIs & Services → Credentials**
3. Click on **"Web client (auto created by Google Service)"**
4. Under **Authorized JavaScript origins**, add:
   - `https://YOUR-PROJECT-ID.web.app`
5. Under **Authorized redirect URIs**, add:
   - `https://YOUR-PROJECT-ID.web.app/__/auth/handler`
6. Click **Save** — note that changes can take up to a few hours to propagate

---

### Step 3 — Harden Your Firebase Security

#### 3a. Restrict your API key to your domain

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → your project
2. **APIs & Services → Credentials**
3. Click **"Browser key (auto created by Firebase)"**
4. Under **Application restrictions**, select **"Websites"**
5. Add `https://YOUR-PROJECT-ID.web.app/*`
6. Also add `https://YOUR-PROJECT-ID.firebaseapp.com/*` — Firebase Auth uses this domain internally during sign-in and will break without it
7. Click **Save**

> ⚠️ If sign-in stops working after adding the restriction, verify both domains are listed. The `firebaseapp.com` domain is required even though your app is hosted on `web.app`.

#### 3b. Enable Firebase App Check

1. In the Firebase Console: **Build → App Check**
2. Click **"Get started"** → select your web app
3. Under **reCAPTCHA v3**, follow the link to the [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
4. Register a new site:
   - Type: **Score based (v3)**
   - Domain: `YOUR-PROJECT-ID.web.app`
5. Copy the **Secret Key** (not the Site Key)
6. Paste it into Firebase App Check → **Save**
7. After deployment is confirmed working, click **"Enforce"** next to Firestore and Storage

#### 3c. Set a billing budget alert

1. Go to [console.cloud.google.com/billing](https://console.cloud.google.com/billing)
2. Select your project's billing account → **Budgets & alerts**
3. Create a budget at `$5` with alerts at 50% and 100%

---

### Step 4 — Add Secrets to GitHub

1. Go to your forked repository → **Settings → Secrets and variables → Actions**
2. Add each of the following secrets:

| Secret name | Value |
|---|---|
| `FIREBASE_API_KEY` | `apiKey` from your Firebase config |
| `FIREBASE_PROJECT_ID` | `projectId` from your Firebase config (all lowercase) |
| `FIREBASE_STORAGE_BUCKET` | `storageBucket` from your Firebase config |
| `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` from your Firebase config |
| `FIREBASE_APP_ID` | `appId` from your Firebase config |
| `FIREBASE_TOKEN` | Generated in the next step |

**To generate your `FIREBASE_TOKEN`:**
1. Install the Firebase CLI: `npm install -g firebase-tools`
2. Run: `firebase login:ci`
3. Sign in with Google in the browser that opens
4. Copy the token printed in the terminal — that is your `FIREBASE_TOKEN`

> **Important:** The `authDomain` secret is intentionally omitted from the table. The workflow file hard-codes it as `YOUR-PROJECT-ID.web.app` because using the Firebase config's default `firebaseapp.com` value breaks Google Sign-In due to browser cross-origin storage restrictions. Update the `authDomain` line in `.github/workflows/deploy.yml` with your actual project ID.

---

### Step 5 — Configure and Trigger Deployment

#### 5a. Update the workflow file

Open `.github/workflows/deploy.yml` in your repo and find this line:

```javascript
authDomain: "YOUR-PROJECT-ID.web.app",
```

Replace `YOUR-PROJECT-ID` with your actual Firebase project ID (e.g. `gathered-myfamily`).

#### 5b. Initialize Firebase Hosting locally (one time only)

In your terminal, navigate to your project folder and run:

```
firebase login
firebase init hosting
```

When prompted:
- Select your Firebase project
- Public directory: `.` (single dot)
- Single-page app: `yes`
- Overwrite index.html: **no**

This creates `firebase.json` and `.firebaserc` which the deploy workflow needs.

#### 5c. Commit and push

Commit all your changes and push to `main`. The GitHub Actions workflow will run automatically.

Go to your repository → **Actions** tab to watch the deployment. It typically takes 1–2 minutes. When it shows a green checkmark, your app is live at `https://YOUR-PROJECT-ID.web.app`.

---

### Step 6 — Verify Everything Works

Run through this checklist before sharing the link with family:

- [ ] App loads at `https://YOUR-PROJECT-ID.web.app`
- [ ] Sign in with Google works (you are taken to the feed, not returned to sign-in)
- [ ] You can create a group
- [ ] The invite link works (open it in an incognito window and join)
- [ ] You can post a photo
- [ ] The photo appears in the feed
- [ ] Reactions and comments work
- [ ] You can edit a post caption
- [ ] Install to home screen works on your phone (iOS: Safari; Android: Chrome)
- [ ] App Check is enforced on Firestore and Storage (after confirming above works)
- [ ] Budget alert is set up

---

### Firebase Free Tier Limits (Blaze plan, free quota)

| Resource | Free limit |
|---|---|
| Firestore storage | 1 GB |
| Firestore reads | 50,000 / day |
| Firestore writes | 20,000 / day |
| Firebase Storage | 5 GB total (US regions only) |
| Storage downloads | 1 GB / day |
| Firebase Hosting | 10 GB storage, 360 MB/day transfer |
| GitHub Actions (public repo) | Unlimited — free |

For a family group of 10–20 people sharing casual photos, these limits are typically sufficient indefinitely. Gathered compresses photos before upload (targeting under 500 KB each), giving roughly 10,000 photos before hitting the 5 GB storage limit.

---

### Troubleshooting

**Sign-in returns to the sign-in screen without logging in**
This is the most common issue and has several possible causes:
- The `authDomain` in your config is set to `firebaseapp.com` instead of `web.app`. Update `.github/workflows/deploy.yml` to use `YOUR-PROJECT-ID.web.app`.
- Your `web.app` domain is not in Firebase's Authorized domains list (Step 2i).
- Your `web.app` domain is not in the OAuth client's Authorized JavaScript origins (Step 2i).
- Changes to OAuth credentials can take up to a few hours to propagate — wait and try again.

**"Access blocked: redirect_uri_mismatch"**
The `https://YOUR-PROJECT-ID.web.app/__/auth/handler` URI is missing from your OAuth client's Authorized redirect URIs. Add it in Google Cloud Console → APIs & Services → Credentials.

**GitHub Actions workflow fails with "Invalid project id"**
The `FIREBASE_PROJECT_ID` secret has incorrect formatting. It must be all lowercase with no spaces. Edit the secret and re-enter the value exactly as it appears in your Firebase Console URL.

**"Missing or insufficient permissions" in the app**
Your Firestore security rules are not matching correctly. Go to Firebase Console → Firestore → Rules and verify the rules match `firestore.rules` from this repo exactly. Click Publish after any changes and wait 30 seconds before testing.

**Firebase Storage requires upgrading**
Firebase now requires the Blaze (pay-as-you-go) plan to use Storage. Upgrade in the Firebase Console — no charges apply within the free quota. Set a $5 budget alert as a safeguard.

**Photos upload but posts don't appear in the feed**
Check the browser console for Firestore permission errors. Verify your Firestore rules are published correctly and that the user is a member of the group they're posting to.

**App installs but shows a blank screen after PWA install**
Clear the service worker cache: in Chrome, open DevTools → Application → Service Workers → click Unregister. Then reload the page.

---

## License

[PolyForm Noncommercial License 1.0.0](LICENSE)

Free for personal and family use. Commercial use requires a separate license — open an issue to discuss.

---

## Contributing

Bug reports and pull requests are welcome. Please open an issue first to discuss what you'd like to change. Keep pull requests focused and small.
