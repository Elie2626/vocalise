import "server-only";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Lazily constructed so importing this module doesn't require the service
// account env vars at build time (Next.js evaluates route modules while
// collecting page data, before .env.local/Vercel env vars are relevant).
let app: App | null = null;

function getAdminApp(): App {
  if (!app) {
    app = getApps().length
      ? getApps()[0]!
      : initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
          }),
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
  }
  return app;
}

let _adminAuth: Auth | null = null;
let _adminDb: Firestore | null = null;

export function adminAuth(): Auth {
  return (_adminAuth ??= getAuth(getAdminApp()));
}
export function adminDb(): Firestore {
  return (_adminDb ??= getFirestore(getAdminApp()));
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/** Verifies the Firebase ID token from an Authorization: Bearer header and returns the uid. */
export async function requireUid(request: Request): Promise<string> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    throw new AuthError("Non autorisé.");
  }
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    throw new AuthError("Non autorisé.");
  }
}
