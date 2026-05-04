// js/storage.js — Image compression and Firebase Storage uploads
import { storage } from '../firebase-config.js';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// ── HEIC/HEIF Detection & Conversion ──────────────────────────────────────
// iPhones save photos as HEIC by default. Most non-Safari browsers can't
// decode HEIC in an <img> tag, so we convert to JPEG first using heic2any.
// The library (~460 KB) is lazy-loaded from CDN only when a HEIC file is
// actually selected, so it doesn't affect normal load times.

function isHeicFile(file) {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/heic' || type === 'image/heif') return true;
  return /\.heic$|\.heif$/i.test(file.name || '');
}

let _heic2any = null;
async function convertHeicToJpeg(file) {
  if (!_heic2any) {
    // Load heic2any from CDN (cdn.jsdelivr.net is in SW passthrough list)
    const mod = await import('https://cdn.jsdelivr.net/npm/heic2any@0.0.4/+esm');
    _heic2any = mod.default;
  }

  // Race the conversion against a 30-second timeout.
  // heic2any can hang indefinitely on some HEIC files — this ensures
  // we fail fast instead of freezing the "Processing Photos..." state.
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('HEIC conversion timed out after 30s')), 30000)
  );
  const result = await Promise.race([
    _heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 }),
    timeout,
  ]);
  return Array.isArray(result) ? result[0] : result;
}

// ── Image Compression ─────────────────────────────────────────────────────
export async function compressImage(file, maxDimension = 1920, quality = 0.82) {
  // Convert HEIC/HEIF to JPEG first if needed
  let sourceFile = file;
  if (isHeicFile(file)) {
    try {
      sourceFile = await convertHeicToJpeg(file);
    } catch (err) {
      console.error('HEIC conversion failed:', err);
      return null;
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(sourceFile);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width  = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => { URL.revokeObjectURL(url); resolve(blob ? { blob, width, height } : null); },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// ── Upload a single photo with progress callback ──────────────────────────
// Returns { url, storagePath, width, height }
export function uploadPhoto(blob, storagePath, onProgress) {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, blob, { contentType: 'image/jpeg' });

    task.on(
      'state_changed',
      (snapshot) => {
        const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(pct);
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({ url, storagePath });
      }
    );
  });
}

// ── Upload all photos for a post ──────────────────────────────────────────
// preparedPhotos: Array of { blob, width, height }
// groupId, postId: strings
// onProgress(overall 0–100): optional
// Returns array of { url, storagePath, width, height }
export async function uploadPostPhotos(preparedPhotos, groupId, postId, onProgress) {
  const results = [];
  for (let i = 0; i < preparedPhotos.length; i++) {
    const photo = preparedPhotos[i];
    const storagePath = `groups/${groupId}/posts/${postId}/${i}.jpg`;
    
    const { url } = await uploadPhoto(photo.blob, storagePath, (pct) => {
      if (onProgress) {
        const overall = ((i + pct / 100) / preparedPhotos.length) * 100;
        onProgress(Math.round(overall));
      }
    });
    results.push({ url, storagePath, width: photo.width, height: photo.height });
  }
  return results;
}

// ── Delete photos from Storage ────────────────────────────────────────────
export async function deletePhoto(storagePath) {
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (err) {
    console.warn('Failed to delete photo:', storagePath, err);
  }
}

export async function deletePostPhotos(photos) {
  await Promise.all(photos.map((p) => deletePhoto(p.storagePath)));
}
