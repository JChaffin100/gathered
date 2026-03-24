// js/utils.js — Shared helpers

// ── Toast System ─────────────────────────────────────────────────────────
export function showToast(message, type = 'info') {
  const region = document.getElementById('toast-region');
  if (!region) return;

  const toast = document.createElement('div');
  toast.className = `toast${type === 'success' ? ' toast-success' : type === 'error' ? ' toast-error' : ''}`;
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  region.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 3000);
}

// ── Time Formatting ───────────────────────────────────────────────────────
export function timeAgo(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60)  return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

export function isoDate(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toISOString().split('T')[0];
}

// ── UUID ──────────────────────────────────────────────────────────────────
export function generateUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Focus Trap ────────────────────────────────────────────────────────────
export function trapFocus(element) {
  const focusable = element.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];

  const handler = (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  };

  element.addEventListener('keydown', handler);
  first.focus();

  return () => element.removeEventListener('keydown', handler);
}

// ── Bottom Sheet Helpers ──────────────────────────────────────────────────
let _trapCleanup = null;
let _triggerElement = null;

export function openSheet(backdropId) {
  const backdrop = document.getElementById(backdropId);
  if (!backdrop) return;
  _triggerElement = document.activeElement;
  backdrop.classList.add('open');
  backdrop.removeAttribute('aria-hidden');
  const sheet = backdrop.querySelector('.sheet');
  if (sheet) _trapCleanup = trapFocus(sheet);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSheet(backdropId);
  }, { once: true });

  backdrop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet(backdropId);
  }, { once: true });
}

export function closeSheet(backdropId) {
  const backdrop = document.getElementById(backdropId);
  if (!backdrop) return;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
  if (_trapCleanup) { _trapCleanup(); _trapCleanup = null; }
  if (_triggerElement) { _triggerElement.focus(); _triggerElement = null; }
}

// ── Confirm Bottom Sheet ──────────────────────────────────────────────────
export function confirmSheet({ icon = '', message, confirmLabel = 'Confirm', danger = false, onConfirm }) {
  const existing = document.getElementById('confirm-sheet-backdrop');
  if (existing) existing.remove();

  const html = `
    <div id="confirm-sheet-backdrop" class="sheet-backdrop" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Confirmation">
      <div class="sheet" role="document">
        <div class="sheet-header">
          <span class="sheet-title">Confirm</span>
          <button class="icon-btn" aria-label="Cancel" id="confirm-sheet-cancel">✕</button>
        </div>
        <div class="sheet-body">
          ${icon ? `<div class="confirm-sheet-icon">${icon}</div>` : ''}
          <p class="confirm-sheet-message">${message}</p>
          <div class="confirm-sheet-actions">
            <button class="btn btn-full ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-sheet-ok">${confirmLabel}</button>
            <button class="btn btn-secondary btn-full" id="confirm-sheet-cancel2">Cancel</button>
          </div>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  const backdrop = document.getElementById('confirm-sheet-backdrop');
  const dismiss = () => { backdrop.remove(); };

  backdrop.querySelector('#confirm-sheet-cancel').addEventListener('click', dismiss);
  backdrop.querySelector('#confirm-sheet-cancel2').addEventListener('click', dismiss);
  backdrop.querySelector('#confirm-sheet-ok').addEventListener('click', () => { dismiss(); onConfirm(); });
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) dismiss(); });

  requestAnimationFrame(() => {
    backdrop.classList.add('open');
    backdrop.removeAttribute('aria-hidden');
    const sheet = backdrop.querySelector('.sheet');
    trapFocus(sheet);
  });
}

// ── Network Status ────────────────────────────────────────────────────────
export function isOnline() { return navigator.onLine; }

// ── Navigation Events (avoids circular imports) ───────────────────────────
export function navigate(screen, options = {}) {
  window.dispatchEvent(new CustomEvent('gathered:navigate', { detail: { screen, options } }));
}

export function openDetailEvent(postId, groupId) {
  window.dispatchEvent(new CustomEvent('gathered:openDetail', { detail: { postId, groupId } }));
}

// ── Escape HTML ───────────────────────────────────────────────────────────
export function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
