# Firebase Setup

1) Create a Firebase Web App (Firebase Console → Project Settings → General → Your apps).
2) Copy the Web config values (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
3) Create a `.env` file at the project root (or use EAS secrets) with:
```
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```
4) For local Expo: run `npx expo start -c` after setting env.
5) For EAS builds (iOS/Android): add the same EXPO_PUBLIC_* vars as EAS secrets.

Firestore/Storage assumptions:
- Storage paths: `users/{uid}/images/{fileName}`, `users/{uid}/videos/{fileName}`
- Firestore media docs: `users/{uid}/media/{docId}` with fields: `uid`, `type`, `storagePath`, `downloadURL`, `createdAt` (optional: `duration`, `width`, `height`)
- Delete order: Storage object first (ignore object-not-found), then Firestore doc; UI removes optimistically with rollback on failure.
