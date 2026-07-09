"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from "@/lib/auth-context";
import { uploadAndTranscribe, UploadValidationError } from "@/lib/upload";

const SHARE_CACHE = "vocalise-share";
const SHARED_FILE_KEY = "/__shared_media";

type Phase = "working" | "error";

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <span
            aria-label="Chargement"
            className="h-8 w-8 animate-spin rounded-full border-2 border-(--color-border) border-t-(--color-primary)"
          />
        </div>
      }
    >
      <ShareReceiver />
    </Suspense>
  );
}

function ShareReceiver() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const shared = params.get("shared");
  const [phase, setPhase] = useState<Phase>("working");
  const [message, setMessage] = useState("Réception du partage…");
  const startedRef = useRef(false);

  useEffect(() => {
    if (!user || startedRef.current) return;
    startedRef.current = true;

    async function run() {
      const id = uuidv4();

      try {
        if (shared === "link") {
          const url = params.get("url");
          if (!url) throw new Error("empty");
          const token = await user!.getIdToken();
          await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ id, url }),
          });
          router.replace(`/app/transcription/${id}`);
          return;
        }

        if (shared === "file") {
          const cache = await caches.open(SHARE_CACHE);
          const response = await cache.match(SHARED_FILE_KEY);
          if (!response) throw new Error("empty");

          const blob = await response.blob();
          const fileName = decodeURIComponent(response.headers.get("x-file-name") || "partage");
          const type = response.headers.get("content-type") || blob.type;
          const file = new File([blob], fileName, { type });

          setMessage("Envoi du fichier partagé…");
          await uploadAndTranscribe(user!, file, id, (p) =>
            setMessage(`Envoi du fichier partagé… ${p}%`)
          );
          await cache.delete(SHARED_FILE_KEY);
          router.replace(`/app/transcription/${id}`);
          return;
        }

        throw new Error("empty");
      } catch (err) {
        setPhase("error");
        setMessage(
          err instanceof UploadValidationError
            ? err.message
            : "Le contenu partagé n'a pas pu être récupéré. Réessaie depuis le tableau de bord."
        );
      }
    }

    run();
  }, [user, shared, params, router]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      {phase === "working" ? (
        <>
          <span
            aria-hidden
            className="h-8 w-8 animate-spin rounded-full border-2 border-(--color-border) border-t-(--color-primary)"
          />
          <p role="status" className="text-(--color-foreground-muted)">
            {message}
          </p>
        </>
      ) : (
        <div className="glass w-full rounded-2xl p-6">
          <p role="alert" className="text-sm text-(--color-error)">
            {message}
          </p>
          <Link
            href="/app"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-(--color-primary) px-5 text-sm font-semibold text-(--color-on-primary) transition-colors hover:bg-(--color-primary-hover)"
          >
            Aller au tableau de bord
          </Link>
        </div>
      )}
    </div>
  );
}
