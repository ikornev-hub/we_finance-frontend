// Пример «Расходов» — вымышленные операции из обезличенного образца выписки (analysts/requirements/fixtures).
// Показывается, только пока backend не умеет соответствующий эндпоинт.

import type {
  ExpenseAccount,
  ExpenseCategory,
  ExpenseOperation,
  IncomeCheck,
  MonthCategory,
  MonthGroup,
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

// Эталон групп из analysts/requirements/fixtures/README.md (без плана: прогноз = факт).
const cat = (
  id: string,
  name: string,
  group_code: MonthCategory['group_code'],
  amount: string,
  share: string | null,
  children: MonthCategory['children'] = [],
  limit: Partial<MonthCategory> = {},
): MonthCategory => ({
  id,
  name,
  system_code: null,
  group_code,
  amount,
  share,
  limit_mode: null,
  target_share: null,
  target: null,
  deviation: null,
  remaining: null,
  children,
  ...limit,
});

const SAMPLE_CATS: MonthCategory[] = [
  cat('c-credit', 'Кредит', 'mandatory', '50000.00', null, [], { system_code: 'credit' }),
  cat('c-home', 'Жильё', 'mandatory', '30000.00', null, [{ id: 'c-home-rent', name: 'Аренда', amount: '30000.00', share: null }], { system_code: 'housing' }),
  cat('c-phone', 'Связь', 'mandatory', '500.00', null, [{ id: 'c-phone-mobile', name: 'Мобильная', amount: '500.00', share: null }]),
  cat('c-car', 'Машина', 'managed', '4150.00', '0.0417', [
    { id: 'c-car-fuel', name: 'Бензин', amount: '4000.00', share: '0.0402' },
    { id: 'c-car-wash', name: 'Мойка', amount: '150.00', share: '0.0015' },
  ], { limit_mode: 'amount', target_share: '0.1005', target: '10000.00', deviation: '-5850.00', remaining: '5850.00' }),
  cat('c-food', 'Еда', 'managed', '2133.56', '0.0214', [
    { id: 'c-food-groceries', name: 'Продукты', amount: '1234.56', share: '0.0124' },
    { id: 'c-food-alcohol', name: 'Алкоголь', amount: '899.00', share: '0.0090' },
  ], { limit_mode: 'share', target_share: '0.15', target: '14925.00', deviation: '-12791.44', remaining: '12791.44' }),
  cat('c-tax', 'Налоги и штрафы', 'unmanaged', '562.50', '0.0057', [{ id: 'c-tax-fines', name: 'Штрафы', amount: '562.50', share: '0.0057' }]),
  cat('c-none', 'Неопределённые', 'service', '10777.70', '0.1083', [], { system_code: 'uncategorized' }),
  cat('c-own', 'Переводы себе', 'service', '2500.00', '0.0251', [], { system_code: 'own_transfer' }),
];

const group = (id: string | null, code: MonthGroup['code'], name: string, amount: string, share: string): MonthGroup => ({
  id,
  code,
  name,
  amount,
  share,
  limit_mode: null,
  target_share: null,
  target: null,
  deviation: null,
  remaining: null,
  categories: SAMPLE_CATS.filter((category) => category.group_code === code),
});

export const SAMPLE_MONTH: MonthReport = {
  month: '2026-10',
  income: '180000.00',
  expenses: '100623.76',
  balance: '79376.24',
  disposable: '99500.00',
  uncategorized_count: 4,
  has_statement: true,
  closed: true,
  warnings: [],
  forecast: {
    income: '180000.00',
    mandatory: '80500.00',
    disposable: '99500.00',
    spent: '20123.76',
    can_spend: '79376.24',
    limits_total: '24925.00',
    unallocated: '74575.00',
  },
  groups: [
    group('g-mandatory', 'mandatory', 'Обязательные', '80500.00', '0.4472'),
    group('g-managed', 'managed', 'Управляемые', '6283.56', '0.0632'),
    group('g-unmanaged', 'unmanaged', 'Неуправляемые', '562.50', '0.0057'),
    group('g-purchases', 'purchases', 'Покупки', '0.00', '0.0000'),
    group(null, 'service', 'Служебные', '13277.70', '0.1334'),
  ],
  categories: SAMPLE_CATS,
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
