import React, { useState } from 'react';
import { ShieldCheck, Briefcase, Pencil, Check } from 'lucide-react';
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
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <img src="/logo.svg" alt="Maison Zeyna" className="h-16 w-16 mx-auto mb-4 rounded-full" />
          <h1 className="font-display text-2xl font-semibold text-neutral-900">Maison Zeyna</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            {language === 'fr' ? 'Qui utilise l’application ?' : 'من يستخدم التطبيق؟'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {accounts.map(account => {
            const isEditing = editingId === account.id;
            const isAdmin = account.role === 'admin';
            return (
              <button
                key={account.id}
                id={`account-card-${account.id}`}
                onClick={() => !isEditing && onSelect(account)}
                className="relative text-left p-5 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    isAdmin ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {isAdmin ? <ShieldCheck size={22} /> : <Briefcase size={22} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          id={`account-rename-input-${account.id}`}
                          type="text"
                          autoFocus
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(e, account.id); }}
                          onBlur={(e) => confirmEdit(e, account.id)}
                          className="w-full p-1.5 border border-orange-300 rounded-lg text-sm font-bold focus:outline-none"
                        />
                        <button
                          id={`account-rename-confirm-${account.id}`}
                          onClick={(e) => confirmEdit(e, account.id)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer shrink-0"
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-gray-900 truncate">{account.prenom}</h3>
                        <span
                          id={`account-rename-btn-${account.id}`}
                          onClick={(e) => startEdit(e, account)}
                          className="p-1 text-gray-300 hover:text-gray-500 cursor-pointer shrink-0"
                        >
                          <Pencil size={12} />
                        </span>
                      </div>
                    )}
                    <p className={`text-[11px] font-medium mt-0.5 ${isAdmin ? 'text-orange-600' : 'text-blue-600'}`}>
                      {isAdmin
                        ? (language === 'fr' ? 'Accès complet' : 'وصول كامل')
                        : (language === 'fr' ? 'Accès employé' : 'وصول الموظف')}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
