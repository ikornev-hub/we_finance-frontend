import { ActionIcon, Alert, Button, Group, Popover, Select, SimpleGrid, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconFlask } from '@tabler/icons-react';
import { useEffect, useState, useSyncExternalStore } from 'react';

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
  width?: number | string;
}) {
  const options = categoryOptions(categories);
  const label = options.find((option) => option.value === value)?.label ?? '';
  // Поиск при открытии — с чистого листа, а не дописыванием к текущей категории (#19).
  const [search, setSearch] = useState(label);
  useEffect(() => setSearch(label), [label]);
  return (
    <Select
      data={options}
      value={value}
      onChange={onChange}
      searchValue={search}
      onSearchChange={setSearch}
      onDropdownOpen={() => setSearch('')}
      onDropdownClose={() => setSearch(label)}
      placeholder="Категория"
      searchable
      radius="md"
      w={width}
      nothingFoundMessage="Нет такой"
      comboboxProps={{ keepMounted: false }}
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

const MONTH_KEY = 'wf.month';
let selectedMonth: string | null = null;

function storedMonth(): string | null {
  try {
    const value = sessionStorage.getItem(MONTH_KEY);
    return value && /^\d{4}-\d{2}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

const monthListeners = new Set<() => void>();

function setSelectedMonth(next: string) {
  selectedMonth = next;
  try {
    sessionStorage.setItem(MONTH_KEY, next);
  } catch {
    // без хранилища месяц живёт до перезагрузки
  }
  monthListeners.forEach((listener) => listener());
}

function subscribeMonth(listener: () => void) {
  monthListeners.add(listener);
  return () => monthListeners.delete(listener);
}

function readMonth(): string {
  selectedMonth ??= storedMonth() ?? currentMonth();
  return selectedMonth;
}

/** Выбранный месяц — один на всё приложение: переключатель в шапке меняет его на всех экранах сразу, переживает переходы и F5 (#11). */
export function useSelectedMonth(): [string, (month: string) => void] {
  return [useSyncExternalStore(subscribeMonth, readMonth), setSelectedMonth];
}

/** Выбранный год — год выбранного месяца: один период на всё приложение. Смена года сохраняет месяц. */
export function useSelectedYear(): [number, (year: number) => void] {
  const [month, setMonth] = useSelectedMonth();
  return [Number(month.slice(0, 4)), (year: number) => setMonth(`${year}-${month.slice(5, 7)}`)];
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

const SHORT_MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

/** Кнопка с месяцем: по клику — окошко выбора (год стрелками, 12 плиток, «Текущий месяц»). */
function MonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const [opened, setOpened] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const now = currentMonth();
  const pick = (next: string) => {
    onChange(next);
    setOpened(false);
  };
  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom"
      shadow="lg"
      radius="md"
      withinPortal={false}
      trapFocus
    >
      <Popover.Target>
        <Button variant="default" size="sm" miw={140} onClick={() => {
            setYear(Number(month.slice(0, 4)));
            setOpened((value) => !value);
          }} aria-label="Выбрать месяц">
          {monthTitle(month)}
        </Button>
      </Popover.Target>
      <Popover.Dropdown p="sm" w={264}>
        <Group justify="space-between" mb="xs">
          <ActionIcon variant="subtle" color="gray" onClick={() => setYear(year - 1)} aria-label="Предыдущий год">
            <IconChevronLeft size={16} />
          </ActionIcon>
          <Text fw={700}>{year}</Text>
          <ActionIcon variant="subtle" color="gray" onClick={() => setYear(year + 1)} aria-label="Следующий год">
            <IconChevronRight size={16} />
          </ActionIcon>
        </Group>
        <SimpleGrid cols={3} spacing={6}>
          {SHORT_MONTHS.map((name, index) => {
            const value = `${year}-${String(index + 1).padStart(2, '0')}`;
            const selected = value === month;
            return (
              <Button
                key={value}
                size="md"
                px={0}
                variant={selected ? 'filled' : value === now ? 'outline' : 'subtle'}
                color={selected || value === now ? 'brand' : 'gray'}
                onClick={() => pick(value)}
                aria-pressed={selected}
              >
                {name}
              </Button>
            );
          })}
        </SimpleGrid>
        <Button variant="light" color="gray" fullWidth mt="sm" onClick={() => pick(now)} disabled={month === now}>
          Текущий месяц
        </Button>
      </Popover.Dropdown>
    </Popover>
  );
}

/** Кнопка с годом: по клику — 9 плиток лет (стрелки листают по 9) и «Текущий год». */
function YearPicker({ year, onChange }: { year: number; onChange: (year: number) => void }) {
  const [opened, setOpened] = useState(false);
  const [from, setFrom] = useState(year - 4);
  const now = new Date().getFullYear();
  const pick = (next: number) => {
    onChange(next);
    setOpened(false);
  };
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom" shadow="lg" radius="md" withinPortal={false} trapFocus>
      <Popover.Target>
        <Button
          variant="default"
          size="sm"
          miw={96}
          onClick={() => {
            setFrom(year - 4);
            setOpened((value) => !value);
          }}
          aria-label="Выбрать год"
        >
          {year}
        </Button>
      </Popover.Target>
      <Popover.Dropdown p="sm" w={232}>
        <Group justify="space-between" mb="xs">
          <ActionIcon variant="subtle" color="gray" onClick={() => setFrom(from - 9)} aria-label="Раньше">
            <IconChevronLeft size={16} />
          </ActionIcon>
          <Text fw={700}>
            {from} – {from + 8}
          </Text>
          <ActionIcon variant="subtle" color="gray" onClick={() => setFrom(from + 9)} aria-label="Позже">
            <IconChevronRight size={16} />
          </ActionIcon>
        </Group>
        <SimpleGrid cols={3} spacing={6}>
          {Array.from({ length: 9 }, (_, index) => from + index).map((value) => (
            <Button
              key={value}
              size="md"
              px={0}
              variant={value === year ? 'filled' : value === now ? 'outline' : 'subtle'}
              color={value === year || value === now ? 'brand' : 'gray'}
              onClick={() => pick(value)}
              aria-pressed={value === year}
            >
              {value}
            </Button>
          ))}
        </SimpleGrid>
        <Button variant="light" color="gray" fullWidth mt="sm" onClick={() => pick(now)} disabled={year === now}>
          Текущий год
        </Button>
      </Popover.Dropdown>
    </Popover>
  );
}

export function YearSwitch({ year, onChange }: { year: number; onChange: (year: number) => void }) {
  return (
    <Group gap={4} wrap="nowrap">
      <Button variant="default" size="sm" px={8} onClick={() => onChange(year - 1)} aria-label="Предыдущий год">
        <IconChevronLeft size={16} />
      </Button>
      <YearPicker year={year} onChange={onChange} />
      <Button variant="default" size="sm" px={8} onClick={() => onChange(year + 1)} aria-label="Следующий год">
        <IconChevronRight size={16} />
      </Button>
    </Group>
  );
}

export function MonthSwitch({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return (
    <Group gap={4}>
      <Button variant="default" size="sm" px={8} onClick={() => onChange(shiftMonth(month, -1))} aria-label="Предыдущий месяц">
        <IconChevronLeft size={16} />
      </Button>
      <MonthPicker month={month} onChange={onChange} />
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
