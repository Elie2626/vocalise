import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// The client SDK is browser-only; every consumer of these exports only
// touches them inside useEffect/event handlers, so a null value on the
// server (during SSR/build, before env vars matter) is never dereferenced.
const instance =
  typeof window !== "undefined"
    ? (() => {
        const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
        return { app, auth: getAuth(app), db: getFirestore(app), storage: getStorage(app) };
      })()
    : null;

export const firebaseApp = instance?.app as FirebaseApp;
export const auth = instance?.auth as Auth;
export const db = instance?.db as Firestore;
export const storage = instance?.storage as FirebaseStorage;
export const googleProvider = new GoogleAuthProvider();
