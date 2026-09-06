import { Account } from '../types';

const ACCOUNTS_KEY = 'zeyna_accounts_v1';
const ACTIVE_ACCOUNT_KEY = 'zeyna_active_account_v1';

const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'admin-1', prenom: 'Zeyna', role: 'admin' },
  { id: 'admin-2', prenom: 'Gérante', role: 'admin' },
  { id: 'employe-1', prenom: 'Employé 1', role: 'employe' },
  { id: 'employe-2', prenom: 'Employé 2', role: 'employe' }
];

export function getAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw) as Account[];
  } catch (err) {
    console.warn('Could not read accounts from storage:', err);
  }
  return DEFAULT_ACCOUNTS;
}

export function saveAccounts(accounts: Account[]) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.warn('Could not save accounts:', err);
  }
}

export function renameAccount(accountId: string, prenom: string) {
  const accounts = getAccounts().map(a => a.id === accountId ? { ...a, prenom } : a);
  saveAccounts(accounts);
  return accounts;
}

export function getActiveAccountId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
  } catch (err) {
    console.warn('Could not read active account:', err);
    return null;
  }
}

export function setActiveAccountId(accountId: string) {
  try {
    localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
  } catch (err) {
    console.warn('Could not save active account:', err);
  }
}

export function clearActiveAccount() {
  try {
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  } catch (err) {
    console.warn('Could not clear active account:', err);
  }
}
