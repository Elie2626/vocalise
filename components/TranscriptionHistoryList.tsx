"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import type { Transcription } from "@/lib/types";

const STATUS_LABEL: Record<Transcription["status"], string> = {
  processing: "En cours",
  done: "Terminé",
  error: "Échec",
};

const STATUS_CLASS: Record<Transcription["status"], string> = {
  processing: "bg-(--color-secondary)/15 text-(--color-secondary)",
  done: "bg-(--color-success-bg) text-(--color-success)",
  error: "bg-(--color-error-bg) text-(--color-error)",
};

export function TranscriptionHistoryList({ uid }: { uid: string }) {
  const [items, setItems] = useState<Transcription[] | null>(null);

  useEffect(() => {
    const q = query(collection(db, "users", uid, "transcriptions"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map((d) => d.data() as Transcription));
    });
  }, [uid]);

  async function handleDelete(item: Transcription) {
    if (!confirm(`Supprimer la transcription "${item.fileName}" ? Cette action est irréversible.`)) {
      return;
    }
    await deleteDoc(doc(db, "users", uid, "transcriptions", item.id));
    if (item.storagePath) {
      try {
        await deleteObject(ref(storage, item.storagePath));
      } catch {
        // le fichier a peut-être déjà été supprimé ; le document Firestore fait foi
      }
    }
  }

  if (items === null) {
    return <p className="text-sm text-(--color-foreground-muted)">Chargement…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="glass rounded-2xl p-6 text-sm text-(--color-foreground-muted)">
        Aucune transcription pour le moment.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="glass flex items-center gap-4 rounded-2xl p-4 transition-colors hover:!border-(--color-primary)"
        >
          <Link
            href={`/app/transcription/${item.id}`}
            className="flex min-w-0 flex-1 items-center gap-4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.fileName}</p>
              <p className="text-xs text-(--color-foreground-muted)">
                {new Date(item.createdAt).toLocaleString("fr-FR")}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[item.status]}`}
            >
              {STATUS_LABEL[item.status]}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => handleDelete(item)}
            aria-label={`Supprimer ${item.fileName}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-(--color-foreground-muted) transition-colors hover:bg-(--color-error-bg) hover:text-(--color-error)"
          >
            <TrashIcon />
          </button>
        </li>
      ))}
    </ul>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
