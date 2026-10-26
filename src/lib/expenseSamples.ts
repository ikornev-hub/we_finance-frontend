// Пример «Расходов» — вымышленные операции из обезличенного образца выписки (analysts/requirements/fixtures).
// Показывается, только пока backend не умеет соответствующий эндпоинт.

import type {
  ExpenseAccount,
  ExpenseCategory,
  ExpenseOperation,
  IncomeCheck,
  MonthReport,
} from '../api/types';

export const SAMPLE_CATEGORIES: ExpenseCategory[] = [
  { id: 'c-food', name: 'Еда', system_code: null, target_share: '0.15', children: [{ id: 'c-food-groceries', name: 'Продукты' }, { id: 'c-food-alcohol', name: 'Алкоголь' }] },
  { id: 'c-fun', name: 'Тусовки', system_code: null, target_share: '0.10', children: [{ id: 'c-fun-rest', name: 'Рестораны' }, { id: 'c-fun-cafe', name: 'Кафе и доставка' }, { id: 'c-fun-bar', name: 'Бары' }] },
  {
    id: 'c-car',
    name: 'Машина',
    system_code: null,
    target_share: null,
    target_amount: '10000.00',
    children: [
      { id: 'c-car-fuel', name: 'Бензин' },
      { id: 'c-car-wash', name: 'Мойка' },
      { id: 'c-car-service', name: 'Обслуживание и страховка' },
      { id: 'c-car-parking', name: 'Парковка' },
      { id: 'c-car-toll', name: 'Платные дороги' },
      { id: 'c-car-fines', name: 'Штрафы' },
    ],
  },
  { id: 'c-health', name: 'Здоровье', system_code: null, target_share: null, children: [{ id: 'c-health-pharm', name: 'Аптека' }, { id: 'c-health-med', name: 'Медуслуги' }] },
  { id: 'c-family', name: 'Близкие', system_code: null, target_share: null, children: [{ id: 'c-family-transfers', name: 'Переводы' }, { id: 'c-family-gifts', name: 'Цветы и подарки' }] },
  { id: 'c-phone', name: 'Связь', system_code: null, target_share: null, children: [{ id: 'c-phone-mobile', name: 'Мобильная' }, { id: 'c-phone-net', name: 'Интернет и VPN' }] },
  { id: 'c-home', name: 'Жильё', system_code: 'housing', target_share: null, children: [{ id: 'c-home-rent', name: 'Аренда' }, { id: 'c-home-utils', name: 'ЖКХ' }] },
  { id: 'c-market', name: 'Маркетплейсы', system_code: 'marketplace', target_share: null, children: [] },
  { id: 'c-credit', name: 'Кредит', system_code: 'credit', target_share: null, children: [] },
  { id: 'c-income', name: 'Доход', system_code: 'income', target_share: null, children: [] },
  { id: 'c-none', name: 'Неопределённые', system_code: 'uncategorized', target_share: null, children: [] },
];

export const SAMPLE_UNCATEGORIZED: ExpenseOperation[] = [
  {
    id: 'op-5',
    operated_at: '2026-10-05',
    amount: '-777.70',
    description: 'Операция по карте: место совершения операции: RU/MOSCOW/UNKNOWN SHOP, MCC: 5999',
    merchant: 'UNKNOWN SHOP',
    counterparty: null,
    type: 'card',
    category_id: 'c-none',
    category_path: 'Неопределённые',
  },
  {
    id: 'op-14',
    operated_at: '2026-10-20',
    amount: '1000.00',
    description: 'Перевод по СБП через Систему быстрых платежей от +7 (900) 000-00-05',
    merchant: null,
    counterparty: '+79000000005',
    type: 'transfer_in',
    category_id: 'c-none',
    category_path: 'Неопределённые',
  },
];

// Эталон месяца из analysts/requirements/fixtures/README.md (без плана: прогноз = факт).
export const SAMPLE_MONTH: MonthReport = {
  month: '2026-10',
  income: '180000.00',
  expenses: '100623.76',
  balance: '79376.24',
  disposable: '100000.00',
  uncategorized_count: 4,
  has_statement: true,
  warnings: [],
  forecast: {
    income: '180000.00',
    credit: '50000.00',
    housing: '30000.00',
    disposable: '100000.00',
    spent: '20623.76',
    can_spend: '79376.24',
    limits_total: '25000.00',
    unallocated: '75000.00',
  },
  categories: [
    { id: 'c-credit', name: 'Кредит', system_code: 'credit', amount: '50000.00', share: null, limit_mode: null, target_share: null, target: null, deviation: null, remaining: null, children: [] },
    { id: 'c-home', name: 'Жильё', system_code: 'housing', amount: '30000.00', share: null, limit_mode: null, target_share: null, target: null, deviation: null, remaining: null, children: [{ id: 'c-home-rent', name: 'Аренда', amount: '30000.00', share: null }] },
    { id: 'c-none', name: 'Неопределённые', system_code: 'uncategorized', amount: '10777.70', share: '0.1078', limit_mode: null, target_share: null, target: null, deviation: null, remaining: null, children: [] },
    {
      id: 'c-car',
      name: 'Машина',
      system_code: null,
      amount: '4712.50',
      share: '0.0471',
      limit_mode: 'amount',
      target_share: '0.1000',
      target: '10000.00',
      deviation: '-5287.50',
      remaining: '5287.50',
      children: [
        { id: 'c-car-fuel', name: 'Бензин', amount: '4000.00', share: '0.0400' },
        { id: 'c-car-fines', name: 'Штрафы', amount: '562.50', share: '0.0056' },
        { id: 'c-car-wash', name: 'Мойка', amount: '150.00', share: '0.0015' },
      ],
    },
    { id: 'c-own', name: 'Переводы себе', system_code: 'own_transfer', amount: '2500.00', share: '0.0250', limit_mode: null, target_share: null, target: null, deviation: null, remaining: null, children: [] },
    {
      id: 'c-food',
      name: 'Еда',
      system_code: null,
      amount: '2133.56',
      share: '0.0213',
      limit_mode: 'share',
      target_share: '0.15',
      target: '15000.00',
      deviation: '-12866.44',
      remaining: '12866.44',
      children: [
        { id: 'c-food-groceries', name: 'Продукты', amount: '1234.56', share: '0.0123' },
        { id: 'c-food-alcohol', name: 'Алкоголь', amount: '899.00', share: '0.0090' },
      ],
    },
    { id: 'c-phone', name: 'Связь', system_code: null, amount: '500.00', share: '0.0050', limit_mode: null, target_share: null, target: null, deviation: null, remaining: null, children: [{ id: 'c-phone-mobile', name: 'Мобильная', amount: '500.00', share: '0.0050' }] },
  ],
};

export const SAMPLE_ACCOUNTS: ExpenseAccount[] = [
  { id: 'a-phone', bank: 'alfa', name: 'Мой номер', kind: 'own', number_tail: null, phone: '+79000000009', loan_id: null },
  { id: 'a-credit', bank: 'otp', name: 'ОТП Банк', kind: 'credit', number_tail: '0000', phone: null, loan_id: 'loan-sample' },
];

export const SAMPLE_INCOME_CHECK: IncomeCheck[] = [
  { date: '2026-10-09', kind: 'remainder', expected: '100000.00', status: 'confirmed', operation_date: '2026-10-09', operation_amount: '100000.00', difference: '0.00' },
  { date: '2026-10-23', kind: 'advance', expected: '80500.00', status: 'mismatch', operation_date: '2026-10-23', operation_amount: '80000.00', difference: '-500.00' },
  { date: '2026-11-10', kind: 'remainder', expected: '100000.00', status: 'expected', operation_date: null, operation_amount: null, difference: null },
];

export function sampleOperations(categoryId?: string): ExpenseOperation[] {
  const all: ExpenseOperation[] = [
    ...SAMPLE_UNCATEGORIZED,
    { id: 'op-1', operated_at: '2026-10-01', amount: '-1234.56', description: 'MAGNIT MM TEST, MCC 5411', merchant: 'MAGNIT MM TEST', counterparty: null, type: 'card', category_id: 'c-food-groceries', category_path: 'Еда/Продукты' },
    { id: 'op-2', operated_at: '2026-10-02', amount: '-899.00', description: 'AROMATNYJ MIR, MCC 5921', merchant: 'AROMATNYJ MIR', counterparty: null, type: 'card', category_id: 'c-food-alcohol', category_path: 'Еда/Алкоголь' },
    { id: 'op-3', operated_at: '2026-10-03', amount: '-4000.00', description: 'AZS 00001, MCC 5541', merchant: 'AZS 00001', counterparty: null, type: 'card', category_id: 'c-car-fuel', category_path: 'Машина/Бензин' },
    { id: 'op-4', operated_at: '2026-10-04', amount: '-100.00', description: 'Avtomoika, MCC 7542', merchant: 'Avtomoika', counterparty: null, type: 'card', category_id: 'c-car-wash', category_path: 'Машина/Мойка' },
    { id: 'op-16', operated_at: '2026-10-25', amount: '-50.00', description: 'Оплата по QR: MoiteSami', merchant: null, counterparty: null, type: 'card', category_id: 'c-car-wash', category_path: 'Машина/Мойка' },
    { id: 'op-7', operated_at: '2026-10-07', amount: '-562.50', description: 'Оплата штрафа ГИБДД', merchant: null, counterparty: null, type: 'payment', category_id: 'c-car-fines', category_path: 'Машина/Штрафы' },
  ];
  if (!categoryId) return all;
  const parent = SAMPLE_CATEGORIES.find((category) => category.id === categoryId);
  const ids = new Set([categoryId, ...(parent?.children.map((child) => child.id) ?? [])]);
  return all.filter((operation) => operation.category_id && ids.has(operation.category_id));
}
