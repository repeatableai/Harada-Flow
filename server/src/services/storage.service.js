import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local uploads directory (fallback for development)
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Initialize Supabase client if configured
let supabase = null;
const BUCKET_NAME = config.supabase?.storageBucket || 'knowledge-files';

if (config.supabase?.url && config.supabase?.serviceKey) {
  supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  console.log('Supabase storage initialized');
} else {
  console.log('Supabase not configured - using local storage (files will not persist across deploys)');
}

/**
 * Check if Supabase storage is available
 */
export function isSupabaseEnabled() {
  return supabase !== null;
}

/**
 * Ensure the storage bucket exists (call on startup)
 */
export async function ensureBucketExists() {
  if (!supabase) return;

  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('Error listing buckets:', listError);
      return;
    }

    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false, // Private bucket - files accessed via signed URLs
        fileSizeLimit: 10 * 1024 * 1024, // 10MB limit
      });

      if (createError) {
        // Bucket might already exist (race condition) - that's OK
        if (!createError.message?.includes('already exists')) {
          console.error('Error creating bucket:', createError);
        }
      } else {
        console.log(`Created storage bucket: ${BUCKET_NAME}`);
      }
    } else {
      console.log(`Storage bucket exists: ${BUCKET_NAME}`);
    }
  } catch (error) {
    console.error('Error ensuring bucket exists:', error);
  }
}

/**
 * Upload a file to storage
 * @param {string} filename - The unique filename to store as
 * @param {Buffer|string} filePathOrBuffer - File path or buffer to upload
 * @param {string} mimeType - The MIME type of the file
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
export async function uploadFile(filename, filePathOrBuffer, mimeType) {
  // If Supabase is configured, upload there
  if (supabase) {
    try {
      let fileBuffer;

      if (typeof filePathOrBuffer === 'string') {
        // It's a file path - read the file
        fileBuffer = fs.readFileSync(filePathOrBuffer);
      } else {
        fileBuffer = filePathOrBuffer;
      }

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filename, fileBuffer, {
          contentType: mimeType,
          upsert: true, // Overwrite if exists
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return { success: false, error: error.message };
      }

      console.log(`Uploaded to Supabase: ${filename}`);

      // Delete local file if it was a temp upload from multer
      if (typeof filePathOrBuffer === 'string' && fs.existsSync(filePathOrBuffer)) {
        try {
          fs.unlinkSync(filePathOrBuffer);
        } catch (e) {
          console.warn('Could not delete temp file:', e.message);
        }
      }

      return { success: true, path: data.path };
    } catch (error) {
      console.error('Upload error:', error);
      return { success: false, error: error.message };
    }
  }

  // Fallback: Keep file in local storage (already saved by multer)
  console.log(`Stored locally: ${filename}`);
  return { success: true, path: filename };
}

/**
 * Download a file from storage
 * @param {string} filename - The filename to download
 * @returns {Promise<{buffer: Buffer, error?: string} | null>}
 */
export async function downloadFile(filename) {
  // If Supabase is configured, download from there
  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .download(filename);

      if (error) {
        console.error('Supabase download error:', error);
        return null;
      }

      // Convert Blob to Buffer
      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return { buffer };
    } catch (error) {
      console.error('Download error:', error);
      return null;
    }
  }

  // Fallback: Read from local storage
  const localPath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(localPath)) {
    const buffer = fs.readFileSync(localPath);
    return { buffer };
  }

  return null;
}

/**
 * Get a signed URL for direct file access (for browser downloads)
 * @param {string} filename - The filename
 * @param {number} expiresIn - Seconds until URL expires (default 1 hour)
 * @returns {Promise<string | null>}
 */
export async function getSignedUrl(filename, expiresIn = 3600) {
  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filename, expiresIn);

      if (error) {
        console.error('Signed URL error:', error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Signed URL error:', error);
      return null;
    }
  }

  // Local storage doesn't use signed URLs
  return null;
}

/**
 * Delete a file from storage
 * @param {string} filename - The filename to delete
 * @returns {Promise<boolean>}
 */
export async function deleteFile(filename) {
  // If Supabase is configured, delete from there
  if (supabase) {
    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([filename]);

      if (error) {
        console.error('Supabase delete error:', error);
        return false;
      }

      console.log(`Deleted from Supabase: ${filename}`);
      return true;
    } catch (error) {
      console.error('Delete error:', error);
      return false;
    }
  }

  // Fallback: Delete from local storage
  const localPath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(localPath)) {
    try {
      fs.unlinkSync(localPath);
      console.log(`Deleted locally: ${filename}`);
      return true;
    } catch (error) {
      console.error('Local delete error:', error);
      return false;
    }
  }

  return false;
}

/**
 * Check if a file exists in storage
 * @param {string} filename - The filename to check
 * @returns {Promise<boolean>}
 */
export async function fileExists(filename) {
  if (supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list('', {
          search: filename,
        });

      if (error) return false;
      return data?.some(f => f.name === filename) || false;
    } catch {
      return false;
    }
  }

  // Fallback: Check local storage
  const localPath = path.join(UPLOADS_DIR, filename);
  return fs.existsSync(localPath);
}
