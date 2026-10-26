// Все эндпоинты бэкенда — по одной функции. Пути и параметры как в Swagger (/docs).

import { api, request } from './client';
import type {
  CategoryChange,
  CategoryIn,
  ExpenseAccount,
  ExpenseAccountIn,
  ExpenseCategory,
  ExpenseOperation,
  ImportResult,
  IncomeCheck,
  MonthReport,
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
  importStatement: (bank: string, file: File) => {
    const form = new FormData();
    form.append('bank', bank);
    form.append('file', file);
    return api.post<ImportResult>(`${V1}/expenses/imports`, form);
  },
  operations: (query: { month?: string; category_id?: string; uncategorized?: boolean }) =>
    api.get<ExpenseOperation[]>(`${V1}/expenses/operations`, {
      month: query.month,
      category_id: query.category_id,
      uncategorized: query.uncategorized ? 'true' : undefined,
    }),
  setCategory: (id: string, categoryId: string, remember: boolean) =>
    api.patch<CategoryChange>(`${V1}/expenses/operations/${enc(id)}`, { category_id: categoryId, remember }),
  categories: () => api.get<ExpenseCategory[]>(`${V1}/expenses/categories`),
  createCategory: (category: CategoryIn) => api.post<ExpenseCategory>(`${V1}/expenses/categories`, category),
  updateCategory: (id: string, patch: Partial<CategoryIn>) =>
    api.patch<ExpenseCategory>(`${V1}/expenses/categories/${enc(id)}`, patch),
  deleteCategory: (id: string) => api.delete<null>(`${V1}/expenses/categories/${enc(id)}`),
  accounts: () => api.get<ExpenseAccount[]>(`${V1}/expenses/accounts`),
  createAccount: (account: ExpenseAccountIn) => api.post<ExpenseAccount>(`${V1}/expenses/accounts`, account),
  deleteAccount: (id: string) => api.delete<null>(`${V1}/expenses/accounts/${enc(id)}`),
  month: (month: string) => api.get<MonthReport>(`${V1}/expenses/months/${enc(month)}`),
  incomeCheck: (year: number) => api.get<IncomeCheck[]>(`${V1}/expenses/income-check/${year}`),
};
