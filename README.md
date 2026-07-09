# Vocalise

Transformez vos messages vocaux WhatsApp, mémos audio et vidéos en texte écrit, avec **résumé automatique** et **horodatage par segment**.

Application web (Next.js) avec authentification, historique par utilisateur, ingestion par upload **ou** par lien (fichier direct / YouTube best-effort), et **PWA** avec partage natif mobile (« Partager vers Vocalise »).

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS v4**
- **Firebase** : Auth (email + Google), Firestore (historique), Storage (fichiers)
- **OpenAI** : Whisper (`whisper-1`) pour la transcription, `gpt-4o-mini` pour le résumé
- **ffmpeg** (`fluent-ffmpeg` + `ffmpeg-static`) : extraction/normalisation audio, découpage des longs fichiers
- **React Three Fiber / three** : orbe vocal 3D animé (hero)
- **@distube/ytdl-core** : extraction audio YouTube
- Export **.txt** / **.docx** (`docx`)

## Prérequis

- Node.js 20+
- Un projet **Firebase** (Auth + Firestore + Storage activés)
- Une clé API **OpenAI**

## Configuration

Copiez `.env.local.example` vers `.env.local` et renseignez les valeurs :

```bash
cp .env.local.example .env.local
```

| Variable | Où la trouver |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` | Console Firebase → Paramètres → Vos applications (config web) |
| `FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY` | Console Firebase → Comptes de service → Générer une clé privée (JSON) |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |

> ⚠️ Ne committez jamais `.env.local` ni la clé de service Firebase. Ils sont déjà ignorés par `.gitignore`.

Côté console Firebase, pensez à :
1. **Authentication** → activer *E-mail/Mot de passe* et *Google*
2. **Firestore Database** → créer la base
3. **Storage** → activer
4. Déployer les règles : `npx firebase deploy --only firestore:rules,storage`

## Développement

```bash
npm install
npm run dev
```

Ouvrez http://localhost:3000.

> La PWA (installation + partage) nécessite HTTPS → testable une fois déployée.

## Scripts

- `npm run dev` — serveur de développement
- `npm run build` — build de production
- `npm run start` — serveur de production
- `npm run lint` — ESLint

## Structure

```
app/
  page.tsx                     # landing (hero 3D)
  (auth)/login | signup        # authentification
  app/                         # espace connecté (protégé)
    page.tsx                   # upload + lien + historique
    transcription/[id]/        # résultat d'une transcription
    share/                     # réception du partage PWA
  api/transcribe/route.ts      # orchestration Whisper + résumé (serveur)
lib/                           # firebase, openai, audio, upload, export…
components/                    # UI (dropzone, résultat, orbe 3D, navbar…)
public/                        # manifest PWA, service worker, icônes
firestore.rules | storage.rules
```

## Déploiement (Vercel)

1. Importer le repo dans Vercel
2. Renseigner les mêmes variables d'environnement que `.env.local`
3. Déployer

> `/api/transcribe` peut être long (fichiers volumineux) : un plan Vercel autorisant `maxDuration` élevé est recommandé. L'extraction YouTube peut échouer en production (blocage des IP de datacenters par YouTube) — l'upload et les liens directs restent fiables.
