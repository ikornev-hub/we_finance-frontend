// Все эндпоинты бэкенда — по одной функции. Пути и параметры как в Swagger (/docs).

import { api, request } from './client';
import type {
  Absence,
  CalculationIn,
  CalculationOut,
  HealthResponse,
  LoanCreateIn,
  LoanDetailOut,
  LoanIn,
  LoanStatus,
  LoanSummaryOut,
  MoneyRoundResponse,
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
};

export const serviceApi = {
  // 503 — API живо, но база недоступна: это тоже ответ, а не ошибка связи.
  health: () => request<HealthResponse>('GET', '/health', { accept: [503] }),
  version: () => api.get<VersionResponse>('/version'),
  round: (amount: string) => api.get<MoneyRoundResponse>(`${V1}/money/round`, { amount }),
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
