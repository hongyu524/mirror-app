import { collection, doc } from 'firebase/firestore';
import { db } from './firebaseConfig';

export const userDoc = (uid: string) => doc(db, 'users', uid);
export const mediaCol = (uid: string) => collection(db, 'users', uid, 'media');
export const mediaDoc = (uid: string, id: string) => doc(db, 'users', uid, 'media', id);
