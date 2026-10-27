import { Button, Group, NumberInput, Stack, Text } from '@mantine/core';
import { IconCash, IconCheck, IconFileUpload, IconListSearch, IconPigMoney } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import type { BalanceView, LoanDetailOut, SavingsGoal } from '../../api/types';
import { date } from '../../lib/format';
import { Panel } from '../Cards';

// Блоки дня (были на «Этом месяце», с 2026-10-27 — в «Кино»): что сделать, ближайшие доходы и платежи,
// остаток на счёте против ожидаемого.

const rub = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`;
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const go = (hash: string) => () => (window.location.hash = hash);

function plural(count: number, one: string, few: string, many: string): string {
  const tens = count % 100;
  const units = count % 10;
  if (tens >= 11 && tens <= 14) return many;
  if (units === 1) return one;
  return units >= 2 && units <= 4 ? few : many;
}

function shiftDay(iso: string, delta: number): string {
  const day = new Date(`${iso}T00:00:00`);
  day.setDate(day.getDate() + delta);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

interface Task {
  key: string;
  day: string | null;
  icon: ReactNode;
  text: string;
  action: string;
  onClick: () => void;
}

/** «Сделать»: выписка, разбор, взносы и ЧДП по целям в ближайшие 14 дней; сделанное исчезает само. */
export function Todo({ today, until, waiting, goals, loans }: { today: string; until: string | null; waiting: number | null; goals: SavingsGoal[]; loans: LoanDetailOut[] }) {
  const tasks: Task[] = [];
  if (!until || days(until, today) > 7) {
    tasks.push({
      key: 'statement',
      day: null,
      icon: <IconFileUpload size={18} />,
      text: until ? `Выписка устарела: данные по ${date(until)}` : 'Выписки ещё нет',
      action: 'Загрузить',
      onClick: go('#expenses/import'),
    });
  }
  if (waiting) {
    tasks.push({
      key: 'review',
      day: null,
      icon: <IconListSearch size={18} />,
      text: `Без категории: ${waiting} ${plural(waiting, 'операция', 'операции', 'операций')}`,
      action: 'Разобрать',
      onClick: go('#expenses/review'),
    });
  }
  // взносы и ЧДП по целям в ближайшие 14 дней; ЧДП, уже записанный в «Кредитах», — сделано
  const seen = new Set<string>();
  for (const goal of goals) {
    for (const day of goal.paydays) {
      const key = `${goal.id}/${day.date}`;
      if (seen.has(key) || day.date < shiftDay(today, -3) || days(today, day.date) > 14) continue;
      seen.add(key);
      if (goal.loan_id) {
        const loan = loans.find((item) => item.id === goal.loan_id);
        const done = loan?.history.some((entry) => entry.kind === 'prepayment' && Math.abs(days(entry.date, day.date)) <= 3);
        if (done) continue;
        tasks.push({
          key,
          day: day.date,
          icon: <IconCash size={18} />,
          text: `${date(day.date)} · ЧДП ${rub(Number(day.amount))} по цели «${goal.name}»`,
          action: 'Внёс ЧДП',
          onClick: go(`#loans/list/${goal.loan_id}`),
        });
      } else {
        tasks.push({
          key,
          day: day.date,
          icon: <IconPigMoney size={18} />,
          text: `${date(day.date)} · отложить ${rub(Number(day.amount))} на «${goal.name}»`,
          action: 'Отложил',
          onClick: go('#goals'),
        });
      }
    }
  }
  tasks.sort((a, b) => (a.day ?? '').localeCompare(b.day ?? ''));
  return (
    <Panel title="Сделать" subtitle="Только то, что ждёт тебя; сделанное исчезает само">
      {tasks.length === 0 ? (
        <Group gap="xs">
          <IconCheck size={18} color="var(--mantine-color-teal-6)" />
          <Text size="sm">Всё сделано</Text>
        </Group>
      ) : (
        <Stack gap={6}>
          {tasks.map((task) => {
            const late = task.day !== null && task.day < today;
            const soon = task.day !== null && !late && days(today, task.day) <= 3;
            return (
              <Group
                key={task.key}
                justify="space-between"
                wrap="wrap"
                gap="xs"
                p={8}
                style={{ borderRadius: 10, background: late ? 'var(--mantine-color-red-light)' : soon ? 'var(--mantine-color-orange-light)' : 'var(--mantine-color-default-hover)' }}
              >
                <Group gap="sm" wrap="nowrap">
                  {task.icon}
                  <Text size="sm" fw={500}>
                    {task.text}
                    {late ? ' — просрочено' : ''}
                  </Text>
                </Group>
                <Button size="xs" ml="auto" variant={late || soon ? 'filled' : 'light'} color={late ? 'red' : soon ? 'orange' : undefined} onClick={task.onClick}>
                  {task.action}
                </Button>
              </Group>
            );
          })}
        </Stack>
      )}
    </Panel>
  );
}

/** «Ближайшее»: доходы и обязательные платежи с сегодняшнего дня (цели и ЧДП — в «Сделать»). */
export function Upcoming({ today, events }: { today: string; events: BalanceView['events'] }) {
  const list = events
    .filter((event) => event.day >= today && !event.label.startsWith('Цель:') && !event.label.startsWith('ЧДП:'))
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(0, 7);
  return (
    <Panel title="Ближайшее" subtitle="Доходы и обязательные платежи">
      <Stack gap={6}>
        {list.map((event) => (
          <Group key={`${event.day}/${event.label}`} justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Text size="sm" c="dimmed" w={48}>
                {date(event.day).slice(0, 5)}
              </Text>
              <Text size="sm">{event.label}</Text>
            </Group>
            <Text size="sm" fw={600} c={Number(event.amount) > 0 ? 'teal' : undefined} style={{ whiteSpace: 'nowrap' }}>
              {Number(event.amount) > 0 ? '+' : ''}
              {rub(Number(event.amount))}
            </Text>
          </Group>
        ))}
        {list.length === 0 && (
          <Text size="sm" c="dimmed">
            Ничего не запланировано
          </Text>
        )}
      </Stack>
    </Panel>
  );
}

/** Остаток на счёте: по выписке против ожидаемого; сегодня — сверка с приложением банка. */
export function BalanceSummary({ balance, today, isCurrent }: { balance: BalanceView | null; today: string; isCurrent: boolean }) {
  const [typed, setTyped] = useState<number | ''>('');
  const expectedOn = useMemo(() => new Map((balance?.expected ?? []).map((point) => [point.day, Number(point.balance)])), [balance]);
  if (!balance) return null;
  if (balance.start_balance === null) {
    return (
      <Panel title="Остаток на счёте" subtitle="Нужна выписка: остаток берётся из её шапки">
        <Button size="xs" variant="light" onClick={go('#expenses/import')}>
          Загрузить выписку
        </Button>
      </Panel>
    );
  }
  const lastFact = balance.actual.at(-1);
  const todayExpected = expectedOn.get(today);
  const compare = (actual: number, expected: number) => {
    const diff = actual - expected;
    return (
      <Text size="sm" fw={600} c={diff < 0 ? 'red' : 'teal'}>
        {diff < 0 ? `на ${rub(-diff)} меньше ожидаемого` : `на ${rub(diff)} лучше ожидаемого`}
      </Text>
    );
  };
  return (
    <Panel title="Остаток на счёте" subtitle={`На начало месяца ${rub(Number(balance.start_balance))}; ожидание — доходы и платежи в свои даты, траты по границам ровно по дням`}>
      <Stack gap="sm">
        {lastFact && (
          <Group justify="space-between">
            <Text size="sm">
              По выписке на {date(lastFact.day)}: <b>{rub(Number(lastFact.balance))}</b>, ожидалось {rub(expectedOn.get(lastFact.day) ?? 0)}
            </Text>
            {compare(Number(lastFact.balance), expectedOn.get(lastFact.day) ?? 0)}
          </Group>
        )}
        {isCurrent && todayExpected !== undefined && (
          <Group justify="space-between" align="flex-end">
            <NumberInput
              label="Сейчас на счёте (из приложения банка)"
              description={`по плану должно быть ≈ ${rub(todayExpected)}`}
              value={typed}
              onChange={(value) => setTyped(value === '' ? '' : Number(value))}
              thousandSeparator=" "
              suffix=" ₽"
              decimalScale={2}
              w={300}
              size="sm"
              radius="md"
            />
            {typed !== '' && compare(typed, todayExpected)}
          </Group>
        )}
        <Text size="xs" c="dimmed">
          Переводы на свои другие счета тоже уменьшают остаток — это не трата, учитывай.
        </Text>
      </Stack>
    </Panel>
  );
}
