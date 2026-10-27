import type { MonthCategory, MonthGroup } from '../api/types';

// Границы трат — одни правила для всех экранов (Бюджет, Месяц, Кино): #24, #25.

/** Граница группы: своя, а если её нет — сумма границ её категорий; null — границ нет вовсе. */
export function groupLimit(group: Pick<MonthGroup, 'target' | 'categories'>): number | null {
  if (group.target !== null) return Number(group.target);
  const limited = group.categories.filter((category) => category.target !== null);
  return limited.length ? limited.reduce((sum, category) => sum + Number(category.target), 0) : null;
}

/**
 * Что отправить при правке границы: граница хранится в том виде, в каком была (#24).
 * Была долей располагаемого — остаётся долей, пересчитанной от новой суммы; иначе — суммой в ₽.
 */
export function limitPatch(
  amount: number | null,
  wasShare: boolean,
  disposable: number,
): { target_share: string | null; target_amount: string | null } {
  if (amount === null) return { target_share: null, target_amount: null };
  if (wasShare && disposable > 0) return { target_share: Math.min(amount / disposable, 1).toFixed(4), target_amount: null };
  return { target_share: null, target_amount: amount.toFixed(2) };
}

/** Задана ли граница долей. */
export const isShare = (item: Pick<MonthGroup | MonthCategory, 'target_share'>) => item.target_share !== null;
