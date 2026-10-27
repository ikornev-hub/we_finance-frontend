import { LineChart } from '@mantine/charts';
import { Badge, Button, Group, NumberInput, Progress, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core';
import { IconAlertTriangle, IconCash, IconCheck, IconFileUpload, IconListSearch, IconPigMoney } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { expensesApi, loansApi } from '../api/endpoints';
import type { BalanceView, LoanDetailOut, MonthGroup, MonthReport, SavingsGoal, SpendingAnalysis } from '../api/types';
import { PageHeader, Panel } from '../components/Cards';
import { ErrorAlert } from '../components/ErrorAlert';
import { currentMonth, monthTitle, shiftMonth, useSelectedMonth } from '../components/expenses/common';
import { groupLimit } from '../lib/limits';
import { date, todayIso } from '../lib/format';
import { useOrSample } from '../lib/sample';

// Главная — пульт месяца (решения заказчика 2026-10-27):
// располагаемый бюджет; что сделать; остаток на счёте против ожидаемого; кредит и цели — по фактам;
// траты по группам и категориям с засечкой «где должно быть» (ровно по дням); ближайшие доходы и платежи.

const rub = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`;
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const go = (hash: string) => () => (window.location.hash = hash);

function useLoad<T>(fn: () => Promise<T>, key: string): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    fn()
      .then((value) => alive && setData(value))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
    // перезагрузка — по ключу
  }, [key]);
  return data;
}

export function HomePage() {
  const today = todayIso();
  const [month] = useSelectedMonth();
  const isCurrent = month === currentMonth();
  const next = shiftMonth(month, 1);

  const report = useOrSample(() => expensesApi.month(month), null as unknown as MonthReport, `home/${month}`);
  const goals = useLoad(() => expensesApi.goals(month), `goals/${month}`) ?? [];
  const balance = useLoad(() => expensesApi.balance(month), `balance/${month}`);
  const balanceNext = useLoad(() => expensesApi.balance(next), `balance/${next}`);
  const goalsNext = useLoad(() => expensesApi.goals(next), `goals/${next}`) ?? [];
  const waiting = useLoad(() => expensesApi.operations({ uncategorized: true }).then((list) => list.length), 'uncategorized');
  const analysis = useLoad(() => expensesApi.analysis(shiftMonth(currentMonth(), -6), currentMonth()), 'analysis6');
  const loans = useLoad<LoanDetailOut[]>(async () => {
    const active = await loansApi.list();
    return Promise.all(active.map((loan) => loansApi.detail(loan.id)));
  }, 'loans');

  const data = report.data;
  if (report.error) return <ErrorAlert error={report.error} />;
  if (!data) return <Text c="dimmed">Загружаю…</Text>;

  const until = balance?.statement_until ?? null;
  const forecast = data.forecast;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <PageHeader title={monthTitle(month)} subtitle="Сколько можно тратить, что сделать и как идёт месяц." />
      </Group>

      <Hero forecast={forecast} until={until} />

      {isCurrent && <Todo today={today} until={until} waiting={waiting} goals={[...goals, ...goalsNext]} loans={loans ?? []} />}

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <BalanceBlock balance={balance} today={today} isCurrent={isCurrent} />
        <Spending report={data} until={until} analysis={analysis} month={month} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
        <LoansBlock loans={loans} goals={goals} />
        <GoalsBlock goals={goals} month={month} />
        <Upcoming today={today} events={[...(balance?.events ?? []), ...(balanceNext?.events ?? [])]} />
      </SimpleGrid>
    </Stack>
  );
}

// ---------- располагаемый бюджет ----------

function Hero({ forecast, until }: { forecast: MonthReport['forecast']; until: string | null }) {
  const disposable = Number(forecast.disposable);
  const left = Number(forecast.can_spend);
  return (
    <Panel>
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <div>
          <Text size="sm" c="dimmed" fw={600}>
            Располагаемый бюджет
          </Text>
          <Text fz={40} fw={800} lh={1.1} c={disposable < 0 ? 'red' : undefined}>
            {rub(disposable)}
          </Text>
          <Text size="sm" c="dimmed">
            {Number(forecast.savings) > 0 && <>в цели {rub(Number(forecast.savings))} · </>}
            потрачено {rub(Number(forecast.spent))} · осталось{' '}
            <Text span fw={700} c={left < 0 ? 'red' : 'teal'}>
              {rub(left)}
            </Text>
          </Text>
        </div>
        <Text size="xs" c="dimmed">
          {until ? `по выписке на ${date(until)}` : 'выписки ещё нет'}
        </Text>
      </Group>
    </Panel>
  );
}

// ---------- сделать ----------

interface Task {
  key: string;
  day: string | null;
  icon: ReactNode;
  text: string;
  action: string;
  onClick: () => void;
}

function Todo({ today, until, waiting, goals, loans }: { today: string; until: string | null; waiting: number | null; goals: SavingsGoal[]; loans: LoanDetailOut[] }) {
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
    tasks.push({ key: 'review', day: null, icon: <IconListSearch size={18} />, text: `Без категории: ${waiting} ${plural(waiting, 'операция', 'операции', 'операций')}`, action: 'Разобрать', onClick: go('#expenses/review') });
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
              <Group key={task.key} justify="space-between" wrap="nowrap" p={8} style={{ borderRadius: 10, background: late ? 'var(--mantine-color-red-light)' : soon ? 'var(--mantine-color-orange-light)' : 'var(--mantine-color-default-hover)' }}>
                <Group gap="sm" wrap="nowrap">
                  {task.icon}
                  <Text size="sm" fw={500}>
                    {task.text}
                    {late ? ' — просрочено' : ''}
                  </Text>
                </Group>
                <Button size="xs" variant={late || soon ? 'filled' : 'light'} color={late ? 'red' : soon ? 'orange' : undefined} onClick={task.onClick}>
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

// ---------- остаток на счёте ----------

function BalanceBlock({ balance, today, isCurrent }: { balance: BalanceView | null; today: string; isCurrent: boolean }) {
  const [typed, setTyped] = useState<number | ''>('');
  const expectedOn = useMemo(() => new Map((balance?.expected ?? []).map((point) => [point.day, Number(point.balance)])), [balance]);
  if (!balance) return <Panel title="Остаток на счёте">{null}</Panel>;
  if (balance.start_balance === null) {
    return (
      <Panel title="Остаток на счёте" subtitle="Нужна выписка: остаток берётся из её шапки">
        <Button size="xs" variant="light" onClick={go('#expenses/import')}>
          Загрузить выписку
        </Button>
      </Panel>
    );
  }
  const actualOn = new Map(balance.actual.map((point) => [point.day, Number(point.balance)]));
  const lastFact = balance.actual.at(-1);
  const chart = balance.expected.map((point) => ({
    day: point.day.slice(8, 10),
    Ожидание: Number(point.balance),
    Факт: actualOn.get(point.day),
  }));
  const compare = (actual: number, expected: number) => {
    const diff = actual - expected;
    return (
      <Text size="sm" fw={600} c={diff < 0 ? 'red' : 'teal'}>
        {diff < 0 ? `потрачено на ${rub(-diff)} больше ожидаемого` : `на ${rub(diff)} лучше ожидаемого`}
      </Text>
    );
  };
  const todayExpected = expectedOn.get(today);
  return (
    <Panel title="Остаток на счёте" subtitle={`На начало месяца ${rub(Number(balance.start_balance))}; ожидание — доходы и платежи в свои даты, траты по границам ровно по дням`}>
      <Stack gap="sm">
        <LineChart
          h={200}
          data={chart}
          dataKey="day"
          series={[
            { name: 'Факт', color: 'brand.6' },
            { name: 'Ожидание', color: 'blue.5', strokeDasharray: '6 4' },
          ]}
          valueFormatter={(value) => rub(value)}
          connectNulls={false}
          withDots={false}
          curveType="linear"
          gridAxis="y"
          referenceLines={[{ y: 0, color: 'gray.5' }]}
          yAxisProps={{ width: 64, tickFormatter: (value: number) => `${Math.round(value / 1000)} тыс` }}
        />
        {lastFact && (
          <Group justify="space-between">
            <Text size="sm">
              По выписке на {date(lastFact.day)}: {rub(Number(lastFact.balance))}, ожидалось {rub(expectedOn.get(lastFact.day) ?? 0)}
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

// ---------- траты ----------

const SPEND_GROUPS = new Set(['managed', 'unmanaged', 'purchases']);

function Thermo({ label, spent, limit, pace, bold }: { label: string; spent: number; limit: number | null; pace: number; bold?: boolean }) {
  const share = limit ? (spent / limit) * 100 : 0;
  const ahead = limit !== null && share > pace * 100;
  return (
    <div>
      <Group justify="space-between" gap="xs">
        <Text size="sm" fw={bold ? 700 : 400} pl={bold ? 0 : 'md'}>
          {label}
        </Text>
        <Text size="sm" fw={bold ? 700 : 500} c={limit !== null && spent > limit ? 'red' : undefined}>
          {rub(spent)}
          {limit !== null && (
            <Text span c="dimmed" fw={400}>
              {' '}
              / {rub(limit)}
            </Text>
          )}
        </Text>
      </Group>
      {limit !== null && (
        <div style={{ position: 'relative' }}>
          <Progress value={Math.min(share, 100)} size={bold ? 10 : 6} radius="xl" color={spent > limit ? 'red' : ahead ? 'orange' : 'teal'} mt={4} />
          <Tooltip label={`к дате выписки «положено» ${rub(limit * pace)}`}>
            <div style={{ position: 'absolute', left: `${pace * 100}%`, top: 0, bottom: -2, width: 2, background: 'var(--mantine-color-dark-3)' }} />
          </Tooltip>
        </div>
      )}
    </div>
  );
}

function Spending({ report, until, analysis, month }: { report: MonthReport; until: string | null; analysis: SpendingAnalysis | null; month: string }) {
  const total = Number(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate());
  const dayOf = until && until.startsWith(month) ? Number(until.slice(8, 10)) : until && until > month ? total : 0;
  const pace = dayOf / total;
  const groups = report.groups.filter((group) => SPEND_GROUPS.has(group.code) && group.categories.length);
  const medians = new Map((analysis?.stats ?? []).filter((stat) => stat.kind === 'category').map((stat) => [stat.id, Number(stat.median)]));
  const warnings = report.categories
    .filter((category) => category.target !== null && (medians.get(category.id) ?? 0) > Number(category.target))
    .map((category) => `${category.name} обычно ${rub(medians.get(category.id) ?? 0)} > граница ${rub(Number(category.target))}`);
  const take = (group: MonthGroup) => groupLimit(group);
  return (
    <Panel
      title="Траты"
      subtitle={until ? `По выписке на ${date(until)} — ${Math.round(pace * 100)} % месяца; засечка — сколько «положено» к этой дате` : 'Выписки за месяц нет'}
      actions={
        <Button size="xs" variant="subtle" onClick={go('#expenses/budget')}>
          Бюджет →
        </Button>
      }
    >
      <Stack gap="md">
        {groups.map((group) => (
          <Stack key={group.code} gap={6}>
            <Thermo label={group.name} spent={Number(group.amount)} limit={take(group)} pace={pace} bold />
            {group.categories
              .filter((category) => Number(category.amount) > 0 || category.target !== null)
              .map((category) => (
                <Thermo key={category.id} label={category.name} spent={Number(category.amount)} limit={category.target === null ? null : Number(category.target)} pace={pace} />
              ))}
          </Stack>
        ))}
        {warnings.length > 0 && (
          <Stack gap={2}>
            {warnings.map((warning) => (
              <Group key={warning} gap={6} wrap="nowrap">
                <IconAlertTriangle size={14} color="var(--mantine-color-orange-6)" />
                <Text size="xs" c="orange">
                  прогноз: {warning}
                </Text>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </Panel>
  );
}

// ---------- кредит ----------

function Row({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <Group justify="space-between" gap="xs">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={strong ? 700 : 500} c={color}>
        {value}
      </Text>
    </Group>
  );
}

function LoansBlock({ loans, goals }: { loans: LoanDetailOut[] | null; goals: SavingsGoal[] }) {
  if (!loans) return <Panel title="Кредит">{null}</Panel>;
  if (!loans.length)
    return (
      <Panel title="Кредит">
        <Text size="sm">Активных кредитов нет</Text>
      </Panel>
    );
  return (
    <>
      {loans.map((loan) => {
        const future = loan.schedule.filter((row) => row.status !== 'done');
        const left = future.reduce((sum, row) => sum + Number(row.payment), 0);
        const interest = future.reduce((sum, row) => sum + Number(row.interest), 0);
        const debt = Number(loan.actual.balance);
        const principal = Number(loan.start.balance);
        const goal = goals.find((item) => item.loan_id === loan.id);
        const nextPayment = loan.actual.next_payment;
        return (
          <Panel key={loan.id} title={loan.name} subtitle="По графику банка и твоей истории ЧДП" actions={<Button size="xs" variant="subtle" onClick={go(`#loans/list/${loan.id}`)}>Открыть →</Button>}>
            <Stack gap={6}>
              <Group justify="space-between" align="flex-end">
                <div>
                  <Text size="xs" c="dimmed">
                    осталось долга
                  </Text>
                  <Text fz={26} fw={800}>
                    {rub(debt)}
                  </Text>
                </div>
                <Text size="sm" c="dimmed">
                  {Math.round((debt / principal) * 100)} % от {rub(principal)}
                </Text>
              </Group>
              <Progress value={(debt / principal) * 100} size="md" radius="xl" color="brand" />
              <Row label="осталось заплатить всего" value={rub(left)} strong />
              <Row label="из них процентов" value={rub(interest)} />
              <Row label="платежей осталось" value={String(loan.actual.payments_left)} />
              {nextPayment && <Row label="следующий платёж" value={`${date(nextPayment.date)} · ${rub(Number(nextPayment.payment))}`} />}
              <Row label="закрытие по графику" value={date(loan.actual.close_date)} />
              {goal?.closes_on && <Row label={`с целью «${goal.name}»`} value={date(goal.closes_on)} color="teal" />}
            </Stack>
          </Panel>
        );
      })}
    </>
  );
}

// ---------- цели ----------

function GoalsBlock({ goals, month }: { goals: SavingsGoal[]; month: string }) {
  const list = goals.filter((goal) => !goal.loan_id);
  return (
    <Panel title="Цели" subtitle="Отложено по фактам; срок против прогноза" actions={<Button size="xs" variant="subtle" onClick={go('#goals')}>Все →</Button>}>
      {list.length === 0 ? (
        <Text size="sm" c="dimmed">
          Целей пока нет
        </Text>
      ) : (
        <Stack gap="md">
          {list.map((goal) => {
            const target = Number(goal.target_amount);
            const saved = Number(goal.saved);
            const thisMonth = saved - Number(goal.saved_before_month);
            const waits = goal.start_date && goal.start_date.slice(0, 7) > month;
            const late = Boolean(goal.deadline && goal.eta && goal.eta > goal.deadline.slice(0, 7));
            return (
              <Stack key={goal.id} gap={4}>
                <Group justify="space-between">
                  <Text size="sm" fw={700}>
                    {goal.name}
                  </Text>
                  <Text size="sm">
                    {rub(saved)}{' '}
                    <Text span c="dimmed">
                      / {rub(target)}
                    </Text>
                  </Text>
                </Group>
                <Progress value={Math.min((saved / target) * 100, 100)} size="sm" radius="xl" color={saved >= target ? 'teal' : 'brand'} striped={goal.projected} />
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    {waits ? `старт ${date(goal.start_date!)}` : goal.projected ? 'прогноз к 1-му числу' : `в этом месяце внесено ${rub(thisMonth)}`}
                  </Text>
                  {saved >= target ? (
                    <Badge size="sm" color="teal" variant="light">
                      достигнута
                    </Badge>
                  ) : goal.eta ? (
                    <Badge size="sm" color={late ? 'red' : 'teal'} variant="light">
                      {goal.deadline ? (late ? 'отстаёшь' : 'успеваешь') : 'соберёшь'}: {monthTitle(goal.eta).toLowerCase()}
                    </Badge>
                  ) : null}
                </Group>
              </Stack>
            );
          })}
        </Stack>
      )}
    </Panel>
  );
}

// ---------- ближайшее ----------

function Upcoming({ today, events }: { today: string; events: BalanceView['events'] }) {
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
            <Text size="sm" fw={600} c={Number(event.amount) > 0 ? 'teal' : undefined}>
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
