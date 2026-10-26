import { Alert, Button, Group, Select, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconFlask } from '@tabler/icons-react';

import type { ExpenseCategory, IncomeCheckStatus } from '../../api/types';

/** Плашка над экраном, который показывает пример вместо настоящих данных. */
export function SampleNotice({ what }: { what: string }) {
  return (
    <Alert color="yellow" radius="lg" variant="light" icon={<IconFlask size={18} />} title="Пример: сервер этого ещё не умеет">
      <Text size="sm">
        {what} — вымышленные данные, чтобы было видно форму. Как только backend научится, здесь появятся твои.
      </Text>
    </Alert>
  );
}

/** Плоский список категорий для выбора: «Машина», «Машина / Бензин». */
export function categoryOptions(categories: ExpenseCategory[]): { value: string; label: string }[] {
  return categories.flatMap((category) => [
    { value: category.id, label: category.name },
    ...category.children.map((child) => ({ value: child.id, label: `${category.name} / ${child.name}` })),
  ]);
}

export function CategorySelect({
  categories,
  value,
  onChange,
  width = 260,
}: {
  categories: ExpenseCategory[];
  value: string | null;
  onChange: (value: string | null) => void;
  width?: number;
}) {
  return (
    <Select
      data={categoryOptions(categories)}
      value={value}
      onChange={onChange}
      placeholder="Категория"
      searchable
      radius="md"
      w={width}
      nothingFoundMessage="Нет такой"
    />
  );
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/** "2026-10" → "Октябрь 2026". */
export function monthTitle(month: string): string {
  const [year, number] = month.split('-').map(Number);
  return `${MONTH_NAMES[number - 1]} ${year}`;
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, number] = month.split('-').map(Number);
  const index = year * 12 + (number - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function MonthSwitch({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return (
    <Group gap={4}>
      <Button variant="default" size="sm" px={8} onClick={() => onChange(shiftMonth(month, -1))} aria-label="Предыдущий месяц">
        <IconChevronLeft size={16} />
      </Button>
      <Button variant="default" size="sm" miw={140}>
        {monthTitle(month)}
      </Button>
      <Button variant="default" size="sm" px={8} onClick={() => onChange(shiftMonth(month, 1))} aria-label="Следующий месяц">
        <IconChevronRight size={16} />
      </Button>
    </Group>
  );
}

/** "0.1234" → "12,3 %". */
export function percent(share: string | null): string {
  if (share === null) return '—';
  return `${(Number(share) * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} %`;
}

/** Сверка выплаты с выпиской — бейдж. */
export const CHECK_BADGE: Record<IncomeCheckStatus, { text: string; color: string }> = {
  confirmed: { text: 'Пришло', color: 'teal' },
  mismatch: { text: 'Расхождение', color: 'orange' },
  missing: { text: 'Не найдено в выписке', color: 'red' },
  no_statement: { text: 'Нет выписки', color: 'gray' },
  expected: { text: 'Ожидается', color: 'blue' },
};
