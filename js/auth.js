// js/auth.js — Firebase Auth: Google Sign-In / Sign-Out
import { auth, db } from '../firebase-config.js';
import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
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

// ── Sign In ───────────────────────────────────────────────────────────────
export async function signInWithGoogle() {
  try {
    await signInWithRedirect(auth, provider);
    // Page will redirect to Google and back — no return value here
  } catch (err) {
    console.error('Sign-in error:', err);
    showToast('Sign-in failed. Please try again.', 'error');
  }
}

// ── Handle redirect result on page load ──────────────────────────────────
// Must be called early in app init to complete the sign-in after redirect
export async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      await ensureUserDocument(result.user);
    }
  } catch (err) {
    // Ignore cancelled sign-ins
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

// ── Auth State Listener (call once from app.js) ───────────────────────────
export function listenAuthState(onSignedIn, onSignedOut) {
  return onAuthStateChanged(auth, (user) => {
    if (user) onSignedIn(user);
    else onSignedOut();
  });
}

export { auth };
