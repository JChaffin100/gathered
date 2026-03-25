// js/groups.js — Group creation, joining, management
import { db } from '../firebase-config.js';
import { auth } from './auth.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { storage } from '../firebase-config.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { generateUUID, showToast, confirmSheet, openSheet, closeSheet, escapeHtml, timeAgo, navigate } from './utils.js';

// ── Create Group ──────────────────────────────────────────────────────────
export async function createGroup(name, coverFile) {
  if (!name || name.trim().length === 0 || name.length > 50) {
    showToast('Group name must be 1–50 characters.', 'error');
    return null;
  }

  const user = auth.currentUser;
  if (!user) return null;

  try {
    let photoURL = null;
    const groupRef = doc(collection(db, 'groups'));
    const groupId = groupRef.id;

    if (coverFile) {
      const coverRef = ref(storage, `groups/${groupId}/cover/cover.jpg`);
      const snap = await uploadBytes(coverRef, coverFile);
      photoURL = await getDownloadURL(snap.ref);
    }

    const inviteToken = generateUUID();
    const memberObj = {
      displayName: user.displayName || 'Anonymous',
      photoURL:    user.photoURL || '',
      role:        'admin',
      joinedAt:    serverTimestamp(),
    };

    await setDoc(groupRef, {
      id:          groupId,
      name:        name.trim(),
      photoURL,
      createdBy:   user.uid,
      createdAt:   serverTimestamp(),
      members:     { [user.uid]: memberObj },
      inviteToken,
      memberCount: 1,
    });

    // Also update user's groupIds
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { groupIds: arrayUnion(groupId) });

    showToast('Group created!', 'success');
    return groupId;
  } catch (err) {
    console.error('createGroup error:', err);
    showToast('Could not create group. Try again.', 'error');
    return null;
  }
}

// ── Find group by invite token ────────────────────────────────────────────
export async function findGroupByToken(token) {
  try {
    const q = query(collection(db, 'groups'), where('inviteToken', '==', token));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const groupDoc = snap.docs[0];
    return { id: groupDoc.id, ...groupDoc.data() };
  } catch (err) {
    console.error('findGroupByToken error:', err);
    return null;
  }
}

// ── Join Group ────────────────────────────────────────────────────────────
export async function joinGroup(group) {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    const groupRef = doc(db, 'groups', group.id);
    if (group.members && group.members[user.uid]) {
      showToast("You're already in this group!", 'info');
      return true;
    }

    const memberObj = {
      displayName: user.displayName || 'Anonymous',
      photoURL:    user.photoURL || '',
      role:        'member',
      joinedAt:    serverTimestamp(),
    };

    await updateDoc(groupRef, {
      [`members.${user.uid}`]: memberObj,
      memberCount: (group.memberCount || 1) + 1,
    });

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { groupIds: arrayUnion(group.id) });

    showToast(`Joined ${group.name}!`, 'success');
    return group.id;
  } catch (err) {
    console.error('joinGroup error:', err);
    showToast('Could not join group. Try again.', 'error');
    return false;
  }
}

// ── Remove Member ─────────────────────────────────────────────────────────
export async function removeMember(groupId, userId) {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const snap = await getDoc(groupRef);
    const group = snap.data();
    const newMembers = { ...group.members };
    delete newMembers[userId];

    await updateDoc(groupRef, {
      members:     newMembers,
      memberCount: Math.max(0, (group.memberCount || 1) - 1),
    });

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { groupIds: arrayRemove(groupId) });

    showToast('Member removed.', 'success');
  } catch (err) {
    console.error('removeMember error:', err);
    showToast('Could not remove member.', 'error');
  }
}

// ── Reset Invite Token ────────────────────────────────────────────────────
export async function resetInviteToken(groupId) {
  const newToken = generateUUID();
  try {
    await updateDoc(doc(db, 'groups', groupId), { inviteToken: newToken });
    showToast('Invite link reset.', 'success');
    return newToken;
  } catch (err) {
    console.error('resetInviteToken error:', err);
    showToast('Could not reset link.', 'error');
    return null;
  }
}

// ── Update Group Info ─────────────────────────────────────────────────────
export async function updateGroupInfo(groupId, name, coverFile) {
  const updates = {};
  if (name) updates.name = name.trim();

  if (coverFile) {
    const coverRef = ref(storage, `groups/${groupId}/cover/cover.jpg`);
    const snap = await uploadBytes(coverRef, coverFile);
    updates.photoURL = await getDownloadURL(snap.ref);
  }

  try {
    await updateDoc(doc(db, 'groups', groupId), updates);
    showToast('Group updated.', 'success');
  } catch (err) {
    console.error('updateGroupInfo error:', err);
    showToast('Could not update group.', 'error');
  }
}

// ── Delete Group ──────────────────────────────────────────────────────────
export async function deleteGroup(groupId) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const groupRef = doc(db, 'groups', groupId);
    const snap = await getDoc(groupRef);
    if (!snap.exists()) return;
    const group = snap.data();

    // Remove group from all members' groupIds
    const memberUpdates = Object.keys(group.members || {}).map((uid) => {
      const userRef = doc(db, 'users', uid);
      return updateDoc(userRef, { groupIds: arrayRemove(groupId) }).catch(() => {});
    });
    await Promise.all(memberUpdates);

    await deleteDoc(groupRef);
    showToast('Group deleted.', 'success');
  } catch (err) {
    console.error('deleteGroup error:', err);
    showToast('Could not delete group.', 'error');
  }
}

// ── Get User's Groups ─────────────────────────────────────────────────────
export async function getUserGroups(groupIds) {
  if (!groupIds || groupIds.length === 0) return [];
  try {
    const promises = groupIds.map((id) => getDoc(doc(db, 'groups', id)));
    const snaps = await Promise.all(promises);
    return snaps.filter((s) => s.exists()).map((s) => ({ id: s.id, ...s.data() }));
  } catch (err) {
    console.error('getUserGroups error:', err);
    return [];
  }
}

// ── Render Group Settings Sheet ───────────────────────────────────────────
export function renderGroupSettings(group, currentUserId) {
  const isAdmin = group.members?.[currentUserId]?.role === 'admin';
  const inviteUrl = `${location.origin}${location.pathname}?token=${group.inviteToken}`;

  const sheet = document.getElementById('group-settings-sheet');
  if (!sheet) return;

  sheet.innerHTML = `
    <div class="sheet-header">
      <h2 class="sheet-title">${escapeHtml(group.name)}</h2>
      <button class="icon-btn" aria-label="Close group settings" id="gs-close">✕</button>
    </div>
    <div class="sheet-body" style="padding-bottom:24px">

      ${isAdmin ? `
      <!-- Group Info -->
      <div class="settings-section-title">Group Info</div>
      <div class="settings-section" style="padding:16px;border-radius:var(--radius-md);margin-bottom:12px">
        <div class="input-group" style="margin-bottom:12px">
          <label for="gs-name-input">Group Name</label>
          <input type="text" id="gs-name-input" value="${escapeHtml(group.name)}" maxlength="50" aria-label="Group name">
        </div>
        <button class="btn btn-primary btn-full" id="gs-save-btn">Save Changes</button>
      </div>
      ` : ''}

      <!-- Members -->
      <div class="settings-section-title">Members (${group.memberCount || Object.keys(group.members || {}).length})</div>
      <ul class="members-list settings-section" id="gs-members-list" aria-label="Group members">
        ${Object.entries(group.members || {}).map(([uid, m]) => `
          <li class="member-row">
            <img class="avatar avatar-40" src="${escapeHtml(m.photoURL || '')}" alt="${escapeHtml(m.displayName)}" onerror="this.src=''">
            <div class="member-info">
              <div class="member-name">${escapeHtml(m.displayName)}</div>
              <div class="member-meta">Joined ${m.joinedAt ? timeAgo(m.joinedAt) : 'recently'}</div>
            </div>
            ${m.role === 'admin' ? '<span class="member-role-badge crown" aria-label="Admin">Admin</span>' : ''}
            ${isAdmin && uid !== currentUserId ? `
              <button class="member-remove-btn" aria-label="Remove ${escapeHtml(m.displayName)}" data-uid="${uid}">✕</button>
            ` : ''}
          </li>
        `).join('')}
      </ul>

      <!-- Invite Link -->
      ${isAdmin ? `
      <div class="settings-section-title">Invite Link</div>
      <div class="settings-section" style="padding:16px;border-radius:var(--radius-md);margin-bottom:12px">
        <div class="invite-link-box" id="gs-invite-url">${escapeHtml(inviteUrl)}</div>
        <p class="invite-link-note">Anyone with this link can join your group.</p>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-secondary" style="flex:1" id="gs-copy-link">Copy Link</button>
          <button class="btn btn-secondary" style="flex:1" id="gs-reset-link">Reset Link</button>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="danger-zone">
        <div class="danger-zone-title">Danger Zone</div>
        <p>This will permanently delete all posts and photos in this group.</p>
        <button class="btn btn-danger btn-full" id="gs-delete-group">Delete Group</button>
      </div>
      ` : ''}
    </div>`;

  document.getElementById('gs-close')?.addEventListener('click', () => closeSheet('group-settings-backdrop'));

  if (isAdmin) {
    document.getElementById('gs-save-btn')?.addEventListener('click', async () => {
      const name = document.getElementById('gs-name-input').value.trim();
      await updateGroupInfo(group.id, name, null);
    });

    document.getElementById('gs-copy-link')?.addEventListener('click', () => {
      navigator.clipboard.writeText(inviteUrl).then(() => showToast('Copied invite link!', 'success'));
    });

    document.getElementById('gs-reset-link')?.addEventListener('click', async () => {
      confirmSheet({
        icon: '🔗',
        message: 'The old invite link will stop working immediately.',
        confirmLabel: 'Reset Link',
        onConfirm: async () => {
          const newToken = await resetInviteToken(group.id);
          if (newToken) {
            const newUrl = `${location.origin}${location.pathname}?token=${newToken}`;
            document.getElementById('gs-invite-url').textContent = newUrl;
          }
        },
      });
    });

    document.getElementById('gs-delete-group')?.addEventListener('click', () => {
      confirmSheet({
        icon: '🗑️',
        message: `Delete "${escapeHtml(group.name)}"? This will permanently delete all posts and photos.`,
        confirmLabel: 'Delete Group',
        danger: true,
        onConfirm: async () => {
          await deleteGroup(group.id);
          closeSheet('group-settings-backdrop');
          navigate('feed');
          location.reload();
        },
      });
    });

    // Remove member buttons
    document.getElementById('gs-members-list')?.querySelectorAll('.member-remove-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.uid;
        const name = btn.getAttribute('aria-label').replace('Remove ', '');
        confirmSheet({
          icon: '👤',
          message: `Remove ${name} from ${escapeHtml(group.name)}? They will lose access to all posts.`,
          confirmLabel: 'Remove',
          danger: true,
          onConfirm: async () => {
            await removeMember(group.id, uid);
            btn.closest('.member-row').remove();
          },
        });
      });
    });
  }
}
