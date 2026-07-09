"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth-context";
import { TranscriptionResult } from "@/components/TranscriptionResult";
import type { Transcription } from "@/lib/types";

export default function TranscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [transcription, setTranscription] = useState<Transcription | null>(null);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "users", user.uid, "transcriptions", id), (snap) => {
      setTranscription(snap.exists() ? (snap.data() as Transcription) : null);
    });
  }, [user, id]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/app" className="text-sm font-medium text-(--color-primary) hover:underline">
          ← Retour au tableau de bord
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {transcription?.fileName ?? "Transcription"}
        </h1>
      </div>

      {transcription ? (
        <TranscriptionResult transcription={transcription} />
      ) : (
        <div
          role="status"
          className="glass flex items-center gap-3 rounded-2xl p-6"
        >
          <span
            aria-hidden
            className="h-5 w-5 animate-spin rounded-full border-2 border-(--color-border) border-t-(--color-primary)"
          />
          <p className="text-sm text-(--color-foreground-muted)">Chargement…</p>
        </div>
      )}
    </div>
  );
}
