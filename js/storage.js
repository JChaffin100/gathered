// js/storage.js — Image compression and Firebase Storage uploads
import { storage } from '../firebase-config.js';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// ── Image Compression ─────────────────────────────────────────────────────
export async function compressImage(file, maxDimension = 1920, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
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
        (blob) => { URL.revokeObjectURL(url); resolve({ blob, width, height }); },
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
