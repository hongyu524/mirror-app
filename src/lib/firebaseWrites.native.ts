import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';

type AttachmentInput = {
  uri: string;
  fileName?: string;
  contentType?: string;
  type: 'image' | 'video' | 'audio' | 'file';
  width?: number;
  height?: number;
  durationMs?: number;
};

export type CreateEventInput = {
  title: string;
  description?: string | null;
  startAt?: Date;
  timezone?: string;
  moodColor?: string | null;
  tags?: string[];
  contactIds?: string[];
  attachments?: AttachmentInput[];
  primaryEmotion?: string | null;
  emotionIntensity?: number | null;
};

const requireUid = (): string => {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
};

export async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  if (!res.ok) {
    throw new Error(`Failed to fetch uri: ${uri}`);
  }
  return await res.blob();
}

const guessExt = (contentType?: string, fallback = 'bin') => {
  if (!contentType) return fallback;
  const ct = contentType.toLowerCase();
  if (ct.includes('jpeg')) return 'jpg';
  if (ct.includes('png')) return 'png';
  if (ct.includes('heic')) return 'heic';
  if (ct.includes('mp4')) return 'mp4';
  if (ct.includes('mov')) return 'mov';
  if (ct.includes('mp3')) return 'mp3';
  if (ct.includes('wav')) return 'wav';
  return fallback;
};

export async function ensureUserProfileExists(opts?: {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  timezone?: string;
}) {
  const uid = requireUid();
  const db = getFirestore();
  const userRef = doc(db, 'users', uid);
  const now = serverTimestamp();

  await setDoc(
    userRef,
    {
      uid,
      displayName: opts?.displayName ?? getAuth().currentUser?.displayName ?? '',
      email: opts?.email ?? getAuth().currentUser?.email ?? '',
      photoURL: opts?.photoURL ?? getAuth().currentUser?.photoURL ?? null,
      timezone: opts?.timezone ?? 'America/Los_Angeles',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
}

export async function createEventWithAttachments(input: CreateEventInput) {
  const uid = requireUid();
  const db = getFirestore();
  const storage = getStorage();

  await ensureUserProfileExists({ timezone: input.timezone });

  const startAt = input.startAt ? Timestamp.fromDate(input.startAt) : Timestamp.now();
  const uploaded: { attachmentId: string; storagePath: string }[] = [];

  try {
    // 1) Create event doc first
    const eventsCol = collection(db, 'users', uid, 'events');
    const eventDocRef = doc(eventsCol);
    const eventId = eventDocRef.id;

    await setDoc(eventDocRef, {
      title: input.title,
      description: input.description ?? null,
      type: 'moment',
      startAt,
      endAt: null,
      timezone: input.timezone ?? 'America/Los_Angeles',
      moodColor: input.moodColor ?? null,
      primaryEmotion: input.primaryEmotion ?? null,
      primary_emotion: input.primaryEmotion ?? null,
      emotionIntensity: input.emotionIntensity ?? null,
      emotion_intensity: input.emotionIntensity ?? null,
      tags: input.tags ?? [],
      contactIds: input.contactIds ?? [],
      primaryContactId: (input.contactIds && input.contactIds[0]) || null,
      attachmentsCount: input.attachments?.length ?? 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ai: { status: 'none' },
    });

    // 2) Upload attachments to Storage + create attachment docs under moment
    if (input.attachments?.length) {
      for (const a of input.attachments) {
        const attRef = doc(collection(db, 'users', uid, 'events', eventId, 'attachments'));
        const attachmentId = attRef.id;
        const ext = guessExt(a.contentType);
        const fileName =
          a.fileName && a.fileName.trim().length > 0 ? a.fileName : `${attachmentId}.${ext}`;
        const storagePath = `users/${uid}/events/${eventId}/attachments/${attachmentId}/${fileName}`;
        const storageRef = ref(storage, storagePath);

        const blob = await uriToBlob(a.uri);
        await uploadBytes(storageRef, blob, {
          contentType: a.contentType ?? 'application/octet-stream',
        });

        const downloadURL = await getDownloadURL(storageRef);

        await setDoc(attRef, {
          id: attachmentId,
          type: a.type,
          storagePath,
          downloadUrl: downloadURL,
          fileName,
          contentType: a.contentType ?? 'application/octet-stream',
          size: (blob as any)?.size ?? 0,
          width: a.width ?? null,
          height: a.height ?? null,
          durationMs: a.durationMs ?? null,
          createdAt: serverTimestamp(),
        });

        uploaded.push({ attachmentId, storagePath });
      }
    }

    return { eventId };
  } catch (err) {
    // Cleanup any uploaded attachments
    for (const u of uploaded) {
      try {
        await deleteObject(ref(storage, u.storagePath));
      } catch (_) {
        /* best-effort */
      }
    }
    throw err;
  }
}
