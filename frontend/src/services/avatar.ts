import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { User as FirebaseUser } from 'firebase/auth';
import { firebaseStorage } from '../lib/firebase';
import { isSupportedImage, prepareAvatar } from '../util/image';

// One object per user at a fixed path, so re-uploading replaces rather
// than accumulates, and storage.rules can pin writes to the owner's uid.
function avatarRef(user: FirebaseUser) {
  return ref(firebaseStorage, `avatars/${user.uid}/avatar.jpg`);
}

export class AvatarUploadError extends Error {
  // quota: the project's Storage free-tier allowance is used up; the
  // caller should let the user continue without a picture.
  constructor(
    public readonly reason: 'unsupported' | 'unreadable' | 'quota' | 'rejected' | 'network' | 'unknown',
    message: string,
  ) {
    super(message);
  }
}

// Storage error codes: https://firebase.google.com/docs/storage/web/handle-errors
function classify(err: unknown): AvatarUploadError {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'storage/quota-exceeded':
      return new AvatarUploadError(
        'quota',
        'Picture uploads are unavailable right now (storage limit reached). You can continue without one.',
      );
    case 'storage/unauthorized':
    case 'storage/unauthenticated':
      // rules said no — size or content-type cap, or a stale session
      return new AvatarUploadError('rejected', 'That picture was rejected. Try a smaller JPG or PNG.');
    case 'storage/retry-limit-exceeded':
    case 'storage/canceled':
      return new AvatarUploadError('network', 'Upload timed out. Check your connection and try again.');
    default:
      console.error('avatar upload failed', err);
      return new AvatarUploadError('unknown', 'Upload failed. Try again.');
  }
}

// Resizes and uploads file as user's avatar and returns its public URL.
// Throws AvatarUploadError with a user-facing message on every failure.
export async function uploadAvatar(user: FirebaseUser, file: File): Promise<string> {
  if (!isSupportedImage(file)) {
    throw new AvatarUploadError('unsupported', 'Use a JPG, PNG, WebP or GIF under 10 MB.');
  }
  let blob: Blob;
  try {
    blob = await prepareAvatar(file);
  } catch (err) {
    console.warn('avatar decode failed', err);
    throw new AvatarUploadError('unreadable', "Couldn't read that image. Try a JPG or PNG.");
  }
  try {
    const target = avatarRef(user);
    await uploadBytes(target, blob, {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=86400',
    });
    return await getDownloadURL(target);
  } catch (err) {
    throw classify(err);
  }
}

// Best-effort cleanup when the user removes a picture they just
// uploaded; a failure here is harmless (the next upload overwrites).
export function deleteAvatar(user: FirebaseUser): Promise<void> {
  return deleteObject(avatarRef(user)).catch((err) => {
    if ((err as { code?: string })?.code !== 'storage/object-not-found') {
      console.warn('avatar delete failed', err);
    }
  });
}
