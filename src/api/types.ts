// Типы по OpenAPI бэкенда (/openapi.json). Деньги и даты приходят строками — так и храним.

export type Money = string;
export type IsoDate = string; // "2026-07-01"

// ---------- сервис ----------

export interface HealthResponse {
  status: string;
  db: string;
}

export interface VersionResponse {
  version: string;
  env: string;
}

// ---------- зарплата ----------

/** Статус денежного события на дату: проведён, сегодня, запланирован. */
export type PaymentStatus = 'done' | 'today' | 'planned';

export type AbsenceKind = 'vacation' | 'sick' | 'unpaid';
export type PaymentKind = 'advance' | 'remainder' | 'vacation' | 'sick_employer' | 'sick_fund';

export interface SalaryTerms {
  start: IsoDate;
  salary: Money;
  meal_per_day: Money;
}

export interface Absence {
  kind: AbsenceKind;
  start: IsoDate;
  end: IsoDate;
}

export interface HistoryMonth {
  year: number;
  month: number;
  salary: Money;
  vacation_pay?: Money;
  excluded_days?: number;
}

export interface SalaryProfile {
  terms: SalaryTerms[];
  absences: Absence[];
  history: HistoryMonth[];
  stage_start: IsoDate;
}

export interface SalaryCalculationIn {
  profile: SalaryProfile;
  year: number;
}

export interface PaymentOut {
  date: IsoDate;
  kind: PaymentKind;
  for_month: number;
  gross: Money;
  tax: Money;
  net: Money;
  /** То же, что status === 'done'. */
  received: boolean;
  status: PaymentStatus;
}

export interface MonthTotalOut {
  month: number;
  gross: Money;
  tax: Money;
  net: Money;
}

export interface YearReportOut {
  year: number;
  payments: PaymentOut[];
  months: MonthTotalOut[];
  gross: Money;
  tax: Money;
  net: Money;
}

export interface MonthChangeOut {
  month: number;
  net_before: Money;
  net_after: Money;
  net_change: Money;
}

export interface WhatIfOut {
  year: number;
  net_before: Money;
  net_after: Money;
  net_change: Money;
  months: MonthChangeOut[];
}

// ---------- кредит ----------

export type DayCount = 'actual' | '365';
export type PrepaymentMode = 'reduce_term' | 'reduce_payment';
export type EntryKind = 'regular' | 'prepayment';

export interface RatePeriod {
  start: IsoDate;
  annual_rate: string;
}

export interface PaymentDayChange {
  start: IsoDate;
  day: number;
}

export interface LoanIn {
  principal: Money;
  rates: RatePeriod[];
  payment: Money;
  months: number;
  issue_date: IsoDate;
  first_payment_date: IsoDate;
  day_count: DayCount;
  weekend_shift: boolean;
  monthly_fee: Money;
  payment_day_changes: PaymentDayChange[];
}

export interface LoanCreateIn extends LoanIn {
  name: string;
}

export interface Prepayment {
  date: IsoDate;
  amount: Money;
  mode: PrepaymentMode;
}

export interface CalculationIn {
  loan: LoanIn;
  prepayments: Prepayment[];
  as_of: IsoDate | null;
}

export interface ScheduleRowOut {
  number: number;
  date: IsoDate;
  payment: Money;
  principal: Money;
  interest: Money;
  balance: Money;
  fee: Money;
}

export interface ScheduleItemOut extends ScheduleRowOut {
  /** То же, что status === 'done'. */
  past: boolean;
  status: PaymentStatus;
}

export interface HistoryEntryOut {
  date: IsoDate;
  kind: EntryKind;
  amount: Money;
  principal: Money;
  interest: Money;
  fee: Money;
  balance: Money;
  status: PaymentStatus;
}

export interface LoanStateOut {
  as_of: IsoDate;
  balance: Money;
  next_payment: ScheduleRowOut | null;
  close_date: IsoDate;
  last_payment: Money;
  payments_left: number;
}

export interface WarningOut {
  code: string;
  message: string;
}

export interface CalculationOut {
  start: LoanStateOut;
  actual: LoanStateOut;
  prepaid_total: Money;
  interest_saved: Money;
  months_saved: number;
  schedule: ScheduleItemOut[];
  history: HistoryEntryOut[];
  warnings: WarningOut[];
}

export type LoanStatus = 'active' | 'completed' | 'deleted';

export interface LoanDetailOut extends CalculationOut {
  id: string;
  name: string;
  status: LoanStatus;
  /** Активный и остаток на сегодня 0: можно перевести в «Завершённые». */
  can_complete: boolean;
}

export interface LoanSummaryOut {
  id: string;
  name: string;
  principal: Money;
  balance: Money;
  close_date: IsoDate;
  status: LoanStatus;
  can_complete: boolean;
}

export interface PreviewOut {
  before: LoanStateOut;
  after: LoanStateOut;
  interest_saved: Money;
  months_saved: number;
  warnings: WarningOut[];
}
