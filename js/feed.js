// js/feed.js — Feed rendering and real-time listener
import { db } from '../firebase-config.js';
import { auth } from './auth.js';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { timeAgo, isoDate, showToast, escapeHtml, isOnline, confirmSheet, navigate, openDetailEvent } from './utils.js';
import { deletePostPhotos } from './storage.js';

const PAGE_SIZE = 20;
let _unsubscribe = null;
let _lastDoc = null;
let _loading = false;
let _currentGroupId = null;

// ── Subscribe to feed ─────────────────────────────────────────────────────
export function subscribeFeed(groupId) {
  unsubscribeFeed();
  _currentGroupId = groupId;
  _lastDoc = null;

  const feedList = document.getElementById('feed-list');
  feedList.innerHTML = renderSkeletons(3);

  const q = query(
    collection(db, 'groups', groupId, 'posts'),
    orderBy('createdAt', 'desc'),
    limit(PAGE_SIZE)
  );

  _unsubscribe = onSnapshot(q, (snapshot) => {
    // First load — replace skeletons
    if (feedList.querySelector('.skeleton-card')) feedList.innerHTML = '';

    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const existing = document.getElementById(`post-${change.doc.id}`);
        if (!existing) prependPostCard(change.doc);
      }
      if (change.type === 'modified') updatePostCard(change.doc);
      if (change.type === 'removed') removePostCard(change.doc.id);
    });

    if (snapshot.size > 0) _lastDoc = snapshot.docs[snapshot.docs.length - 1];

    if (snapshot.empty && feedList.children.length === 0) {
      feedList.innerHTML = renderEmptyFeed();
    }
  }, (err) => {
    console.error('Feed listener error:', err);
    showToast('Could not load feed. Check your connection.', 'error');
  });
}

export function unsubscribeFeed() {
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
}

// ── Load more (infinite scroll) ───────────────────────────────────────────
export async function loadMorePosts(groupId) {
  if (_loading || !_lastDoc) return;
  _loading = true;
  try {
    const q = query(
      collection(db, 'groups', groupId, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
      startAfter(_lastDoc)
    );
    const { getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const snap = await getDocs(q);
    snap.docs.forEach((d) => appendPostCard(d));
    if (snap.size > 0) _lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) _lastDoc = null; // no more pages
  } catch (err) {
    console.error('loadMorePosts error:', err);
  } finally {
    _loading = false;
  }
}

// ── Render Helpers ────────────────────────────────────────────────────────
function prependPostCard(docSnap) {
  const feedList = document.getElementById('feed-list');
  const card = buildPostCard(docSnap);
  feedList.insertAdjacentElement('afterbegin', card);
}

function appendPostCard(docSnap) {
  const feedList = document.getElementById('feed-list');
  const card = buildPostCard(docSnap);
  feedList.appendChild(card);
}

function updatePostCard(docSnap) {
  const existing = document.getElementById(`post-${docSnap.id}`);
  if (!existing) return;
  const updated = buildPostCard(docSnap);
  existing.replaceWith(updated);
}

function removePostCard(postId) {
  document.getElementById(`post-${postId}`)?.remove();
}

function buildPostCard(docSnap) {
  const post = docSnap.data();
  const postId = docSnap.id;
  const user = auth.currentUser;
  const isAuthor = user && user.uid === post.authorId;
  const isoTimestamp = post.createdAt ? isoDate(post.createdAt) : '';
  const displayTime   = post.createdAt ? timeAgo(post.createdAt) : '';
  const firstPhoto    = post.photos?.[0];
  const hasMultiple   = post.photos?.length > 1;

  const article = document.createElement('article');
  article.className = 'post-card';
  article.id = `post-${postId}`;
  article.setAttribute('aria-label', `Post by ${escapeHtml(post.authorName)}`);

  const reactions = post.reactionCounts || { heart: 0, haha: 0, wow: 0, sad: 0 };
  const commentCount = post.commentCount || 0;

  article.innerHTML = `
    <div class="post-card-header">
      <button class="avatar avatar-40" style="overflow:hidden;border-radius:50%;padding:0;background:var(--surface-2);cursor:pointer;border:none" aria-label="View ${escapeHtml(post.authorName)}'s profile" data-author-id="${post.authorId}">
        <img class="avatar avatar-40" src="${escapeHtml(post.authorPhotoURL || '')}" alt="${escapeHtml(post.authorName)}" onerror="this.style.display='none'">
      </button>
      <div class="post-author-info">
        <button class="post-author-name" data-author-id="${post.authorId}" aria-label="View profile">${escapeHtml(post.authorName)}</button>
        <div class="post-meta">
          <time datetime="${isoTimestamp}">${displayTime}</time>
          ${post.editedAt ? '<span class="post-edited-badge">· Edited</span>' : ''}
        </div>
      </div>
      ${isAuthor || (user && isAdminOf(_currentGroupId, user.uid)) ? `
        <button class="icon-btn post-options-btn" aria-label="Post options" data-post-id="${postId}">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
        </button>
      ` : ''}
    </div>

    <div class="post-carousel" data-photos='${escapeHtml(JSON.stringify(post.photos || []))}' data-post-id="${postId}">
      <div class="carousel-track">
        ${(post.photos || []).map((p, i) => `
          <div class="carousel-slide">
            <img class="post-photo" src="${escapeHtml(p.url)}" alt="${post.caption ? escapeHtml(post.caption) : escapeHtml(post.authorName) + "'s photo"}" loading="lazy">
          </div>
        `).join('')}
      </div>
      ${hasMultiple ? `<div class="carousel-dots" aria-hidden="true">${(post.photos || []).map((_, i) => `<div class="carousel-dot${i === 0 ? ' active' : ''}"></div>`).join('')}</div>` : ''}
    </div>

    ${post.caption ? `<p class="post-caption">${escapeHtml(post.caption)}</p>` : ''}

    <div class="reaction-row" role="group" aria-label="Reactions">
      ${['heart','haha','wow','sad'].map((type) => {
        const emoji = { heart: '❤️', haha: '😂', wow: '😮', sad: '😢' }[type];
        const count = reactions[type] || 0;
        return `<button class="reaction-btn" data-type="${type}" data-post-id="${postId}" aria-label="${emoji} ${count} ${type} reactions" aria-pressed="false">
          <span class="emoji" aria-hidden="true">${emoji}</span>
          <span class="reaction-count">${count}</span>
        </button>`;
      }).join('')}
      <button class="comment-count-btn" data-post-id="${postId}" aria-label="View ${commentCount} comments">
        💬 ${commentCount} comment${commentCount !== 1 ? 's' : ''}
      </button>
    </div>`;

  // Wire up events after insertion
  requestAnimationFrame(() => {
    // Author link/avatar
    article.querySelectorAll('[data-author-id]').forEach((el) => {
      el.addEventListener('click', () => navigate('profile', { userId: el.dataset.authorId }));
    });

    // Options menu
    article.querySelector('.post-options-btn')?.addEventListener('click', (e) => {
      showPostOptions(e, postId, post, isAuthor);
    });

    // Carousel swipe
    initCarousel(article.querySelector('.post-carousel'));

    // Photo tap → full screen
    article.querySelectorAll('.post-photo').forEach((img) => {
      img.addEventListener('click', () => openFullscreen(img.src, img.alt));
    });

    // Reactions
    article.querySelectorAll('.reaction-btn').forEach((btn) => {
      btn.addEventListener('click', () => toggleReaction(postId, btn.dataset.type, btn));
    });

    // Comment count
    article.querySelector('.comment-count-btn')?.addEventListener('click', () => {
      openDetailEvent(postId, _currentGroupId);
    });

    // Highlight user's existing reaction
    highlightUserReaction(postId, article);
  });

  return article;
}

// ── Highlight user's current reaction ─────────────────────────────────────
async function highlightUserReaction(postId, article) {
  const user = auth.currentUser;
  if (!user || !_currentGroupId) return;
  try {
    const reactionRef = doc(db, 'groups', _currentGroupId, 'posts', postId, 'reactions', user.uid);
    const snap = await getDoc(reactionRef);
    if (snap.exists()) {
      const type = snap.data().type;
      const btn = article.querySelector(`.reaction-btn[data-type="${type}"]`);
      if (btn) { btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); }
    }
  } catch { /* ignore */ }
}

// ── Toggle Reaction ───────────────────────────────────────────────────────
async function toggleReaction(postId, type, clickedBtn) {
  const user = auth.currentUser;
  if (!user) return;
  if (!isOnline()) { showToast("You're offline — reactions will sync when reconnected.", 'error'); return; }

  const reactionRef = doc(db, 'groups', _currentGroupId, 'posts', postId, 'reactions', user.uid);
  const postRef     = doc(db, 'groups', _currentGroupId, 'posts', postId);
  const card        = document.getElementById(`post-${postId}`);

  try {
    const snap = await getDoc(reactionRef);
    if (snap.exists()) {
      const oldType = snap.data().type;
      await deleteDoc(reactionRef);
      await updateDoc(postRef, { [`reactionCounts.${oldType}`]: increment(-1) });
      // Update UI immediately
      const oldBtn = card?.querySelector(`.reaction-btn[data-type="${oldType}"]`);
      if (oldBtn) {
        oldBtn.classList.remove('active');
        oldBtn.setAttribute('aria-pressed', 'false');
        const count = parseInt(oldBtn.querySelector('.reaction-count').textContent, 10);
        oldBtn.querySelector('.reaction-count').textContent = Math.max(0, count - 1);
        oldBtn.setAttribute('aria-label', `${oldBtn.querySelector('.emoji').textContent} ${Math.max(0, count - 1)} ${oldType} reactions`);
      }
      if (oldType === type) return; // just removed
    }

    // Add new reaction
    await setDoc(reactionRef, { userId: user.uid, type, createdAt: serverTimestamp() });
    await updateDoc(postRef, { [`reactionCounts.${type}`]: increment(1) });

    if (card) {
      card.querySelectorAll('.reaction-btn').forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      clickedBtn.classList.add('active');
      clickedBtn.setAttribute('aria-pressed', 'true');
      const count = parseInt(clickedBtn.querySelector('.reaction-count').textContent, 10);
      clickedBtn.querySelector('.reaction-count').textContent = count + 1;
      clickedBtn.setAttribute('aria-label', `${clickedBtn.querySelector('.emoji').textContent} ${count + 1} ${type} reactions`);
    }
  } catch (err) {
    console.error('toggleReaction error:', err);
    showToast('Could not save reaction.', 'error');
  }
}

// ── Post Options Menu ─────────────────────────────────────────────────────
function showPostOptions(event, postId, post, isAuthor) {
  const existing = document.querySelector('.options-menu');
  if (existing) existing.remove();

  const user = auth.currentUser;
  const menu = document.createElement('div');
  menu.className = 'options-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Post options');

  const actions = [];
  if (isAuthor) {
    actions.push({ label: 'Edit post', action: () => {
      import('./post.js').then((m) => m.openEditPost(postId, _currentGroupId, post));
    } });
  }
  if (isAuthor || (user && isAdminOf(_currentGroupId, user.uid))) {
    actions.push({ label: 'Delete post', action: () => confirmDeletePost(postId, post), danger: true });
  }

  actions.forEach(({ label, action, danger }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    if (danger) btn.classList.add('danger');
    btn.setAttribute('role', 'menuitem');
    btn.addEventListener('click', () => { menu.remove(); action(); });
    menu.appendChild(btn);
  });

  const rect = event.currentTarget.getBoundingClientRect();
  menu.style.cssText = `top:${rect.bottom + 4}px;right:${window.innerWidth - rect.right}px`;
  document.body.appendChild(menu);

  const dismiss = (e) => { if (!menu.contains(e.target)) menu.remove(); };
  setTimeout(() => document.addEventListener('click', dismiss, { once: true }), 0);
  menu.querySelector('button')?.focus();
}

async function confirmDeletePost(postId, post) {
  confirmSheet({
    icon: '🗑️',
    message: 'Delete this post? This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: async () => {
      try {
        await deleteDoc(doc(db, 'groups', _currentGroupId, 'posts', postId));
        if (post.photos?.length) await deletePostPhotos(post.photos);
        showToast('Post deleted.', 'success');
      } catch (err) {
        console.error('deletePost error:', err);
        showToast('Could not delete post.', 'error');
      }
    },
  });
}

// ── Carousel ──────────────────────────────────────────────────────────────
function initCarousel(carousel) {
  if (!carousel) return;
  const track = carousel.querySelector('.carousel-track');
  const dots  = carousel.querySelectorAll('.carousel-dot');
  if (!track || !dots.length) return;

  let current = 0;
  let startX  = 0;

  const goTo = (i) => {
    const slides = track.querySelectorAll('.carousel-slide');
    current = Math.max(0, Math.min(i, slides.length - 1));
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, idx) => d.classList.toggle('active', idx === current));
  };

  carousel.addEventListener('pointerdown', (e) => { startX = e.clientX; });
  carousel.addEventListener('pointerup', (e) => {
    const diff = e.clientX - startX;
    if (Math.abs(diff) > 50) goTo(current + (diff < 0 ? 1 : -1));
  });
}

// ── Fullscreen Viewer ─────────────────────────────────────────────────────
function openFullscreen(src, alt) {
  let viewer = document.getElementById('fullscreen-viewer');
  if (!viewer) {
    viewer = document.createElement('div');
    viewer.id = 'fullscreen-viewer';
    viewer.className = 'fullscreen-viewer';
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-modal', 'true');
    viewer.setAttribute('aria-label', 'Full-screen photo');
    viewer.innerHTML = `
      <img class="fullscreen-viewer-img" src="" alt="">
      <button class="fullscreen-viewer-close icon-btn" aria-label="Close photo viewer">✕</button>`;
    document.body.appendChild(viewer);
    viewer.querySelector('.fullscreen-viewer-close').addEventListener('click', () => viewer.classList.remove('open'));
    viewer.addEventListener('click', (e) => { if (e.target === viewer) viewer.classList.remove('open'); });
    viewer.addEventListener('keydown', (e) => { if (e.key === 'Escape') viewer.classList.remove('open'); });
  }
  viewer.querySelector('img').src = src;
  viewer.querySelector('img').alt = alt;
  viewer.classList.add('open');
  viewer.querySelector('.fullscreen-viewer-close').focus();
}

// ── Skeleton cards ────────────────────────────────────────────────────────
function renderSkeletons(count) {
  return Array.from({ length: count }).map(() => `
    <div class="skeleton-card post-card" aria-hidden="true">
      <div class="skeleton-row">
        <div class="skeleton skeleton-avatar"></div>
        <div class="skeleton-text-group">
          <div class="skeleton skeleton-line" style="width:60%"></div>
          <div class="skeleton skeleton-line" style="width:35%"></div>
        </div>
      </div>
      <div class="skeleton skeleton-image"></div>
      <div class="skeleton skeleton-line" style="width:80%;margin:8px 16px"></div>
    </div>`).join('');
}

function renderEmptyFeed() {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">📷</div>
      <h2>Nothing shared yet.</h2>
      <p>Be the first to post!</p>
    </div>`;
}

// ── Admin check (cached from group data) ─────────────────────────────────
const _adminCache = new Map();
export function setGroupAdminCache(groupId, userId, isAdmin) {
  _adminCache.set(`${groupId}:${userId}`, isAdmin);
}
function isAdminOf(groupId, userId) {
  return _adminCache.get(`${groupId}:${userId}`) === true;
}
