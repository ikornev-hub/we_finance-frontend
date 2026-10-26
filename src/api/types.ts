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

// ---------- Расходы (контракт: analysts/requirements/system/expenses.md §3) ----------

export type OperationType =
  | 'income'
  | 'card'
  | 'payment'
  | 'transfer_own'
  | 'transfer_credit'
  | 'transfer_person'
  | 'transfer_in';

export interface ImportResult {
  import_id: string;
  total: number;
  new: number;
  duplicates: number;
  uncategorized: number;
}

export interface ExpenseOperation {
  id: string;
  operated_at: IsoDate;
  amount: Money;
  description: string;
  merchant: string | null;
  counterparty: string | null;
  type: OperationType;
  category_id: string | null;
  category_path: string | null;
}

export interface ExpenseRule {
  id: string;
  match_kind: 'counterparty' | 'merchant';
  pattern: string;
  category_id: string;
}

export interface CategoryChange {
  operation: ExpenseOperation;
  rule: ExpenseRule | null;
  /** Неразобранные операции, которые правило разложило сразу. */
  applied: ExpenseOperation[];
}

/** Что будет, если «запомнить»: правило и операции, которые лягут туда же. null — нечего помнить (QR). */
export interface RulePreview {
  match_kind: 'counterparty' | 'merchant' | null;
  pattern: string | null;
  operations: ExpenseOperation[];
}

export interface ExpenseCategory {
  id: string;
  name: string;
  /** У подкатегории — id родителя; в дереве у верхнего уровня всегда null. */
  parent_id?: string | null;
  /** Группа (у верхнего уровня); null — «Служебные». */
  group_id?: string | null;
  system_code: string | null;
  /** Граница — либо доля располагаемого, либо сумма; другое поле null. */
  target_share: string | null;
  target_amount?: Money | null;
  children: { id: string; name: string }[];
}

export interface CategoryIn {
  name: string;
  parent_id?: string | null;
  group_id?: string | null;
  target_share?: string | null;
  target_amount?: Money | null;
}

export type GroupCode = 'mandatory' | 'managed' | 'unmanaged' | 'purchases' | 'service';

/** Группа трат: обязательные, управляемые, неуправляемые, покупки. */
export interface ExpenseGroup {
  id: string;
  code: Exclude<GroupCode, 'service'>;
  name: string;
  target_share: string | null;
  target_amount: Money | null;
  category_ids: string[];
}

export interface GroupPatch {
  name?: string;
  target_share?: string | null;
  target_amount?: Money | null;
}

export type AccountKind = 'own' | 'credit' | 'savings';

export interface ExpenseAccount {
  id: string;
  bank: string;
  name: string;
  kind: AccountKind;
  number_tail: string | null;
  phone: string | null;
  loan_id: string | null;
  /** У накопительного счёта — его цель. */
  goal_id?: string | null;
}

export type ExpenseAccountIn = Omit<ExpenseAccount, 'id'>;

export interface MonthCategory {
  id: string;
  name: string;
  system_code: string | null;
  group_code: GroupCode;
  amount: Money;
  share: string | null;
  /** Как задана граница: долей или суммой. */
  limit_mode: 'share' | 'amount' | null;
  target_share: string | null;
  target: Money | null;
  /** Факт − граница; > 0 — перерасход. */
  deviation: Money | null;
  /** Граница − факт: сколько ещё можно. */
  remaining: Money | null;
  children: { id: string; name: string; amount: Money; share: string | null }[];
}

/** Группа месяца: сумма её категорий, доля, граница и сами категории. */
export interface MonthGroup {
  id: string | null;
  code: GroupCode;
  name: string;
  amount: Money;
  /** У «Обязательных» — от дохода, у остальных — от располагаемого. */
  share: string | null;
  limit_mode: 'share' | 'amount' | null;
  target_share: string | null;
  target: Money | null;
  deviation: Money | null;
  remaining: Money | null;
  categories: MonthCategory[];
}

/** Прогноз «план + факт»: от него доли и границы. */
export interface MonthForecast {
  income: Money;
  /** Кредит, жильё, связь, близкие… — вычитаются из дохода. */
  mandatory: Money;
  /** Отложить на цели: «сначала себе». */
  savings: Money;
  disposable: Money;
  spent: Money;
  can_spend: Money;
  limits_total: Money;
  unallocated: Money;
  /** Обязательные по категориям: кредит — по графику, жильё — по правилу (или факт, если больше). */
  mandatory_by_category: Record<string, Money>;
}

export interface MonthReport {
  month: string;
  income: Money;
  expenses: Money;
  balance: Money;
  disposable: Money;
  uncategorized_count: number;
  has_statement: boolean;
  /** Отложено по факту: на накопительные счета и вручную. */
  saved: Money;
  /** Месяц закончился: прогноз = факт. */
  closed: boolean;
  warnings: string[];
  forecast: MonthForecast;
  groups: MonthGroup[];
  categories: MonthCategory[];
}

export type IncomeCheckStatus = 'confirmed' | 'mismatch' | 'missing' | 'no_statement' | 'expected';

export interface IncomeCheck {
  date: IsoDate;
  kind: PaymentKind;
  expected: Money;
  status: IncomeCheckStatus;
  operation_date: IsoDate | null;
  operation_amount: Money | null;
  difference: Money | null;
}

/** Цель накоплений на месяц: прогресс, план, реальный взнос, месяц достижения. */
export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: Money;
  deadline: IsoDate | null;
  monthly_amount: Money | null;
  initial_amount: Money;
  saved: Money;
  saved_before_month: Money;
  plan: Money;
  /** Сколько реально откладывается: не хватает на все — пропорционально. */
  contribution: Money;
  /** Месяц достижения «2027-08» при реальном взносе; null — не достигается. */
  eta: string | null;
  account_tails: string[];
  /** С какого числа копить; null — сразу. */
  start_date: IsoDate | null;
  /** Сколько положить в день аванса и остатка зарплаты в этом месяце. */
  paydays: GoalPayday[];
  /** Будущий месяц: «отложено» — ожидаемое к его началу (прошлые месяцы — сколько влезало в бюджет). */
  projected: boolean;
  /** Цель «закрыть кредит»: взносы — ЧДП по нему, «отложено» — на сколько уменьшился долг. */
  loan_id: string | null;
  /** Когда кредит закроется при таких ЧДП. */
  closes_on: IsoDate | null;
  /** Сколько процентов не уйдёт банку. */
  interest_saved: Money | null;
  note: string | null;
}

/** Цель «закрыть кредит» до сохранения. */
export interface LoanGoalPreview {
  debt: Money;
  plan: Money;
  paydays: GoalPayday[];
  closes_on: IsoDate | null;
  interest_saved: Money;
  note: string | null;
}

export interface GoalPayday {
  date: IsoDate;
  kind: 'advance' | 'remainder';
  amount: Money;
}

export interface SavingsGoalIn {
  name: string;
  target_amount: Money;
  deadline?: IsoDate | null;
  monthly_amount?: Money | null;
  initial_amount?: Money;
  start_date?: IsoDate | null;
  loan_id?: string | null;
}

export interface ContributionIn {
  day: IsoDate;
  amount: Money;
  comment?: string | null;
}

export interface AnalysisMonth {
  month: string;
  income: Money;
  mandatory: Money;
  saved: Money;
  groups: Record<string, Money>;
  categories: Record<string, Money>;
}

export interface AnalysisStat {
  kind: 'group' | 'category';
  id: string;
  name: string;
  group_code: GroupCode;
  median: Money;
  mean: Money;
  max: Money;
  max_month: string | null;
}

export interface PaceItem {
  id: string;
  name: string;
  amount: Money;
  projected: Money;
  target: Money | null;
}

export interface SpendingAnalysis {
  months: AnalysisMonth[];
  stats: AnalysisStat[];
  pace: { month: string; day: number; days: number; groups: PaceItem[]; categories: PaceItem[] } | null;
  /** Закрытые месяцы, целиком покрытые выпиской: по ним медиана. */
  full_months: string[];
}
