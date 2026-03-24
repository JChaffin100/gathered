// firebase-config.example.js
// ─────────────────────────────────────────────────────────────────────────────
// SETUP INSTRUCTIONS
// 1. Copy this file and rename the copy to:  firebase-config.js
// 2. Replace each placeholder value below with the real values from your
//    Firebase project.  You'll find them at:
//    Firebase Console → Project Settings → Your apps → SDK setup and config
// 3. DO NOT commit firebase-config.js to git — it is in .gitignore
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { initializeFirestore, persistentLocalCache } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth    = getAuth(app);
export const storage = getStorage(app);
export const db      = initializeFirestore(app, {
  localCache: persistentLocalCache()
});
