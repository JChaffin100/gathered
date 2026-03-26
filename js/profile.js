// js/profile.js — Profile screen rendering
import { db } from '../firebase-config.js';
import { auth } from './auth.js';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { escapeHtml, showToast, navigate, openDetailEvent } from './utils.js';
import { signOutUser } from './auth.js';

// ── Render own profile ────────────────────────────────────────────────────
export async function renderOwnProfile(user, groups) {
  const screen = document.getElementById('screen-profile');
  const body = screen.querySelector('.screen-body');
  if (!body) return;

  const postCount = await countUserPosts(user.uid, groups);

  body.innerHTML = `
    <!-- Header -->
    <div class="profile-header">
      <img class="profile-avatar" src="${escapeHtml(user.photoURL || '')}" alt="${escapeHtml(user.displayName || 'You')}" onerror="this.src=''">
      <h1 class="profile-name">${escapeHtml(user.displayName || 'Anonymous')}</h1>
      <p class="profile-email">${escapeHtml(user.email || '')}</p>
      <p class="profile-post-count">${postCount} post${postCount !== 1 ? 's' : ''}</p>

      ${groups.length > 0 ? `
      <div class="profile-groups" aria-label="Your groups">
        ${groups.map((g) => `<span class="profile-group-chip">${escapeHtml(g.name)}</span>`).join('')}
      </div>` : ''}

      <!-- Theme selector -->
      <div class="theme-selector-section">
        <span class="theme-label" id="theme-label">Appearance</span>
        <div class="theme-options" role="group" aria-labelledby="theme-label">
          <button class="theme-option" data-theme="light" aria-pressed="false">☀️ Light</button>
          <button class="theme-option" data-theme="dark"  aria-pressed="false">🌙 Dark</button>
          <button class="theme-option" data-theme="system" aria-pressed="false">🔁 System</button>
        </div>
      </div>

      <button class="btn-sign-out" id="sign-out-btn">Sign Out</button>
      <div class="profile-app-version" id="app-version-display" style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:16px;">Version 1.0...</div>
    </div>

    <!-- Posts grid -->
    <div class="profile-grid" id="profile-grid" aria-label="Your posts">
      ${renderSkeletonGrid()}
    </div>`;

  // Set active theme button
  const savedTheme = localStorage.getItem('gathered_theme') || 'system';
  body.querySelectorAll('.theme-option').forEach((btn) => {
    const active = btn.dataset.theme === savedTheme;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  body.querySelectorAll('.theme-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pref = btn.dataset.theme;
      localStorage.setItem('gathered_theme', pref);
      applyTheme(pref);
      body.querySelectorAll('.theme-option').forEach((b) => {
        const a = b.dataset.theme === pref;
        b.classList.toggle('active', a);
        b.setAttribute('aria-pressed', a ? 'true' : 'false');
      });
    });
  });

  document.getElementById('sign-out-btn')?.addEventListener('click', () => {
    signOutUser();
  });

  // Fetch version from Service Worker organically
  fetch('./sw.js')
    .then(r => r.text())
    .then(text => {
      const match = text.match(/CACHE_NAME\s*=\s*['"]gathered-v(\d+)['"]/);
      if (match) {
        const v = document.getElementById('app-version-display');
        if (v) v.textContent = 'Version 1.0.' + match[1];
      }
    }).catch(() => {});

  // Load posts grid
  await loadUserPostsGrid(user.uid, groups, 'profile-grid', null);
}

// ── Render other user's profile ───────────────────────────────────────────
export async function renderUserProfile(userId, groups) {
  const screen = document.getElementById('screen-profile');
  const body = screen.querySelector('.screen-body');
  if (!body) return;

  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (!userSnap.exists()) { showToast('User not found.', 'error'); return; }
    const userData = userSnap.data();
    const postCount = await countUserPosts(userId, groups);

    body.innerHTML = `
      <div class="profile-header">
        <img class="profile-avatar" src="${escapeHtml(userData.photoURL || '')}" alt="${escapeHtml(userData.displayName || 'User')}" onerror="this.src=''">
        <h1 class="profile-name">${escapeHtml(userData.displayName || 'Anonymous')}</h1>
        <p class="profile-post-count">${postCount} post${postCount !== 1 ? 's' : ''}</p>
      </div>
      <div class="profile-grid" id="profile-grid" aria-label="${escapeHtml(userData.displayName || 'User')}'s posts">
        ${renderSkeletonGrid()}
      </div>`;

    await loadUserPostsGrid(userId, groups, 'profile-grid', null);
  } catch (err) {
    console.error('renderUserProfile error:', err);
    showToast('Could not load profile.', 'error');
  }
}

// ── Count posts across all groups ─────────────────────────────────────────
async function countUserPosts(userId, groups) {
  let total = 0;
  await Promise.all(groups.map(async (g) => {
    try {
      const q = query(collection(db, 'groups', g.id, 'posts'), where('authorId', '==', userId));
      const snap = await getDocs(q);
      total += snap.size;
    } catch { /* ignore */ }
  }));
  return total;
}

// ── Load posts grid ───────────────────────────────────────────────────────
async function loadUserPostsGrid(userId, groups, gridId, currentGroupId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  let allPosts = [];
  try {
    await Promise.all(groups.map(async (g) => {
      const q = query(
        collection(db, 'groups', g.id, 'posts'),
        where('authorId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      snap.docs.forEach((d) => allPosts.push({ ...d.data(), id: d.id, groupId: g.id }));
    }));

    allPosts.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });

    if (allPosts.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">📷</div>
          <h2>No posts yet.</h2>
          <p>Share your first moment!</p>
        </div>`;
      return;
    }

    grid.innerHTML = allPosts.map((post) => {
      const thumb = post.photos?.[0]?.url || '';
      const multi = post.photos?.length > 1;
      return `
        <button class="profile-grid-item" data-post-id="${post.id}" data-group-id="${post.groupId}" aria-label="View post${post.caption ? ': ' + escapeHtml(post.caption) : ''}">
          <img src="${escapeHtml(thumb)}" alt="${post.caption ? escapeHtml(post.caption) : 'Photo'}" loading="lazy">
          ${multi ? '<span class="profile-grid-multi-badge" aria-hidden="true">🔲</span>' : ''}
        </button>`;
    }).join('');

    grid.querySelectorAll('.profile-grid-item').forEach((btn) => {
      btn.addEventListener('click', () => openDetailEvent(btn.dataset.postId, btn.dataset.groupId));
    });
  } catch (err) {
    console.error('loadUserPostsGrid error:', err);
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>Could not load posts.</p></div>';
  }
}

function renderSkeletonGrid() {
  return Array.from({ length: 9 }).map(() => '<div class="skeleton-grid-item" aria-hidden="true"></div>').join('');
}

// ── Theme application ─────────────────────────────────────────────────────
function applyTheme(pref) {
  if (pref === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', pref);
  }
}
