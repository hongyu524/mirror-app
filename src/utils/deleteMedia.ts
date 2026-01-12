import { deleteObject, ref as storageRef } from 'firebase/storage';
import { deleteDoc } from 'firebase/firestore';
import { storage } from '../firebase/firebaseConfig';
import { mediaDoc } from '../firebase/paths';

export type MediaItem = {
  id: string;
  uid: string;
  storagePath: string;
  type?: 'image' | 'video';
};

/**
 * Delete storage object first, then Firestore metadata.
 * - If storage object is missing, still delete Firestore doc.
 * - Throws if uid/id/storagePath missing.
 */
export async function deleteMediaItem(item: MediaItem) {
  const { id, uid, storagePath } = item;
  if (!id || !uid || !storagePath) {
    throw new Error('Missing required media fields (id, uid, storagePath)');
  }

  // 1) Delete storage object
  try {
    const ref = storageRef(storage, storagePath);
    await deleteObject(ref);
  } catch (err: any) {
    const code = err?.code;
    // If already gone, continue to Firestore cleanup
    if (code !== 'storage/object-not-found') {
      throw err;
    }
  }

  // 2) Delete Firestore doc
  try {
    await deleteDoc(mediaDoc(uid, id));
  } catch (err) {
    // Storage is already gone; log but don't rethrow to avoid orphan in UI
    console.warn('Firestore delete failed after storage delete', err);
  }
}
