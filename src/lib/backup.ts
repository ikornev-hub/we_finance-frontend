// Бэкапы перед записью: снимок текущего состояния → файл в «Загрузки» + последние копии в браузере.
// Правило: не удалось снять копию — запись не выполняется.

import { ApiError } from '../api/client';
import { loansApi, salaryApi } from '../api/endpoints';
import type { LoanDetailOut, LoanSummaryOut, SalaryProfile } from '../api/types';

export type BackupKind = 'salary-profile' | 'loans';

export interface BackupEntry {
  id: string;
  createdAt: string; // ISO с временем
  kind: BackupKind;
  reason: string; // перед какой операцией
  data: unknown;
}

export interface LoansSnapshot {
  loans: LoanSummaryOut[];
  details: LoanDetailOut[];
}

const STORAGE_KEY = 'we-finance.backups';
const KEEP = 10;
const listeners = new Set<() => void>();

export const BACKUP_KIND_LABEL: Record<BackupKind, string> = {
  'salary-profile': 'Профиль зарплаты',
  loans: 'Кредиты',
};

export function listBackups(): BackupEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BackupEntry[]) : [];
  } catch {
    return [];
  }
}

function store(entries: BackupEntry[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false; // переполнено или запрещено — файл всё равно скачан
  } finally {
    listeners.forEach((listener) => listener());
  }
}

export function onBackupsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function deleteBackup(id: string): void {
  store(listBackups().filter((entry) => entry.id !== id));
}

function fileName(entry: BackupEntry): string {
  const stamp = entry.createdAt.slice(0, 19).replace(/[:T]/g, '-');
  return `we-finance.${entry.kind}.${stamp}.backup.json`;
}

export function downloadBackup(entry: BackupEntry): void {
  const blob = new Blob([JSON.stringify(entry, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName(entry);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function saveBackup(kind: BackupKind, reason: string, data: unknown): BackupEntry {
  const entry: BackupEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    kind,
    reason,
    data,
  };
  downloadBackup(entry);
  store([entry, ...listBackups()].slice(0, KEEP));
  return entry;
}

// ---------- снимки ----------

/** Текущий профиль; null — профиля ещё нет (404), терять нечего. */
export async function snapshotProfile(): Promise<SalaryProfile | null> {
  try {
    return await salaryApi.getProfile();
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** Все кредиты: список и полная карточка каждого. */
export async function snapshotLoans(): Promise<LoansSnapshot | null> {
  const loans = await loansApi.list();
  if (loans.length === 0) return null;
  const details = await Promise.all(loans.map((loan) => loansApi.detail(loan.id)));
  return { loans, details };
}

export class BackupFailedError extends Error {
  constructor(cause: unknown) {
    const why = cause instanceof Error ? cause.message : String(cause);
    super(`Не удалось сделать бэкап — запись отменена. ${why}`);
    this.name = 'BackupFailedError';
  }
}

/**
 * Снять копию и только потом записать.
 * Возвращает результат записи и признак, был ли сделан бэкап (нет — если данных ещё не было).
 */
export async function withBackup<T>(
  kind: BackupKind,
  reason: string,
  snapshot: () => Promise<unknown | null>,
  write: () => Promise<T>,
): Promise<{ result: T; backup: BackupEntry | null }> {
  let data: unknown | null;
  try {
    data = await snapshot();
  } catch (error) {
    throw new BackupFailedError(error);
  }
  const backup = data === null ? null : saveBackup(kind, reason, data);
  const result = await write();
  return { result, backup };
}
