// Показ денег и дат. Деньги приходят строками ("1458106.20") — форматируем строку, не теряя копеек.

const NBSP = ' ';

/** "1458106.20" → "1 458 106.20 ₽"; "-3654.00" → "−3 654.00 ₽". */
export function money(value: string | null | undefined, withCurrency = true): string {
  if (value === null || value === undefined || value === '') return '—';
  const negative = value.startsWith('-');
  const [intPart, fracPart] = value.replace(/^[+-]/, '').split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const body = fracPart === undefined ? grouped : `${grouped}.${fracPart}`;
  return `${negative ? '−' : ''}${body}${withCurrency ? `${NBSP}₽` : ''}`;
}

/** Деньги со знаком: "+1 740.00 ₽" / "−1 740.00 ₽" / "0.00 ₽". */
export function signedMoney(value: string): string {
  return Number(value) > 0 ? `+${money(value)}` : money(value);
}

/** "2026-07-01" → "01.07.2026". */
export function date(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.split('-');
  return d ? `${d}.${m}.${y}` : value;
}

export const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

export const PAYMENT_KIND: Record<string, string> = {
  advance: 'Аванс',
  remainder: 'Остаток',
  vacation: 'Отпускные',
  sick_employer: 'Больничный (работодатель)',
  sick_fund: 'Больничный (СФР)',
};

export const ABSENCE_KIND: Record<string, string> = {
  vacation: 'Отпуск',
  sick: 'Больничный',
  unpaid: 'Без оплаты',
};

export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
