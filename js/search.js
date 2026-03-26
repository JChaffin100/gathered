import { db } from '../firebase-config.js';
import { collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { escapeHtml, openDetailEvent } from './utils.js';

let _searchCache = null;
let _isLoading = false;

// Call this every time the search tab is opened via app.js
export async function initSearch(userGroups) {
  // Only load the cache once per app session to preserve reads!
  if (_searchCache !== null || _isLoading) return;

  _isLoading = true;
  const statusEl = document.getElementById('search-status-text');
  if (statusEl) statusEl.textContent = 'Loading recent posts into memory...';

  try {
    const allPosts = [];
    let groupCount = 0;

    await Promise.all(userGroups.map(async (g) => {
      try {
        const q = query(
          collection(db, 'groups', g.id, 'posts'),
          orderBy('createdAt', 'desc'),
          limit(300)
        );
        const snap = await getDocs(q);
        if (!snap.empty) groupCount++;
        
        snap.forEach((doc) => {
          allPosts.push({ ...doc.data(), id: doc.id, groupId: g.id, groupName: g.name });
        });
      } catch (err) {
        console.warn(`Search cache could not load group ${g.id}`, err);
      }
    }));

    // Sort globally by descending time
    allPosts.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });

    _searchCache = allPosts;

    if (statusEl) {
      statusEl.textContent = `Searched ${_searchCache.length} recent posts across ${groupCount} group${groupCount !== 1 ? 's' : ''}.`;
    }

  } catch (err) {
    console.error('Search init err:', err);
    if (statusEl) statusEl.textContent = 'Could not load search cache.';
  } finally {
    _isLoading = false;
  }
}

// ── Live Filtering ────────────────────────────────────────────────────────
const searchInput = document.getElementById('global-search-input');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    runSearch(e.target.value);
  });
}

function runSearch(queryStr) {
  const grid = document.getElementById('search-results-grid');
  if (!grid || !_searchCache) return;

  const text = queryStr.trim().toLowerCase();
  
  if (!text) {
    grid.innerHTML = '';
    return;
  }

  // Find matches
  const results = _searchCache.filter((post) => {
    if (post.authorName && post.authorName.toLowerCase().includes(text)) return true;
    if (post.caption && post.caption.toLowerCase().includes(text)) return true;
    if (post.photos && post.photos.length > 0) {
      if (post.photos.some(p => p.caption && p.caption.toLowerCase().includes(text))) return true;
    }
    return false;
  });

  if (results.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1; margin-top: 40px;">
        <div class="empty-state-icon">😕</div>
        <h2>No results found</h2>
        <p>Try a different keyword.</p>
      </div>`;
    return;
  }

  // Render Grid
  grid.innerHTML = results.map((post) => {
    const thumb = post.photos?.[0]?.url || '';
    const multi = post.photos?.length > 1;
    // We add a tiny absolute badge to indicate the group context!
    return `
      <button class="profile-grid-item" style="position:relative;" data-post-id="${post.id}" data-group-id="${post.groupId}" aria-label="View post from ${escapeHtml(post.groupName)}">
        <img src="${escapeHtml(thumb)}" alt="Search result" loading="lazy">
        ${multi ? '<span class="profile-grid-multi-badge" aria-hidden="true">🔲</span>' : ''}
        <span class="search-group-badge">${escapeHtml(post.groupName)}</span>
      </button>`;
  }).join('');

  grid.querySelectorAll('.profile-grid-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      // Clear input so it resets on back navigation, or keep it? Keeping it is better UX.
      openDetailEvent(btn.dataset.postId, btn.dataset.groupId);
    });
  });
}
