// Учебные примеры из требований (analysts/requirements) — не реальные данные.
// Те же, что подставляет Swagger бэкенда: зарплата — «Пример для критериев», кредит — EXAMPLE_LOAN.

import type { Absence, LoanCreateIn, Prepayment, SalaryProfile, SalaryTerms } from '../api/types';

export const EXAMPLE_PROFILE: SalaryProfile = {
  terms: [
    { start: '2025-01-01', salary: '120000.00', meal_per_day: '400.00' },
    { start: '2026-07-01', salary: '150000.00', meal_per_day: '400.00' },
  ],
  absences: [
    { kind: 'unpaid', start: '2026-03-20', end: '2026-03-20' },
    { kind: 'vacation', start: '2026-07-06', end: '2026-07-19' },
    { kind: 'sick', start: '2026-10-12', end: '2026-10-16' },
  ],
  history: [2024, 2025].flatMap((year) =>
    Array.from({ length: 12 }, (_, i) => ({
      year,
      month: i + 1,
      salary: year === 2024 ? '110000.00' : '120000.00',
      vacation_pay: '0',
      excluded_days: 0,
    })),
  ),
  stage_start: '2022-03-01',
};

export const EXAMPLE_YEAR = 2026;

export const EXAMPLE_ABSENCE: Absence = { kind: 'unpaid', start: '2026-08-03', end: '2026-08-03' };

export const EXAMPLE_WHAT_IF: SalaryTerms = { start: '2026-11-01', salary: '150000.00', meal_per_day: '300.00' };

export const EXAMPLE_LOAN: LoanCreateIn = {
  name: 'Учебный кредит',
  principal: '1200000.00',
  rates: [{ start: '2026-01-15', annual_rate: '12' }],
  payment: '39857.17',
  months: 36,
  issue_date: '2026-01-15',
  first_payment_date: '2026-02-15',
  day_count: 'actual',
  weekend_shift: false,
  monthly_fee: '0.00',
  payment_day_changes: [],
};

export const EXAMPLE_PREPAYMENT: Prepayment = { date: '2026-07-15', amount: '200000.00', mode: 'reduce_term' };

/** Глубокая копия примера: формы правят свою копию, а не общий объект. */
export function clone<T>(value: T): T {
  return structuredClone(value);
}
