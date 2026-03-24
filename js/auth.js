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

// ── Sign In ───────────────────────────────────────────────────────────────
export async function signInWithGoogle() {
  try {
    // Explicitly set local persistence before redirecting so the session
    // survives the page navigation and is restored when we return
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

// ── Auth State Listener (call once from app.js) ───────────────────────────
export function listenAuthState(onSignedIn, onSignedOut) {
  return onAuthStateChanged(auth, (user) => {
    if (user) onSignedIn(user);
    else onSignedOut();
  });
}

export { auth };
