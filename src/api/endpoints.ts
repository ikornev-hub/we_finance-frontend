// Все эндпоинты бэкенда — по одной функции. Пути и параметры как в Swagger (/docs).

import { api, request } from './client';
import type {
  CategoryChange,
  ImportOverride,
  ImportPreview,
  LoanGoalPreview,
  CategoryIn,
  ExpenseAccount,
  ExpenseAccountIn,
  ExpenseCategory,
  ExpenseOperation,
  ImportResult,
  IncomeCheck,
  MonthReport,
  ExpenseGroup,
  SavingsGoal,
  SavingsGoalIn,
  ContributionIn,
  SpendingAnalysis,
  GroupPatch,
  RulePreview,
  Absence,
  CalculationIn,
  CalculationOut,
  HealthResponse,
  LoanCreateIn,
  LoanDetailOut,
  LoanIn,
  LoanStatus,
  LoanSummaryOut,
  Prepayment,
  PreviewOut,
  SalaryCalculationIn,
  SalaryProfile,
  SalaryTerms,
  ScheduleRowOut,
  VersionResponse,
  WhatIfOut,
  YearReportOut,
} from './types';

const V1 = '/api/v1';

export const authApi = {
  login: (login: string, password: string) => api.post<{ token: string }>(`${V1}/auth/login`, { login, password }),
  /** Только на стендах dev и test; на stage и prod — 404. */
  testLogin: () => api.post<{ token: string }>(`${V1}/auth/test-login`),
};

export const serviceApi = {
  // 503 — API живо, но база недоступна: это тоже ответ, а не ошибка связи.
  health: () => request<HealthResponse>('GET', '/health', { accept: [503] }),
  version: () => api.get<VersionResponse>('/version'),
};

export const salaryApi = {
  calculate: (body: SalaryCalculationIn, asOf?: string) =>
    api.post<YearReportOut>(`${V1}/salary/calculate`, body, { as_of: asOf }),
  getProfile: () => api.get<SalaryProfile>(`${V1}/salary/profile`),
  putProfile: (profile: SalaryProfile) => api.put<SalaryProfile>(`${V1}/salary/profile`, profile),
  addAbsence: (absence: Absence) => api.post<SalaryProfile>(`${V1}/salary/absences`, absence),
  year: (year: number, asOf?: string) => api.get<YearReportOut>(`${V1}/salary/${year}`, { as_of: asOf }),
  whatIf: (year: number, terms: SalaryTerms) => api.post<WhatIfOut>(`${V1}/salary/${year}/what-if`, terms),
};

export const loansApi = {
  list: (asOf?: string, status: LoanStatus = 'active') =>
    api.get<LoanSummaryOut[]>(`${V1}/loans`, { as_of: asOf, status }),
  create: (loan: LoanCreateIn) => api.post<LoanDetailOut>(`${V1}/loans`, loan),
  detail: (id: string, asOf?: string) =>
    api.get<LoanDetailOut>(`${V1}/loans/${encodeURIComponent(id)}`, { as_of: asOf }),
  preview: (id: string, prepayment: Prepayment) =>
    api.post<PreviewOut>(`${V1}/loans/${encodeURIComponent(id)}/prepayments/preview`, prepayment),
  addPrepayment: (id: string, prepayment: Prepayment) =>
    api.post<LoanDetailOut>(`${V1}/loans/${encodeURIComponent(id)}/prepayments`, prepayment),
  remove: (id: string) => api.post<LoanDetailOut>(`${V1}/loans/${encodeURIComponent(id)}/delete`),
  complete: (id: string) => api.post<LoanDetailOut>(`${V1}/loans/${encodeURIComponent(id)}/complete`),
  restore: (id: string) => api.post<LoanDetailOut>(`${V1}/loans/${encodeURIComponent(id)}/restore`),
};

export const calculatorApi = {
  schedule: (loan: LoanIn) => api.post<ScheduleRowOut[]>(`${V1}/calculator/schedule`, loan),
  calculate: (body: CalculationIn) => api.post<CalculationOut>(`${V1}/calculator/calculate`, body),
};

const enc = encodeURIComponent;

export const expensesApi = {
  /** Разобрать выписку и показать новые операции с категориями — в базу ничего не пишет. */
  previewImport: (bank: string, file: File) => {
    const form = new FormData();
    form.append('bank', bank);
    form.append('file', file);
    return api.post<ImportPreview>(`${V1}/expenses/imports/preview`, form);
  },
  /** Сохранить проверенную выписку: тот же файл + правки категорий. */
  importStatement: (bank: string, file: File, overrides: ImportOverride[] = []) => {
    const form = new FormData();
    form.append('bank', bank);
    form.append('file', file);
    form.append('overrides', JSON.stringify(overrides));
    return api.post<ImportResult>(`${V1}/expenses/imports`, form);
  },
  operations: (query: { month?: string; category_id?: string; uncategorized?: boolean }) =>
    api.get<ExpenseOperation[]>(`${V1}/expenses/operations`, {
      month: query.month,
      category_id: query.category_id,
      uncategorized: query.uncategorized ? 'true' : undefined,
    }),
  similar: (id: string) => api.get<RulePreview>(`${V1}/expenses/operations/${enc(id)}/similar`),
  setCategories: (operationIds: string[], categoryId: string) =>
    api.post<{ updated: number }>(`${V1}/expenses/operations/category`, { operation_ids: operationIds, category_id: categoryId }),
  setCategory: (id: string, categoryId: string, remember: boolean) =>
    api.patch<CategoryChange>(`${V1}/expenses/operations/${enc(id)}`, { category_id: categoryId, remember }),
  categories: () => api.get<ExpenseCategory[]>(`${V1}/expenses/categories`),
  groups: () => api.get<ExpenseGroup[]>(`${V1}/expenses/groups`),
  goals: (month?: string) => api.get<SavingsGoal[]>(`${V1}/expenses/goals`, { month }),
  previewGoal: (goal: SavingsGoalIn, month: string) => api.post<LoanGoalPreview>(`${V1}/expenses/goals/preview?month=${enc(month)}`, goal),
  createGoal: (goal: SavingsGoalIn) => api.post<SavingsGoal>(`${V1}/expenses/goals`, goal),
  updateGoal: (id: string, goal: SavingsGoalIn) => api.put<SavingsGoal>(`${V1}/expenses/goals/${enc(id)}`, goal),
  deleteGoal: (id: string) => api.delete<null>(`${V1}/expenses/goals/${enc(id)}`),
  addContribution: (id: string, contribution: ContributionIn) => api.post<{ id: string }>(`${V1}/expenses/goals/${enc(id)}/contributions`, contribution),
  analysis: (from: string, to: string) => api.get<SpendingAnalysis>(`${V1}/expenses/analysis`, { from, to }),
  updateGroup: (id: string, patch: GroupPatch) => api.patch<ExpenseGroup>(`${V1}/expenses/groups/${enc(id)}`, patch),
  createCategory: (category: CategoryIn) => api.post<ExpenseCategory>(`${V1}/expenses/categories`, category),
  updateCategory: (id: string, patch: Partial<CategoryIn>) =>
    api.patch<ExpenseCategory>(`${V1}/expenses/categories/${enc(id)}`, patch),
  deleteCategory: (id: string, moveTo?: string) =>
    api.delete<null>(`${V1}/expenses/categories/${enc(id)}${moveTo ? `?move_to=${enc(moveTo)}` : ''}`),
  accounts: () => api.get<ExpenseAccount[]>(`${V1}/expenses/accounts`),
  createAccount: (account: ExpenseAccountIn) => api.post<ExpenseAccount>(`${V1}/expenses/accounts`, account),
  deleteAccount: (id: string) => api.delete<null>(`${V1}/expenses/accounts/${enc(id)}`),
  month: (month: string) => api.get<MonthReport>(`${V1}/expenses/months/${enc(month)}`),
  incomeCheck: (year: number) => api.get<IncomeCheck[]>(`${V1}/expenses/income-check/${year}`),
};
