/**
 * AssetStorageService.js
 * Centralized service for user asset uploads to REAL Supabase Storage buckets:
 * - avatars (Public)
 * - resumes (Private by default)
 * - project-media (Public for published projects)
 * Completely eliminates production Base64 storage in database rows.
 */

import { supabase } from './SupabaseClient.js';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_RESUME_TYPES = ['application/pdf'];

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_MEDIA_SIZE = 10 * 1024 * 1024;  // 10 MB
const MAX_RESUME_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Validates file MIME type and maximum size limit.
 */
export function validateFile(file, allowedTypes, maxSizeBytes) {
  if (!file) throw new Error('No file selected.');
  if (file.type && !allowedTypes.includes(file.type.toLowerCase())) {
    throw new Error(`Invalid file type (${file.type}). Allowed: ${allowedTypes.join(', ')}`);
  }
  if (file.size > maxSizeBytes) {
    const sizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    throw new Error(`File size exceeds limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Max: ${sizeMB} MB`);
  }
}

/**
 * Uploads user profile avatar to 'avatars' bucket.
 */
export async function uploadAvatar(file, userId, portfolioId) {
  validateFile(file, ALLOWED_IMAGE_TYPES, MAX_AVATAR_SIZE);

  const ext = file.name ? file.name.split('.').pop().toLowerCase() : 'webp';
  const sanitizedExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'webp';
  const storagePath = `${userId}/${portfolioId}/avatar.${sanitizedExt}`;

  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(storagePath, file, {
      upsert: true,
      contentType: file.type || `image/${sanitizedExt}`
    });

  if (uploadErr) {
    console.error('Supabase avatar upload error:', uploadErr);
    throw new Error(`Avatar upload failed: ${uploadErr.message}`);
  }

  const { data: publicData } = supabase.storage
    .from('avatars')
    .getPublicUrl(storagePath);

  return {
    storageBucket: 'avatars',
    storagePath,
    publicUrl: publicData.publicUrl,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Uploads user PDF resume to private 'resumes' bucket.
 */
export async function uploadResume(file, userId, portfolioId) {
  validateFile(file, ALLOWED_RESUME_TYPES, MAX_RESUME_SIZE);

  const sanitizedFileName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'resume.pdf';
  const storagePath = `${userId}/${portfolioId}/resume.pdf`;

  const { error: uploadErr } = await supabase.storage
    .from('resumes')
    .upload(storagePath, file, {
      upsert: true,
      contentType: 'application/pdf'
    });

  if (uploadErr) {
    console.error('Supabase resume upload error:', uploadErr);
    throw new Error(`Resume upload failed: ${uploadErr.message}`);
  }

  return {
    storageBucket: 'resumes',
    storagePath,
    fileName: sanitizedFileName,
    mimeType: 'application/pdf',
    size: file.size,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Uploads project screenshot / media to 'project-media' bucket.
 */
export async function uploadProjectMedia(file, userId, portfolioId, projectId) {
  validateFile(file, ALLOWED_IMAGE_TYPES, MAX_MEDIA_SIZE);

  const timestamp = Date.now();
  const sanitizedName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, '_') : `media_${timestamp}.webp`;
  const storagePath = `${userId}/${portfolioId}/${projectId}/${timestamp}_${sanitizedName}`;

  const { error: uploadErr } = await supabase.storage
    .from('project-media')
    .upload(storagePath, file, {
      upsert: true,
      contentType: file.type || 'image/webp'
    });

  if (uploadErr) {
    console.error('Supabase project media upload error:', uploadErr);
    throw new Error(`Project image upload failed: ${uploadErr.message}`);
  }

  const { data: publicData } = supabase.storage
    .from('project-media')
    .getPublicUrl(storagePath);

  return {
    id: `asset_${timestamp}`,
    type: 'image',
    storageBucket: 'project-media',
    storagePath,
    publicUrl: publicData.publicUrl,
    createdAt: new Date().toISOString()
  };
}

/**
 * Obtains temporary signed URL for private resume access.
 */
export async function getResumeAccessUrl(storagePath, isPublicAllowed = false) {
  if (!storagePath) return null;

  try {
    const { data, error } = await supabase.storage
      .from('resumes')
      .createSignedUrl(storagePath, 3600); // 1 Hour Expiry

    if (error || !data) {
      console.warn('Error generating signed resume URL:', error?.message);
      return null;
    }
    return data.signedUrl;
  } catch (e) {
    return null;
  }
}

/**
 * Deletes asset from specified storage bucket.
 */
export async function deleteAsset(storageBucket, storagePath) {
  if (!storageBucket || !storagePath) return;

  try {
    const { error } = await supabase.storage
      .from(storageBucket)
      .remove([storagePath]);

    if (error) {
      console.warn(`Warning deleting ${storageBucket}/${storagePath}:`, error.message);
    }
  } catch (e) {
    console.warn('Asset deletion error:', e);
  }
}

/**
 * Converts Data URL / Base64 string into Blob.
 */

export function base64ToBlob(base64Data, defaultMime = 'image/png') {
  const parts = base64Data.split(';base64,');
  const contentType = parts.length > 1 ? parts[0].replace('data:', '') : defaultMime;
  const raw = window.atob(parts[1] || parts[0]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
}

/**
 * Migrates legacy Base64 images/PDFs in masterProfile to Supabase Storage.
 */
export async function migrateLegacyBase64Assets(masterProfile, userId) {
  if (!masterProfile || !userId || !masterProfile.id) return false;
  let updated = false;

  // 1. Migrate Avatar Base64
  if (typeof masterProfile.avatar === 'string' && masterProfile.avatar.startsWith('data:image/')) {
    try {
      console.log('[Asset Migration] Migrating legacy Base64 avatar to Supabase Storage...');
      const blob = base64ToBlob(masterProfile.avatar);
      const file = new File([blob], 'avatar.webp', { type: blob.type });
      const avatarMeta = await uploadAvatar(file, userId, masterProfile.id);
      masterProfile.avatar = avatarMeta;
      updated = true;
    } catch (e) {
      console.warn('[Asset Migration] Avatar migration warning:', e.message);
    }
  }

  // 2. Migrate Resume Base64
  if (masterProfile.resume && typeof masterProfile.resume.resumeDataUrl === 'string' && masterProfile.resume.resumeDataUrl.startsWith('data:')) {
    try {
      console.log('[Asset Migration] Migrating legacy Base64 resume to Supabase Storage...');
      const blob = base64ToBlob(masterProfile.resume.resumeDataUrl, 'application/pdf');
      const file = new File([blob], masterProfile.resume.fileName || 'resume.pdf', { type: 'application/pdf' });
      const resumeMeta = await uploadResume(file, userId, masterProfile.id);
      masterProfile.resume = resumeMeta;
      updated = true;
    } catch (e) {
      console.warn('[Asset Migration] Resume migration warning:', e.message);
    }
  }

  // 3. Migrate Projects Base64 Images
  if (Array.isArray(masterProfile.projects)) {
    for (let i = 0; i < masterProfile.projects.length; i++) {
      const proj = masterProfile.projects[i];
      if (typeof proj.image === 'string' && proj.image.startsWith('data:image/')) {
        try {
          console.log(`[Asset Migration] Migrating project ${proj.id || i} Base64 image...`);
          const blob = base64ToBlob(proj.image);
          const file = new File([blob], `project_${i}.webp`, { type: blob.type });
          const mediaMeta = await uploadProjectMedia(file, userId, masterProfile.id, proj.id || `proj_${i}`);
          proj.image = mediaMeta.publicUrl;
          if (!proj.media) proj.media = [];
          proj.media.push(mediaMeta);
          updated = true;
        } catch (e) {
          console.warn('[Asset Migration] Project image migration warning:', e.message);
        }
      }
    }
  }

  return updated;
}
