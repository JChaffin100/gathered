// js/auth.js — Firebase Auth: Google Sign-In / Sign-Out
import { auth, db } from '../firebase-config.js';
import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { showToast } from './utils.js';

const provider = new GoogleAuthProvider();

// ── Allowlist ─────────────────────────────────────────────────────────────
// Add or remove family email addresses here to manage access.
// NOTE: The Firebase Security Rules (firestore.rules + storage.rules) also
// enforce this list server-side — this is the friendly UI layer on top.
const ALLOWED_EMAILS = [
  'jodychaffin@gmail.com',
  'hchaffin00@gmail.com',
  'codyrchaffin@gmail.com',
  'bcc122006@gmail.com',
  'kjchaffin97@gmail.com',
];

function isAllowedUser(user) {
  return user?.email && ALLOWED_EMAILS.includes(user.email);
}

// ── Sign In ───────────────────────────────────────────────────────────────
export async function signInWithGoogle() {
  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithRedirect(auth, provider);
  } catch (err) {
    console.error('Sign-in error:', err);
    showToast('Sign-in failed. Please try again.', 'error');
  }
}

// ── Handle redirect result on page load ──────────────────────────────────
// Called once on app init — completes the sign-in after returning from Google
export async function handleRedirectResult() {
  try {
    await setPersistence(auth, browserLocalPersistence);
    const result = await getRedirectResult(auth);
    if (result?.user) {
      // Check allowlist immediately after redirect completes
      if (!isAllowedUser(result.user)) {
        await signOut(auth);
        showAccessDenied();
        return;
      }
      await ensureUserDocument(result.user);
    }
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request') return;
    console.error('Redirect result error:', err);
    showToast('Sign-in failed. Please try again.', 'error');
  }
}

// ── Sign Out ──────────────────────────────────────────────────────────────
export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Sign-out error:', err);
    showToast('Something went wrong signing out.', 'error');
  }
}

// ── Create user document on first sign-in ─────────────────────────────────
async function ensureUserDocument(user) {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      uid:         user.uid,
      displayName: user.displayName || 'Anonymous',
      email:       user.email || '',
      photoURL:    user.photoURL || '',
      createdAt:   serverTimestamp(),
      groupIds:    [],
    });
  }
}

// ── Access denied UI ─────────────────────────────────────────────────────
function showAccessDenied() {
  const root = document.getElementById('root') || document.body;
  root.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 40px 24px;
      font-family: sans-serif;
      text-align: center;
      background: #f9f9f9;
      color: #333;
    ">
      <h2 style="margin-bottom: 12px;">Access Restricted</h2>
      <p style="max-width: 360px; line-height: 1.6; color: #555;">
        Gathered is a private family app. If you think you should have access,
        please reach out to a family admin to be added.
      </p>
    </div>
  `;
}

// ── Auth State Listener (call once from app.js) ───────────────────────────
export function listenAuthState(onSignedIn, onSignedOut) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Re-check allowlist on every auth state change (e.g. page reload)
      if (!isAllowedUser(user)) {
        await signOut(auth);
        showAccessDenied();
        return;
      }
      onSignedIn(user);
    } else {
      onSignedOut();
    }
  });
}

export { auth };
