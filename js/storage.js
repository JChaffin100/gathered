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
  // ── Strategy 1: Native browser HEIC decoding ──────────────────────────────
  // Android 10+ natively supports HEIC via OS codecs. Chrome exposes this
  // through createImageBitmap, which handles modern iPhone HEIC variants
  // (including HDR gain maps from iPhone 15/16) that heic2any cannot decode.
  try {
    const bitmap = await Promise.race([
      createImageBitmap(file),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('native decode timeout')), 8000)
      ),
    ]);
    const canvas = document.createElement('canvas');
    canvas.width  = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    bitmap.close();
    return new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    );
  } catch (_nativeErr) {
    // Native decoding not supported — fall through to heic2any
  }

  // ── Strategy 2: heic2any library (fallback) ───────────────────────────────
  // Load from CDN (cdn.jsdelivr.net is in the SW passthrough list so it
  // bypasses the service worker cache and always hits the network).
  if (!_heic2any) {
    const mod = await import('https://cdn.jsdelivr.net/npm/heic2any@0.0.4/+esm');
    _heic2any = mod.default;
  }
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('HEIC conversion timed out')), 15000)
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
