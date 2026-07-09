"use client";

import { useState } from "react";

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        minLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-(--color-border) bg-(--color-bg-elev) px-3 py-2.5 pr-11 text-base outline-none focus:border-(--color-primary)"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-(--color-foreground-muted) hover:text-(--color-foreground)"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a13.16 13.16 0 0 1-3.19 4.19m-3.94 1.87A9.12 9.12 0 0 1 12 20c-7 0-11-8-11-8a13.16 13.16 0 0 1 4.09-4.9" />
      <path d="M1 1l22 22" />
      <path d="M9.53 9.53A3 3 0 0 0 12 15a3 3 0 0 0 2.47-1.3" />
    </svg>
  );
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.49 12.27c0-.85-.08-1.66-.22-2.45H12v4.63h6.44c-.28 1.48-1.12 2.73-2.38 3.57v2.96h3.85c2.26-2.08 3.58-5.15 3.58-8.71Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.85-2.96c-1.07.72-2.44 1.14-4.08 1.14-3.13 0-5.79-2.11-6.74-4.96H1.28v3.05C3.25 21.3 7.31 24 12 24Z" />
      <path fill="#FBBC05" d="M5.26 14.32a7.2 7.2 0 0 1 0-4.64V6.63H1.28a12 12 0 0 0 0 10.74l3.98-3.05Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.63l3.98 3.05C6.21 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}
