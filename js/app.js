// js/app.js — App initialization, routing, navigation
// Theme must be applied before any render — done inline in <head>.

import { listenAuthState, handleRedirectResult, auth } from './auth.js';
import { subscribeFeed, unsubscribeFeed, loadMorePosts, setGroupAdminCache } from './feed.js';
import { renderOwnProfile, renderUserProfile } from './profile.js';
import { openCreatePost, openPostDetail as _openPostDetail } from './post.js';
import { getUserGroups, findGroupByToken, joinGroup, renderGroupSettings } from './groups.js';
import { showToast, openSheet, closeSheet } from './utils.js';
import { db } from '../firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── State ─────────────────────────────────────────────────────────────────
let _currentUser   = null;
let _userGroups    = [];
let _activeGroupId = null;
let _currentScreen = 'auth';
let _profileViewingUserId = null; // null = own profile

// ── Navigation event listeners (replaces circular exports) ────────────────
window.addEventListener('gathered:navigate', (e) => showScreen(e.detail.screen, e.detail.options || {}));
window.addEventListener('gathered:openDetail', (e) => {
  showScreen('post-detail');
  _openPostDetail(e.detail.postId, e.detail.groupId);
});

// ── App Init ──────────────────────────────────────────────────────────────
async function init() {
  // Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(new URL('../sw.js', import.meta.url))
        .catch((err) => console.warn('SW registration failed:', err));
    });
  }

  // Online / offline toasts
  window.addEventListener('offline', () => showToast("You're offline — some features are unavailable.", 'error'));
  window.addEventListener('online',  () => showToast('Back online!', 'success'));

  // Handle redirect result FIRST — completes sign-in after returning from Google.
  // Must finish before listenAuthState so onAuthStateChanged sees the signed-in user.
  await handleRedirectResult();

  // Auth state — small delay ensures DOM is fully ready before auth state fires
  setTimeout(() => {
    listenAuthState(onSignedIn, onSignedOut);
  }, 100);

  // Check for invite token in URL
  checkInviteToken();

  // Bottom nav wiring
  document.getElementById('nav-home')?.addEventListener('click',    () => showScreen('feed'));
  document.getElementById('nav-search')?.addEventListener('click',  () => showScreen('search'));
  document.getElementById('nav-post')?.addEventListener('click',    () => {
    if (!_activeGroupId) { showToast('Join or create a group first!', 'error'); return; }
    openCreatePost(_activeGroupId, _userGroups);
  });
  document.getElementById('nav-profile')?.addEventListener('click', () => {
    _profileViewingUserId = null;
    showScreen('profile');
  });

  // Back buttons
  document.getElementById('post-detail-back')?.addEventListener('click', () => showScreen('feed'));
  document.getElementById('group-settings-back')?.addEventListener('click', () => showScreen('feed'));
  document.getElementById('profile-back')?.addEventListener('click', () => showScreen('feed'));

  // Feed scroll — infinite scroll
  document.querySelector('#screen-feed .screen-body')?.addEventListener('scroll', (e) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
      if (_activeGroupId) loadMorePosts(_activeGroupId);
    }
  });

  // Pull-to-refresh (simple implementation)
  setupPullToRefresh();
}

// ── PWA Install Prompt ────────────────────────────────────────────────────
let _deferredPrompt = null;
const _dismissed = localStorage.getItem('gathered_pwa_dismissed') === 'true';

// 1. MUST BE SYNCHRONOUS: Catch the event before 'await' fetches or auth delays
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredPrompt = e;
  
  if (!_dismissed) {
    const installBanner = document.getElementById('install-banner');
    if (installBanner) installBanner.classList.remove('hidden');
  }
});

// Setup click handlers asynchronously later (called immediately here)
setTimeout(() => {
  const installBanner = document.getElementById('install-banner');
  const installBtn = document.getElementById('install-btn');
  const dismissBtn = document.getElementById('install-dismiss-btn');

  const iosBanner = document.getElementById('ios-install-banner');
  const iosDismissBtn = document.getElementById('ios-install-dismiss-btn');

  installBtn?.addEventListener('click', async () => {
    installBanner.classList.add('hidden');
    if (!_deferredPrompt) return;
    _deferredPrompt.prompt();
    const { outcome } = await _deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    _deferredPrompt = null;
  });

  dismissBtn?.addEventListener('click', () => {
    installBanner?.classList.add('hidden');
    localStorage.setItem('gathered_pwa_dismissed', 'true');
  });

  // Detect iOS Safari for manual instructions
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  
  if (isIOS && !isStandalone && !_dismissed) {
    setTimeout(() => iosBanner?.classList.remove('hidden'), 1000);
  }

  iosDismissBtn?.addEventListener('click', () => {
    iosBanner?.classList.add('hidden');
    localStorage.setItem('gathered_pwa_dismissed', 'true');
  });

  window.addEventListener('appinstalled', () => {
    installBanner?.classList.add('hidden');
    iosBanner?.classList.add('hidden');
    console.log('Gathered was installed');
  });
}, 0);

// ── Auth Callbacks ────────────────────────────────────────────────────────
async function onSignedIn(user) {
  _currentUser = user;

  // Fetch user's groups
  const userSnap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  const groupIds = userSnap?.data()?.groupIds || [];
  _userGroups = await getUserGroups(groupIds);

  // Show bottom nav
  document.getElementById('bottom-nav')?.classList.add('visible');

  // Render group switcher
  renderGroupSwitcher();

  // Pick active group
  if (!_activeGroupId && _userGroups.length > 0) {
    _activeGroupId = _userGroups[0].id;
  }

  // Cache admin status
  _userGroups.forEach((g) => {
    const isAdmin = g.members?.[user.uid]?.role === 'admin';
    setGroupAdminCache(g.id, user.uid, isAdmin);
  });

  showScreen('feed');
  if (_activeGroupId) {
    subscribeFeed(_activeGroupId);
    document.getElementById('no-groups-state')?.style.setProperty('display', 'none');
  } else {
    document.getElementById('no-groups-state')?.style.removeProperty('display');
    // Wire empty-state CTAs
    document.getElementById('create-group-cta')?.addEventListener('click', () => showCreateGroupSheet(), { once: true });
    document.getElementById('join-group-cta')?.addEventListener('click', () => showJoinGroupSheet(), { once: true });
  }

  // Gear icon (group settings)
  document.getElementById('group-settings-btn')?.addEventListener('click', () => {
    if (!_activeGroupId) return;
    const group = _userGroups.find((g) => g.id === _activeGroupId);
    if (!group) return;
    renderGroupSettings(group, user.uid);
    openSheet('group-settings-backdrop');
  });
}

function onSignedOut() {
  _currentUser   = null;
  _userGroups    = [];
  _activeGroupId = null;
  unsubscribeFeed();
  document.getElementById('bottom-nav')?.classList.remove('visible');
  showScreen('auth');
}

// ── Screen Management ─────────────────────────────────────────────────────
const SCREEN_IDS = {
  'auth':           'screen-auth',
  'feed':           'screen-feed',
  'post-detail':    'screen-post-detail',
  'profile':        'screen-profile',
  'search':         'screen-search',
  'group-settings': 'screen-group-settings',
};

function showScreen(name, options = {}) {
  _currentScreen = name;

  // Hide all
  Object.values(SCREEN_IDS).forEach((id) => {
    document.getElementById(id)?.classList.remove('active');
  });

  const screenId = SCREEN_IDS[name];
  if (screenId) document.getElementById(screenId)?.classList.add('active');

  // Update nav active state
  document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.remove('active'));
  const navMap = { feed: 'nav-home', search: 'nav-search', profile: 'nav-profile' };
  if (navMap[name]) document.getElementById(navMap[name])?.classList.add('active');

  // Screen-specific rendering
  if (name === 'feed') {
    if (_activeGroupId) subscribeFeed(_activeGroupId);
    updateGearVisibility();
  } else {
    unsubscribeFeed();
  }

  if (name === 'profile') {
    const uid = options.userId || null;
    _profileViewingUserId = uid;
    const backBtn = document.getElementById('profile-back');
    if (backBtn) backBtn.style.display = uid && uid !== _currentUser?.uid ? '' : 'none';
    if (uid && uid !== _currentUser?.uid) {
      renderUserProfile(uid, _userGroups);
    } else if (_currentUser) {
      renderOwnProfile(_currentUser, _userGroups);
    }
  }
}

// ── Group Switcher Rendering ──────────────────────────────────────────────
function renderGroupSwitcher() {
  const switcher = document.getElementById('group-switcher');
  if (!switcher) return;

  switcher.innerHTML = _userGroups.map((g) => `
    <button class="group-chip${g.id === _activeGroupId ? ' active' : ''}" data-group-id="${g.id}" aria-pressed="${g.id === _activeGroupId}">
      ${g.name.length > 20 ? g.name.substring(0, 20) + '…' : g.name}
    </button>
  `).join('') + `
    <button class="group-chip group-chip-add" id="add-group-chip" aria-label="Create or join a group">＋</button>`;

  switcher.querySelectorAll('.group-chip[data-group-id]').forEach((chip) => {
    chip.addEventListener('click', () => {
      _activeGroupId = chip.dataset.groupId;
      renderGroupSwitcher();
      subscribeFeed(_activeGroupId);
      updateGearVisibility();
    });
  });

  document.getElementById('add-group-chip')?.addEventListener('click', () => showAddGroupSheet());
}

// ── Gear icon visibility ──────────────────────────────────────────────────
function updateGearVisibility() {
  const btn = document.getElementById('group-settings-btn');
  if (btn) btn.style.display = ''; // Always visible so non-admins can see the member list
}

function showAddGroupSheet() {
  const backdrop = document.getElementById('add-group-backdrop');
  if (!backdrop) return;

  const sheet = backdrop.querySelector('.sheet');
  sheet.innerHTML = `
    <div class="sheet-header">
      <h2 class="sheet-title">Add Group</h2>
      <button class="icon-btn" aria-label="Close" id="add-group-close">✕</button>
    </div>
    <div class="sheet-body" style="display:flex;flex-direction:column;gap:12px">
      <button class="btn btn-primary btn-full" id="ag-create">Create a New Group</button>
      <button class="btn btn-secondary btn-full" id="ag-join">Join with Invite Link</button>
    </div>`;

  document.getElementById('add-group-close')?.addEventListener('click', () => closeSheet('add-group-backdrop'));
  document.getElementById('ag-create')?.addEventListener('click', () => {
    closeSheet('add-group-backdrop');
    showCreateGroupSheet();
  });
  document.getElementById('ag-join')?.addEventListener('click', () => {
    closeSheet('add-group-backdrop');
    showJoinGroupSheet();
  });

  openSheet('add-group-backdrop');
}

function showCreateGroupSheet() {
  const backdrop = document.getElementById('add-group-backdrop');
  const sheet = backdrop.querySelector('.sheet');
  sheet.innerHTML = `
    <div class="sheet-header">
      <h2 class="sheet-title">Create Group</h2>
      <button class="icon-btn" aria-label="Close" id="cg-close">✕</button>
    </div>
    <div class="sheet-body">
      <div class="create-group-form">
        <div class="group-cover-upload-area">
          <div class="group-cover-preview" id="cg-cover-preview" role="button" tabindex="0" aria-label="Select cover photo">📷</div>
          <p class="group-cover-hint">Cover photo (optional)</p>
          <input type="file" id="cg-cover-input" accept="image/*" style="display:none" aria-label="Select cover photo">
        </div>
        <div class="input-group">
          <label for="cg-name">Group Name</label>
          <input type="text" id="cg-name" placeholder="e.g. Smith Family" maxlength="50" required aria-required="true">
        </div>
        <button class="btn btn-primary btn-full" id="cg-submit">Create Group</button>
      </div>
    </div>`;

  document.getElementById('cg-close')?.addEventListener('click', () => closeSheet('add-group-backdrop'));

  let coverFile = null;
  const coverPreview = document.getElementById('cg-cover-preview');
  const coverInput   = document.getElementById('cg-cover-input');

  coverPreview.addEventListener('click', () => coverInput.click());
  coverPreview.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') coverInput.click(); });
  coverInput.addEventListener('change', () => {
    const f = coverInput.files[0];
    if (!f) return;
    coverFile = f;
    const url = URL.createObjectURL(f);
    coverPreview.innerHTML = `<img src="${url}" alt="Cover photo preview">`;
  });

  document.getElementById('cg-submit')?.addEventListener('click', async () => {
    const name = document.getElementById('cg-name').value.trim();
    if (!name) { showToast('Enter a group name.', 'error'); return; }
    const { createGroup } = await import('./groups.js');
    const groupId = await createGroup(name, coverFile);
    if (groupId) {
      closeSheet('add-group-backdrop');
      const { getUserGroups } = await import('./groups.js');
      const userSnap = await getDoc(doc(db, 'users', _currentUser.uid));
      const groupIds = userSnap?.data()?.groupIds || [];
      _userGroups = await getUserGroups(groupIds);
      _activeGroupId = groupId;
      setGroupAdminCache(groupId, _currentUser.uid, true);
      renderGroupSwitcher();
      subscribeFeed(_activeGroupId);
    }
  });

  openSheet('add-group-backdrop');
}

function showJoinGroupSheet() {
  const backdrop = document.getElementById('add-group-backdrop');
  const sheet = backdrop.querySelector('.sheet');
  sheet.innerHTML = `
    <div class="sheet-header">
      <h2 class="sheet-title">Join a Group</h2>
      <button class="icon-btn" aria-label="Close" id="jg-close">✕</button>
    </div>
    <div class="sheet-body">
      <div class="input-group" style="margin-bottom:16px">
        <label for="jg-link">Invite Link or Token</label>
        <input type="text" id="jg-link" placeholder="Paste invite link here" aria-label="Invite link">
      </div>
      <button class="btn btn-primary btn-full" id="jg-submit">Join Group</button>
    </div>`;

  document.getElementById('jg-close')?.addEventListener('click', () => closeSheet('add-group-backdrop'));
  document.getElementById('jg-submit')?.addEventListener('click', async () => {
    const val = document.getElementById('jg-link').value.trim();
    let token = val;
    try {
      const url = new URL(val);
      token = url.searchParams.get('token') || val;
    } catch { /* not a URL, treat as raw token */ }

    const group = await findGroupByToken(token);
    if (!group) { showToast('Invalid or expired invite link.', 'error'); return; }

    const ok = await joinGroup(group);
    if (ok) {
      closeSheet('add-group-backdrop');
      const userSnap = await getDoc(doc(db, 'users', _currentUser.uid));
      const groupIds = userSnap?.data()?.groupIds || [];
      _userGroups = await getUserGroups(groupIds);
      _activeGroupId = group.id;
      renderGroupSwitcher();
      subscribeFeed(_activeGroupId);
    }
  });

  openSheet('add-group-backdrop');
}

// ── Invite Token in URL ───────────────────────────────────────────────────
async function checkInviteToken() {
  const params = new URLSearchParams(location.search);
  const token  = params.get('token');
  if (!token) return;

  // Clear from URL without navigation
  history.replaceState({}, '', location.pathname);

  // Wait for auth
  const unsubscribe = listenAuthState(async (user) => {
    unsubscribe();
    const group = await findGroupByToken(token);
    if (!group) { showToast('Invalid or expired invite link.', 'error'); return; }

    if (group.members?.[user.uid]) {
      // Already a member
      _activeGroupId = group.id;
      renderGroupSwitcher();
      subscribeFeed(_activeGroupId);
      return;
    }

    showJoinConfirmScreen(group);
  }, () => { /* not signed in — handled by auth listener */ });
}

function showJoinConfirmScreen(group) {
  const screen = document.getElementById('screen-auth');
  screen.classList.add('active');
  document.querySelectorAll('.screen').forEach((s) => { if (s !== screen) s.classList.remove('active'); });

  screen.innerHTML = `
    <div class="auth-card">
      ${group.photoURL ? `<img class="join-group-cover" src="${group.photoURL}" alt="${group.name} cover photo">` : '<div style="font-size:64px">👥</div>'}
      <h1 class="join-group-name">${group.name}</h1>
      <p class="join-member-count">${group.memberCount || 1} member${group.memberCount !== 1 ? 's' : ''}</p>
      <button class="btn btn-primary btn-full" id="join-confirm-btn">Join ${group.name}</button>
      <button class="btn btn-text" id="join-decline-btn">No thanks</button>
    </div>`;

  document.getElementById('join-confirm-btn')?.addEventListener('click', async () => {
    const ok = await joinGroup(group);
    if (ok) {
      const userSnap = await getDoc(doc(db, 'users', auth.currentUser?.uid));
      const groupIds = userSnap?.data()?.groupIds || [];
      _userGroups = await getUserGroups(groupIds);
      _activeGroupId = group.id;
      renderGroupSwitcher();
      showScreen('feed');
      subscribeFeed(_activeGroupId);
    }
  });
  document.getElementById('join-decline-btn')?.addEventListener('click', () => showScreen('feed'));
}

// ── Pull to Refresh ───────────────────────────────────────────────────────
function setupPullToRefresh() {
  const feedBody = document.querySelector('#screen-feed .screen-body');
  if (!feedBody) return;
  let startY = 0;
  feedBody.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
  feedBody.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientY - startY;
    if (diff > 80 && feedBody.scrollTop === 0 && _activeGroupId) {
      subscribeFeed(_activeGroupId);
    }
  }, { passive: true });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
