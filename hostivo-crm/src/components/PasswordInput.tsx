import { useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function PasswordInput({ className = '', ...rest }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
        className={`w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 pr-9 text-[13.5px] text-slate-700 outline-none focus:ring-2 focus:ring-slate-400 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-slate-400 hover:text-slate-900"
      >
        {visible ? (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.36 5.36A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a13.4 13.4 0 0 1-3.17 3.88M6.6 6.6C4.24 8.13 2 12 2 12s2 4.5 6 6.32" />
          </svg>
        )}
      </button>
    </div>
  );
}
