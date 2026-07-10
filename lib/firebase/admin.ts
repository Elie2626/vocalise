import "server-only";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// NOTE: on n'importe volontairement PAS firebase-admin/auth : sa dépendance
// jwks-rsa fait un require() du module ESM jose, ce qui plante sur Vercel
// (ERR_REQUIRE_ESM). La vérification des ID tokens passe par l'API REST
// Identity Toolkit (accounts:lookup), qui valide le token côté Google.

// Lazily constructed so importing this module doesn't require the service
// account env vars at build time (Next.js evaluates route modules while
// collecting page data, before .env.local/Vercel env vars are relevant).
let app: App | null = null;

/** Tolère les variantes de collage de la clé : guillemets inclus, \n échappés ou réels. */
function normalizePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
}

function getAdminApp(): App {
  if (!app) {
    app = getApps().length
      ? getApps()[0]!
      : initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
          }),
        });
  }
  return app;
}

let _adminDb: Firestore | null = null;

export function adminDb(): Firestore {
  if (!_adminDb) {
    _adminDb = getFirestore(getAdminApp());
    // L'analyse IA peut renvoyer des champs optionnels absents (ex: note) :
    // sans ceci, Firestore rejette tout le document au moindre `undefined`.
    _adminDb.settings({ ignoreUndefinedProperties: true });
  }
  return _adminDb;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Vérifie le Firebase ID token (Authorization: Bearer) via l'API REST
 * Identity Toolkit et retourne l'uid. Google valide la signature,
 * l'expiration et l'audience du token.
 */
export async function requireUid(request: Request): Promise<string> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    throw new AuthError("Non autorisé.");
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    }
  );

  if (!response.ok) {
    throw new AuthError("Non autorisé.");
  }
  const data = (await response.json()) as { users?: { localId?: string; disabled?: boolean }[] };
  const user = data.users?.[0];
  if (!user?.localId || user.disabled) {
    throw new AuthError("Non autorisé.");
  }
  return user.localId;
}
