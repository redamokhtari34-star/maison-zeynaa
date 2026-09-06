import React, { useState } from 'react';
import { User, ShieldCheck, Briefcase, Pencil, Check } from 'lucide-react';
import { Account, Language } from '../types';
import { renameAccount } from '../lib/accounts';

interface AccountPickerProps {
  accounts: Account[];
  language: Language;
  onSelect: (account: Account) => void;
  onAccountsChange: (accounts: Account[]) => void;
}

// Not a login — a shared tablet at the counter picks who is using it right
// now, nothing more. Renaming happens right here, on the card itself, since
// that's the one moment everyone actually looks at this screen.
export default function AccountPicker({ accounts, language, onSelect, onAccountsChange }: AccountPickerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const startEdit = (e: React.MouseEvent, account: Account) => {
    e.stopPropagation();
    setEditingId(account.id);
    setDraftName(account.prenom);
  };

  const confirmEdit = (e: React.SyntheticEvent, accountId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = draftName.trim();
    if (trimmed) {
      onAccountsChange(renameAccount(accountId, trimmed));
    }
    setEditingId(null);
  };

  return (
    <div className="min-h-screen bg-orange-50/40 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-12">
          <div className="grid h-16 w-16 mx-auto mb-5 place-items-center rounded-2xl bg-neutral-950 font-display text-xl font-semibold text-white">
            MZ
          </div>
          <h1 className="font-display text-3xl font-semibold text-neutral-900">Maison Zeyna</h1>
          <p className="mt-2 text-[15px] text-neutral-500">
            {language === 'fr' ? 'Qui utilise l’application ?' : 'من يستخدم التطبيق؟'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {accounts.map(account => {
            const isEditing = editingId === account.id;
            const isAdmin = account.role === 'admin';
            return (
              <button
                key={account.id}
                id={`account-card-${account.id}`}
                onClick={() => !isEditing && onSelect(account)}
                className={`relative text-left p-6 rounded-3xl border bg-white transition-all cursor-pointer ${
                  isAdmin
                    ? 'border-orange-100 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-100/60'
                    : 'border-blue-100 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/60'
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                  isAdmin ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  {isAdmin ? <ShieldCheck size={26} /> : <Briefcase size={26} />}
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      id={`account-rename-input-${account.id}`}
                      type="text"
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(e, account.id); }}
                      onBlur={(e) => confirmEdit(e, account.id)}
                      className="w-full p-2 border border-orange-300 rounded-xl text-base font-display font-semibold focus:outline-none"
                    />
                    <button
                      id={`account-rename-confirm-${account.id}`}
                      onClick={(e) => confirmEdit(e, account.id)}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl cursor-pointer shrink-0"
                    >
                      <Check size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-xl font-semibold text-neutral-900 truncate">{account.prenom}</h3>
                    <span
                      id={`account-rename-btn-${account.id}`}
                      onClick={(e) => startEdit(e, account)}
                      className="p-1.5 text-neutral-300 hover:text-neutral-500 hover:bg-neutral-50 rounded-lg cursor-pointer shrink-0"
                    >
                      <Pencil size={14} />
                    </span>
                  </div>
                )}

                <p className={`mt-1.5 text-xs font-semibold uppercase tracking-wide ${
                  isAdmin ? 'text-orange-600' : 'text-blue-600'
                }`}>
                  {isAdmin
                    ? (language === 'fr' ? 'Accès complet' : 'وصول كامل')
                    : (language === 'fr' ? 'Accès employé' : 'وصول الموظف')}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
