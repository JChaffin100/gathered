// js/auth.js — Firebase Auth: Google Sign-In / Sign-Out
import { auth, db } from '../firebase-config.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
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
    const result = await signInWithPopup(auth, provider);
    await ensureUserDocument(result.user);
    return result.user;
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') return null;
    console.error('Sign-in error:', err);
    showToast('Sign-in failed. Please try again.', 'error');
    return null;
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
