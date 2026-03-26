// js/post.js — Create Post, Post Detail, Edit Post, Comments
import { db } from '../firebase-config.js';
import { auth } from './auth.js';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  increment,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { uploadPostPhotos, compressImage } from './storage.js';
import { showToast, escapeHtml, timeAgo, isoDate, isOnline, confirmSheet, openSheet, closeSheet, trapFocus, navigate } from './utils.js';

// ── Post Detail ───────────────────────────────────────────────────────────
let _commentUnsubscribe = null;

export function openPostDetail(postId, groupId) {
  navigate('post-detail');
  loadPostDetail(postId, groupId);
}

async function loadPostDetail(postId, groupId) {
  const main = document.querySelector('#screen-post-detail .screen-body');
  if (!main) return;
  main.innerHTML = '<div class="empty-state" aria-live="polite">Loading...</div>';

  if (_commentUnsubscribe) { _commentUnsubscribe(); _commentUnsubscribe = null; }

  try {
    const postSnap = await getDoc(doc(db, 'groups', groupId, 'posts', postId));
    if (!postSnap.exists()) { main.innerHTML = '<div class="empty-state"><h2>Post not found.</h2></div>'; return; }

    const post = postSnap.data();
    const user = auth.currentUser;
    const isAuthor = user?.uid === post.authorId;

    main.innerHTML = `
      <!-- Photos -->
      <div class="post-detail-photos post-carousel" data-post-id="${postId}">
        <div class="carousel-track">
          ${(post.photos || []).map((p, i) => `
            <div class="carousel-slide">
              <img class="post-photo" src="${escapeHtml(p.url)}" alt="${post.caption ? escapeHtml(post.caption) : escapeHtml(post.authorName) + "'s photo"}" style="max-height:none;object-fit:contain;background:#000">
              ${p.caption ? `<p class="post-detail-photo-caption">${escapeHtml(p.caption)}</p>` : ''}
            </div>
          `).join('')}
        </div>
        ${post.photos?.length > 1 ? `<div class="carousel-dots" aria-hidden="true">${post.photos.map((_, i) => `<div class="carousel-dot${i === 0 ? ' active' : ''}"></div>`).join('')}</div>` : ''}
      </div>

      ${post.caption ? `<p class="post-detail-caption">${escapeHtml(post.caption)}</p>` : ''}

      <!-- Reactions -->
      <div class="reaction-row" role="group" aria-label="Reactions" style="border-bottom:1px solid var(--border)">
        ${['heart','haha','wow','sad'].map((type) => {
          const emoji = { heart: '❤️', haha: '😂', wow: '😮', sad: '😢' }[type];
          const count = (post.reactionCounts || {})[type] || 0;
          return `<button class="reaction-btn" data-type="${type}" data-post-id="${postId}" data-group-id="${groupId}" aria-label="${emoji} ${count} ${type} reactions" aria-pressed="false">
            <span class="emoji" aria-hidden="true">${emoji}</span>
            <span class="reaction-count">${count}</span>
          </button>`;
        }).join('')}
      </div>

      <!-- Comments -->
      <div class="comments-section">
        <h2 class="comments-heading">Comments</h2>
        <ul id="comment-list" aria-live="polite" aria-relevant="additions" aria-label="Comments"></ul>
      </div>

      <!-- Comment input -->
      <div class="comment-input-bar">
        <img class="avatar avatar-32" src="${escapeHtml(user?.photoURL || '')}" alt="${escapeHtml(user?.displayName || 'You')}" aria-hidden="true">
        <label for="comment-input" class="sr-only">Add a comment</label>
        <textarea id="comment-input" class="comment-input" placeholder="Add a comment..." rows="1" maxlength="500" aria-label="Add a comment"></textarea>
        <button class="comment-send-btn icon-btn" id="comment-send" aria-label="Send comment" disabled>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>`;

    // Carousel swipe
    initDetailCarousel(main.querySelector('.post-carousel'));

    // Reactions
    main.querySelectorAll('.reaction-btn').forEach((btn) => {
      btn.addEventListener('click', () => detailToggleReaction(postId, groupId, btn.dataset.type, btn, main));
    });

    // Comment input
    const textarea = document.getElementById('comment-input');
    const sendBtn  = document.getElementById('comment-send');
    textarea?.addEventListener('input', () => {
      sendBtn.disabled = textarea.value.trim().length === 0;
    });
    sendBtn?.addEventListener('click', () => submitComment(postId, groupId, textarea, sendBtn));
    textarea?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled) submitComment(postId, groupId, textarea, sendBtn); }
    });

    // Load comments live
    _commentUnsubscribe = subscribeComments(postId, groupId);

  } catch (err) {
    console.error('loadPostDetail error:', err);
    showToast('Could not load post.', 'error');
  }
}

function initDetailCarousel(carousel) {
  if (!carousel) return;
  const track = carousel.querySelector('.carousel-track');
  const dots  = carousel.querySelectorAll('.carousel-dot');
  let current = 0, startX = 0;

  const goTo = (i) => {
    const slides = track.querySelectorAll('.carousel-slide');
    current = Math.max(0, Math.min(i, slides.length - 1));
    track.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, idx) => d.classList.toggle('active', idx === current));
  };
  carousel.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    carousel.setPointerCapture(e.pointerId);
  });
  carousel.addEventListener('pointerup', (e) => {
    const diff = e.clientX - startX;
    if (Math.abs(diff) > 50) goTo(current + (diff < 0 ? 1 : -1));
  });
  carousel.addEventListener('pointermove', (e) => {
    if (Math.abs(e.clientX - startX) > 10) e.preventDefault();
  }, { passive: false });
}

// ── Comments ──────────────────────────────────────────────────────────────
function subscribeComments(postId, groupId) {
  const q = query(
    collection(db, 'groups', groupId, 'posts', postId, 'comments'),
    orderBy('createdAt', 'asc')
  );

  const list = document.getElementById('comment-list');
  list.innerHTML = '<li class="skeleton-comment"><div class="skeleton skeleton-avatar avatar-32"></div><div style="flex:1"><div class="skeleton skeleton-line" style="width:50%;height:12px;margin-bottom:6px"></div><div class="skeleton skeleton-line" style="width:80%;height:12px"></div></div></li>';

  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      list.innerHTML = '<li class="empty-state" style="padding:24px"><p>Be the first to comment!</p></li>';
      return;
    }
    list.innerHTML = '';
    snap.forEach((d) => list.appendChild(buildCommentItem(d, postId, groupId)));
  });
}

function buildCommentItem(docSnap, postId, groupId) {
  const c = docSnap.data();
  const user = auth.currentUser;
  const isOwn = user?.uid === c.authorId;
  const li = document.createElement('li');
  li.className = 'comment-item';
  li.id = `comment-${docSnap.id}`;

  li.innerHTML = `
    <img class="avatar avatar-32" src="${escapeHtml(c.authorPhotoURL || '')}" alt="${escapeHtml(c.authorName)}" onerror="this.style.display='none'">
    <div class="comment-body">
      <span class="comment-author">${escapeHtml(c.authorName)}</span>
      <p class="comment-text">${escapeHtml(c.text)}</p>
      <time class="comment-time" datetime="${isoDate(c.createdAt)}">${timeAgo(c.createdAt)}</time>
    </div>`;

  if (isOwn) {
    li.addEventListener('pointerdown', (e) => {
      const timer = setTimeout(() => {
        confirmSheet({
          icon: '💬',
          message: 'Delete this comment?',
          confirmLabel: 'Delete',
          danger: true,
          onConfirm: () => deleteComment(docSnap.id, postId, groupId),
        });
      }, 600);
      li.addEventListener('pointerup', () => clearTimeout(timer), { once: true });
      li.addEventListener('pointercancel', () => clearTimeout(timer), { once: true });
    });
  }

  return li;
}

async function submitComment(postId, groupId, textarea, sendBtn) {
  const text = textarea.value.trim();
  if (!text || text.length < 1 || text.length > 500) return;
  if (!isOnline()) { showToast("You're offline.", 'error'); return; }

  const user = auth.currentUser;
  if (!user) return;

  sendBtn.disabled = true;
  try {
    const commentsRef = collection(db, 'groups', groupId, 'posts', postId, 'comments');
    await addDoc(commentsRef, {
      authorId:      user.uid,
      authorName:    user.displayName || 'Anonymous',
      authorPhotoURL: user.photoURL || '',
      text,
      createdAt:     serverTimestamp(),
    });
    await updateDoc(doc(db, 'groups', groupId, 'posts', postId), {
      commentCount: increment(1),
      lastEngagedAt: serverTimestamp(),
    });
    textarea.value = '';
  } catch (err) {
    console.error('submitComment error:', err);
    showToast('Could not post comment. Try again.', 'error');
  } finally {
    sendBtn.disabled = true; // stays disabled until text entered again
  }
}

async function deleteComment(commentId, postId, groupId) {
  try {
    await deleteDoc(doc(db, 'groups', groupId, 'posts', postId, 'comments', commentId));
    await updateDoc(doc(db, 'groups', groupId, 'posts', postId), { commentCount: increment(-1) });
    showToast('Comment deleted.', 'success');
  } catch (err) {
    console.error('deleteComment error:', err);
    showToast('Could not delete comment.', 'error');
  }
}

// ── Reactions in detail view ──────────────────────────────────────────────
async function detailToggleReaction(postId, groupId, type, clickedBtn, container) {
  const user = auth.currentUser;
  if (!user) return;
  if (!isOnline()) { showToast("You're offline.", 'error'); return; }

  const { doc: fbDoc, getDoc: fbGetDoc, deleteDoc: fbDeleteDoc, setDoc: fbSetDoc, updateDoc: fbUpdateDoc, increment: fbIncrement, serverTimestamp: fbServerTimestamp } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

  const reactionRef = fbDoc(db, 'groups', groupId, 'posts', postId, 'reactions', user.uid);
  const postRef     = fbDoc(db, 'groups', groupId, 'posts', postId);

  try {
    const snap = await fbGetDoc(reactionRef);
    if (snap.exists()) {
      const oldType = snap.data().type;
      await fbDeleteDoc(reactionRef);
      await fbUpdateDoc(postRef, { [`reactionCounts.${oldType}`]: fbIncrement(-1) });
      const oldBtn = container.querySelector(`.reaction-btn[data-type="${oldType}"]`);
      if (oldBtn) {
        oldBtn.classList.remove('active'); oldBtn.setAttribute('aria-pressed', 'false');
        const c = parseInt(oldBtn.querySelector('.reaction-count').textContent, 10);
        oldBtn.querySelector('.reaction-count').textContent = Math.max(0, c - 1);
      }
      if (oldType === type) return;
    }
    await fbSetDoc(reactionRef, { userId: user.uid, type, createdAt: fbServerTimestamp() });
    await fbUpdateDoc(postRef, { [`reactionCounts.${type}`]: fbIncrement(1), lastEngagedAt: fbServerTimestamp() });
    container.querySelectorAll('.reaction-btn').forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    clickedBtn.classList.add('active'); clickedBtn.setAttribute('aria-pressed', 'true');
    const c = parseInt(clickedBtn.querySelector('.reaction-count').textContent, 10);
    clickedBtn.querySelector('.reaction-count').textContent = c + 1;
  } catch (err) {
    console.error('detailToggleReaction error:', err);
    showToast('Could not save reaction.', 'error');
  }
}

// ── Create Post Sheet ─────────────────────────────────────────────────────
let _selectedFiles = [];
let _isProcessingPhotos = false;
let _currentGroupId = null;

function clearSelectedPhotos() {
  _selectedFiles.forEach((f) => {
    if (f.tempUrl) URL.revokeObjectURL(f.tempUrl);
    if (f.objectUrl) URL.revokeObjectURL(f.objectUrl);
  });
  _selectedFiles = [];
}
export function openCreatePost(groupId, groups) {
  clearSelectedPhotos();
  _currentGroupId = groupId;
  renderCreatePostSheet(groupId, groups);
  openSheet('create-post-backdrop');
}

function renderCreatePostSheet(groupId, groups) {
  const sheet = document.getElementById('create-post-sheet');
  if (!sheet) return;

  sheet.innerHTML = `
    <div class="sheet-header">
      <div class="step-indicator" aria-hidden="true">
        <div class="step-dot active" id="step-dot-1"></div>
        <div class="step-dot" id="step-dot-2"></div>
      </div>
      <h2 class="sheet-title" id="create-post-title">New Post</h2>
      <button class="icon-btn" aria-label="Close post editor" id="create-post-close">✕</button>
    </div>
    <div class="sheet-body" id="create-post-body">
      <!-- Step 1: Photo selection -->
      <div id="step-1">
        <input type="file" id="photo-input" accept="image/*" multiple style="display:none" aria-label="Select photos">
        <label for="photo-input" class="photo-picker-area" role="button" tabindex="0" aria-label="Tap to select photos">
          <span class="photo-picker-icon" aria-hidden="true">🖼️</span>
          <span class="photo-picker-label">Tap to select photos<br><small style="font-size:12px;color:var(--text-muted)">Up to 10 photos</small></span>
        </label>
        <div id="selected-photos-grid" class="selected-photos-grid"></div>
        <p class="photo-count-label" id="photo-count-label" aria-live="polite"></p>
        <button class="btn btn-primary btn-full" id="step1-next" disabled>Next: Add Caption</button>
      </div>

      <!-- Step 2: Captions (hidden initially) -->
      <div id="step-2" style="display:none">
        <div class="input-group" style="margin-bottom:16px">
          <label for="post-caption-input">Post Caption</label>
          <textarea id="post-caption-input" placeholder="What's happening?" maxlength="500" rows="3" aria-label="Post caption"></textarea>
        </div>
        <div id="photo-captions-list"></div>

        ${groups && groups.length > 1 ? `
        <div class="input-group" style="margin-bottom:16px">
          <label for="post-group-select" class="group-selector-label">Post to</label>
          <select id="post-group-select" aria-label="Select group">
            ${groups.map((g) => `<option value="${escapeHtml(g.id)}" ${g.id === groupId ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
          </select>
        </div>
        ` : ''}

        <div class="upload-progress-wrap" id="upload-progress-wrap" style="display:none">
          <div class="upload-progress-label">Uploading photos...</div>
          <div class="progress-bar-track"><div class="progress-bar-fill" id="upload-progress-bar" style="width:0%"></div></div>
        </div>

        <button class="btn btn-primary btn-full" id="post-submit-btn">Share</button>
      </div>
    </div>`;

  // Close
  document.getElementById('create-post-close').addEventListener('click', () => {
    if (_selectedFiles.length > 0) {
      confirmSheet({
        icon: '🖼️',
        message: 'Discard this post?',
        confirmLabel: 'Discard',
        danger: true,
        onConfirm: () => {
          clearSelectedPhotos();
          closeSheet('create-post-backdrop');
        },
      });
    } else {
      closeSheet('create-post-backdrop');
    }
  });

  // Photo picker
  const photoInput = document.getElementById('photo-input');
  photoInput.addEventListener('change', () => handleFileSelection(photoInput.files));

  document.querySelector('.photo-picker-area').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); photoInput.click(); }
  });

  document.getElementById('step1-next').addEventListener('click', () => showStep2());
  document.getElementById('post-submit-btn').addEventListener('click', () => submitPost());
}

async function handleFileSelection(files) {
  const incoming = Array.from(files).filter((f) => {
    return f.type.startsWith('image/') || !f.type || f.type === 'application/octet-stream' || f.name.match(/\.(jpe?g|png|gif|webp|heic|heif)$/i);
  });
  const spaceLeft = 10 - _selectedFiles.length;
  if (spaceLeft <= 0) {
    showToast('Maximum 10 photos reached.', 'warning');
    return;
  }

  const toPick = incoming.slice(0, spaceLeft);
  if (incoming.length > spaceLeft) {
    showToast('Limit 10 photos per post.', 'warning');
  }

  // Tag with unique IDs and generate ONE persistent temp URL to prevent leaks
  const newItems = toPick.map((f) => ({
    id: Math.random().toString(36).substring(2, 11),
    file: f,
    tempUrl: URL.createObjectURL(f),
    isReady: false
  }));

  _selectedFiles = [..._selectedFiles, ...newItems];
  renderThumbnails();

  if (_isProcessingPhotos) return;
  _isProcessingPhotos = true;

  try {
    // Keep processing until everything in the current array is ready
    while (_selectedFiles.some(f => !f.isReady)) {
      const item = _selectedFiles.find(f => !f.isReady);
      if (!item) break;

      const compressed = await compressImage(item.file);
      if (compressed) {
        item.blob = compressed.blob;
        item.width = compressed.width;
        item.height = compressed.height;
        item.objectUrl = URL.createObjectURL(compressed.blob);
        item.isReady = true;
      } else {
        showToast(`Could not process ${item.file.name}`, 'error');
        _selectedFiles = _selectedFiles.filter(f => f.id !== item.id);
        if (item.tempUrl) URL.revokeObjectURL(item.tempUrl);
      }
      renderThumbnails();
    }
  } catch (err) {
    console.error('Photo processing error:', err);
  } finally {
    _isProcessingPhotos = false;
    renderThumbnails();
  }
}

function renderThumbnails() {
  const grid  = document.getElementById('selected-photos-grid');
  const count = document.getElementById('photo-count-label');
  const next  = document.getElementById('step1-next');
  if (!grid) return;

  grid.innerHTML = _selectedFiles.map((item, i) => {
    const url = item.objectUrl || item.tempUrl;
    return `
      <div class="photo-thumb-wrap">
        <img class="photo-thumb" src="${url}" alt="Selected photo ${i + 1}" ${!item.isReady ? 'style="opacity:0.5"' : ''}>
        <button class="photo-thumb-remove" aria-label="Remove photo ${i + 1}" data-id="${item.id}">✕</button>
      </div>`;
  }).join('');

  const pickerArea = document.querySelector('.photo-picker-area');
  if (pickerArea) {
    pickerArea.style.display = _selectedFiles.length >= 10 ? 'none' : 'flex';
  }

  grid.querySelectorAll('.photo-thumb-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const index = _selectedFiles.findIndex(f => f.id === id);
      if (index > -1) {
        const item = _selectedFiles[index];
        if (item.tempUrl) URL.revokeObjectURL(item.tempUrl);
        if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
        _selectedFiles.splice(index, 1);
      }
      renderThumbnails();
    });
  });

  if (count) count.textContent = _selectedFiles.length > 0 ? `${_selectedFiles.length} of 10 photo${_selectedFiles.length !== 1 ? 's' : ''} selected` : '';
  if (next) {
    const isProcessing = _selectedFiles.some((f) => !f.isReady);
    if (!isProcessing) {
      next.disabled = _selectedFiles.length === 0;
      next.textContent = 'Next: Add Caption';
    } else {
      next.disabled = true;
      next.textContent = 'Processing Photos...';
    }
  }
}

function showStep2() {
  document.getElementById('step-1').style.display = 'none';
  document.getElementById('step-2').style.display = 'block';
  document.getElementById('step-dot-1').classList.remove('active');
  document.getElementById('step-dot-2').classList.add('active');
  document.getElementById('create-post-title').textContent = 'Add Details';

  const list = document.getElementById('photo-captions-list');
  list.innerHTML = _selectedFiles.map((item, i) => {
    const url = item.objectUrl || item.tempUrl;
    return `
      <div class="photo-caption-item">
        <img class="photo-caption-thumb" src="${url}" alt="Photo ${i + 1}">
        <div style="flex:1">
          <label for="photo-cap-${i}" class="sr-only">Caption for photo ${i + 1}</label>
          <textarea id="photo-cap-${i}" class="photo-caption-input input-group" placeholder="Caption for photo ${i + 1} (optional)" maxlength="200" rows="2" style="width:100%"></textarea>
        </div>
      </div>`;
  }).join('');

  document.getElementById('post-submit-btn').textContent = `Share with ${_currentGroupId ? 'Group' : 'Group'}`;
}

async function submitPost() {
  if (!isOnline()) { showToast("You're offline — can't post right now.", 'error'); return; }
  if (_selectedFiles.length === 0) { showToast('Select at least one photo.', 'error'); return; }

  const user = auth.currentUser;
  if (!user) return;

  const caption      = document.getElementById('post-caption-input')?.value.trim() || '';
  const groupSelect  = document.getElementById('post-group-select');
  const targetGroup  = groupSelect ? groupSelect.value : _currentGroupId;
  const photoCaptions = _selectedFiles.map((_, i) =>
    document.getElementById(`photo-cap-${i}`)?.value.trim() || ''
  );

  const submitBtn = document.getElementById('post-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading…';

  const progressWrap = document.getElementById('upload-progress-wrap');
  const progressBar  = document.getElementById('upload-progress-bar');
  progressWrap.style.display = 'block';

  try {
    // Create post doc first (to get an ID)
    const postRef = doc(collection(db, 'groups', targetGroup, 'posts'));
    const postId  = postRef.id;

    // Upload photos
    const photoData = await uploadPostPhotos(_selectedFiles, targetGroup, postId, (pct) => {
      progressBar.style.width = `${pct}%`;
    });

    // Build photos array with captions
    const photos = photoData.map((p, i) => ({
      url:         p.url,
      storagePath: p.storagePath,
      caption:     photoCaptions[i] || '',
      width:       p.width,
      height:      p.height,
    }));

    await addDoc(collection(db, 'groups', targetGroup, 'posts'), {
      id:             postId,
      authorId:       user.uid,
      authorName:     user.displayName || 'Anonymous',
      authorPhotoURL: user.photoURL || '',
      groupId:        targetGroup,
      caption,
      photos,
      reactionCounts: { heart: 0, haha: 0, wow: 0, sad: 0 },
      commentCount:   0,
      createdAt:      serverTimestamp(),
      editedAt:       null,
    });

    showToast('Post shared!', 'success');
    clearSelectedPhotos();
    closeSheet('create-post-backdrop');
  } catch (err) {
    console.error('submitPost error:', err);
    showToast('Could not share post. Try again.', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Share';
    progressWrap.style.display = 'none';
  }
}

// ── Edit Post Sheet ───────────────────────────────────────────────────────
export function openEditPost(postId, groupId, post) {
  const sheet = document.getElementById('edit-post-sheet');
  if (!sheet) return;

  let captionChanged = false;
  let photoCaptionsChanged = false;

  sheet.innerHTML = `
    <div class="sheet-header">
      <h2 class="sheet-title">Edit Post</h2>
      <button class="icon-btn" aria-label="Close post editor" id="edit-post-close">✕</button>
    </div>
    <div class="sheet-body">
      <div class="input-group" style="margin-bottom:16px">
        <label for="edit-caption-input">Post Caption</label>
        <textarea id="edit-caption-input" maxlength="500" rows="3" aria-label="Post caption">${escapeHtml(post.caption || '')}</textarea>
      </div>
      ${(post.photos || []).map((p, i) => `
        <div class="photo-caption-item">
          <img class="photo-caption-thumb" src="${escapeHtml(p.url)}" alt="Photo ${i + 1}">
          <div style="flex:1">
            <label for="edit-photo-cap-${i}" class="sr-only">Caption for photo ${i + 1}</label>
            <textarea id="edit-photo-cap-${i}" class="photo-caption-input" placeholder="Caption for photo ${i + 1} (optional)" maxlength="200" rows="2" style="width:100%">${escapeHtml(p.caption || '')}</textarea>
          </div>
        </div>`).join('')}
      <button class="btn btn-primary btn-full" id="edit-save-btn" disabled>Save Changes</button>
    </div>`;

  const captionInput = document.getElementById('edit-caption-input');
  const saveBtn = document.getElementById('edit-save-btn');

  const checkChanged = () => {
    const captionNow = captionInput.value.trim();
    const changed = captionNow !== (post.caption || '') ||
      (post.photos || []).some((p, i) => {
        const inp = document.getElementById(`edit-photo-cap-${i}`);
        return inp && inp.value.trim() !== (p.caption || '');
      });
    saveBtn.disabled = !changed;
  };

  captionInput.addEventListener('input', checkChanged);
  (post.photos || []).forEach((_, i) => {
    document.getElementById(`edit-photo-cap-${i}`)?.addEventListener('input', checkChanged);
  });

  document.getElementById('edit-post-close').addEventListener('click', () => {
    if (!saveBtn.disabled) {
      confirmSheet({
        icon: '✏️',
        message: 'Discard your changes?',
        confirmLabel: 'Discard',
        danger: true,
        onConfirm: () => closeSheet('edit-post-backdrop'),
      });
    } else {
      closeSheet('edit-post-backdrop');
    }
  });

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const newCaption = captionInput.value.trim();
      const updatedPhotos = (post.photos || []).map((p, i) => ({
        ...p,
        caption: document.getElementById(`edit-photo-cap-${i}`)?.value.trim() || '',
      }));
      await updateDoc(doc(db, 'groups', groupId, 'posts', postId), {
        caption:  newCaption,
        photos:   updatedPhotos,
        editedAt: serverTimestamp(),
      });
      showToast('Post updated!', 'success');
      closeSheet('edit-post-backdrop');
    } catch (err) {
      console.error('editPost error:', err);
      showToast('Could not save changes.', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });

  openSheet('edit-post-backdrop');
}
