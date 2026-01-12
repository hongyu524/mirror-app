import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, doc, setDoc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { storage, db } from '../firebase/firebaseConfig';
import { uriToBlob } from './firebaseWrites.native';

type UploadInput = {
  uid: string;
  momentId: string;
  file: {
    uri: string;
    fileName?: string;
    type?: string; // contentType
    width?: number;
    height?: number;
    durationMs?: number;
  };
};

const ALLOWED = ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'];

export async function uploadMomentAttachment({ uid, momentId, file }: UploadInput) {
  if (!uid || !momentId) throw new Error('Missing uid or momentId');
  const contentType = file.type || 'application/octet-stream';
  if (!ALLOWED.some((t) => contentType.includes(t.split('/')[1]) || contentType === t)) {
    throw new Error('Unsupported file type');
  }
  const attachmentsCol = collection(db, 'users', uid, 'events', momentId, 'attachments');
  const attRef = doc(attachmentsCol);
  const attachmentId = attRef.id;
  const fileName = file.fileName || `${attachmentId}.${contentType.includes('jpeg') ? 'jpg' : contentType.includes('png') ? 'png' : 'bin'}`;
  const storagePath = `users/${uid}/events/${momentId}/attachments/${attachmentId}/${fileName}`;
  const storageRef = ref(storage, storagePath);

  const blob = await uriToBlob(file.uri);
  const uploadTask = uploadBytesResumable(storageRef, blob, { contentType });
  await uploadTask;
  const downloadUrl = await getDownloadURL(storageRef);

  const attachmentDoc = {
    id: attachmentId,
    type: contentType.startsWith('video') ? 'video' : 'image',
    contentType,
    fileName,
    storagePath,
    downloadUrl,
    size: (blob as any)?.size ?? 0,
    width: file.width ?? null,
    height: file.height ?? null,
    durationMs: file.durationMs ?? null,
    createdAt: serverTimestamp(),
  };

  await setDoc(attRef, attachmentDoc);
  return attachmentDoc;
}

export async function deleteMomentAttachment(uid: string, momentId: string, attachmentId: string) {
  const attRef = doc(db, 'users', uid, 'events', momentId, 'attachments', attachmentId);
  const snap = await getDocs(collection(db, 'users', uid, 'events', momentId, 'attachments'));
  const target = snap.docs.find((d) => d.id === attachmentId);
  const storagePath = target?.data()?.storagePath;
  if (storagePath) {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch (_) {
      /* best-effort */
    }
  }
  await deleteDoc(attRef);
}

export async function deleteMomentAttachments(uid: string, momentId: string) {
  const snap = await getDocs(collection(db, 'users', uid, 'events', momentId, 'attachments'));
  const tasks = snap.docs.map(async (d) => {
    const storagePath = d.data()?.storagePath;
    if (storagePath) {
      try {
        await deleteObject(ref(storage, storagePath));
      } catch (_) {
        /* ignore */
      }
    }
    await deleteDoc(d.ref);
  });
  await Promise.all(tasks);
}
