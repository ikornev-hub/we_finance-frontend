import { Group, Stack, Text } from '@mantine/core';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { BalanceView, ExpenseCategory, ExpenseOperation, MonthReport } from '../../api/types';

// «Разгон месяца»: как замер разгона — все кривые нарастающим итогом по дням месяца,
// прогноз пунктиром на весь месяц, факт сплошной до дня последней выписки.

type Metric = 'income' | 'expense' | 'goals' | 'economy';

const METRICS: { key: Metric; name: string; color: string; step: boolean }[] = [
  { key: 'income', name: 'Доход', color: '#2ee6d6', step: true },
  { key: 'expense', name: 'Расход', color: '#ff4d5e', step: false },
  { key: 'goals', name: 'Цели', color: '#b38cff', step: true },
  { key: 'economy', name: 'Экономия', color: '#9cff6b', step: false },
];

/** Точка дня: план и факт по каждой метрике; факт после последней выписки — null (линия обрывается). */
export type RacePoint = { day: number } & Record<`${Metric}Plan`, number> & Record<`${Metric}Fact`, number | null>;

const NOT_SPENDING = new Set(['income', 'savings', 'own_transfer']);

/** Категория (или подкатегория) → верхний уровень: id и system_code ('' — обычная категория трат). */
function tops(categories: ExpenseCategory[]): Map<string, { id: string; code: string }> {
  const map = new Map<string, { id: string; code: string }>();
  for (const top of categories) {
    const item = { id: top.id, code: top.system_code ?? '' };
    map.set(top.id, item);
    for (const child of top.children) map.set(child.id, item);
  }
  return map;
}

/** По какой день месяца есть факт: 0 — выписки за месяц нет. */
function factUntil(balance: BalanceView, days: number): number {
  const until = balance.statement_until;
  if (!until || until < `${balance.month}-01`) return 0;
  return until.slice(0, 7) > balance.month ? days : Number(until.slice(8, 10));
}

/**
 * Кривые месяца нарастающим итогом.
 * Доход стартует с остатка на начало месяца (что осталось с прошлого) и растёт ступеньками в дни выплат.
 * Расход: обязательные — ступеньки в свои даты, траты по границам — ровно по дням (как ожидание остатка в API);
 * на последний день — «обязательные + границы» прогноза.
 * Цели: взносы в дни выплат. Экономия: «не распределено» прогноза раскладывается по дням;
 * факт — та же линия плюс недотрата (минус перерасход) на этот день.
 */
export function buildRace(report: MonthReport, balance: BalanceView, operations: ExpenseOperation[], categories: ExpenseCategory[]): RacePoint[] {
  const [year, month] = balance.month.split('-').map(Number);
  const days = new Date(year, month, 0).getDate();
  const dayOf = (iso: string) => Number(iso.slice(8, 10));
  const start = Number(balance.start_balance ?? 0);
  const perDay = Number(balance.spending) / days;
  const economy = Number(report.forecast.unallocated);
  const until = factUntil(balance, days);
  const topOf = tops(categories);

  const plan = { income: new Array<number>(days + 1).fill(0), mandatory: new Array<number>(days + 1).fill(0), goals: new Array<number>(days + 1).fill(0) };
  for (const event of balance.events) {
    const amount = Number(event.amount);
    const day = dayOf(event.day);
    if (amount > 0) plan.income[day] += amount;
    else if (event.label.startsWith('Цель:')) plan.goals[day] -= amount;
    else plan.mandatory[day] -= amount;
  }
  const fact = { income: new Array<number>(days + 1).fill(0), goals: new Array<number>(days + 1).fill(0) };
  // Траты по дням и категориям: «Расходы» месяца — по каждой категории верхнего уровня
  // (с подкатегориями) «ушло − вернулось», не меньше нуля.
  const spentByDay: Map<string, number>[] = Array.from({ length: days + 1 }, () => new Map());
  for (const op of operations) {
    const top = op.category_id ? topOf.get(op.category_id) : undefined;
    if (!top) continue;
    const amount = Number(op.amount);
    const day = dayOf(op.operated_at);
    if (top.code === 'income') fact.income[day] += amount;
    else if (top.code === 'savings') fact.goals[day] -= amount;
    else if (!NOT_SPENDING.has(top.code)) spentByDay[day].set(top.id, (spentByDay[day].get(top.id) ?? 0) - amount);
  }
  const spentSoFar = new Map<string, number>();
  // Обязательные прогноза — по каждой категории больше из плана и факта, поэтому сумма событий с ним
  // не совпадает: ступеньки — по событиям, но не выше прогноза; не хватает — остаток ровно по дням.
  const mandatoryTotal = Number(report.forecast.mandatory);
  const eventsTotal = plan.mandatory.reduce((sum, value) => sum + value, 0);
  const mandatoryPerDay = Math.max(mandatoryTotal - eventsTotal, 0) / days;

  const points: RacePoint[] = [];
  let pIncome = start;
  let pMandatory = 0;
  let pGoals = 0;
  let fIncome = start;
  let fGoals = 0;
  for (let day = 1; day <= days; day += 1) {
    pIncome += plan.income[day];
    pMandatory += plan.mandatory[day];
    pGoals += plan.goals[day];
    fIncome += fact.income[day];
    fGoals += fact.goals[day];
    for (const [id, value] of spentByDay[day]) spentSoFar.set(id, (spentSoFar.get(id) ?? 0) + value);
    const fExpense = [...spentSoFar.values()].reduce((sum, value) => sum + Math.max(value, 0), 0);
    const pExpense = Math.min(pMandatory, mandatoryTotal) + mandatoryPerDay * day + perDay * day;
    const pEconomy = (economy * day) / days;
    const known = day <= until;
    points.push({
      day,
      incomePlan: pIncome,
      expensePlan: pExpense,
      goalsPlan: pGoals,
      economyPlan: pEconomy,
      incomeFact: known ? fIncome : null,
      expenseFact: known ? fExpense : null,
      goalsFact: known ? fGoals : null,
      economyFact: known ? pEconomy + pExpense - fExpense : null,
    });
  }
  return points;
}

const rub = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`;
const thousands = (value: number) => (Math.abs(value) >= 1000 ? `${Math.round(value / 1000).toLocaleString('ru-RU')} тыс` : String(Math.round(value)));

function RaceTooltip({ active, payload, label, month }: { active?: boolean; payload?: { payload: RacePoint }[]; label?: number; month: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div style={{ background: 'rgba(8, 12, 20, 0.92)', border: '1px solid #2a3442', borderRadius: 8, padding: '8px 12px' }}>
      <Text size="sm" fw={700} mb={4}>
        {label} {month}
      </Text>
      {METRICS.map((metric) => {
        const plan = point[`${metric.key}Plan`];
        const fact = point[`${metric.key}Fact`];
        return (
          <Text key={metric.key} size="xs" style={{ color: metric.color, whiteSpace: 'nowrap' }}>
            {metric.name}: план {rub(plan)}
            {fact !== null && ` · факт ${rub(fact)} · ${fact - plan >= 0 ? '+' : '−'}${rub(Math.abs(fact - plan))}`}
          </Text>
        );
      })}
    </div>
  );
}

const OF_MONTH = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function MonthRace({
  points,
  month,
  today,
  run,
  animate,
  height = 420,
}: {
  points: RacePoint[];
  month: string;
  today: number | null;
  run: boolean;
  animate: boolean;
  /** Высота графика: число (px) или CSS-выражение. */
  height?: number | string;
}) {
  const ofMonth = OF_MONTH[Number(month.slice(5, 7)) - 1];
  return (
    <Stack gap="sm">
      <Group gap="lg">
        {METRICS.map((metric) => (
          <Group key={metric.key} gap={6}>
            <span style={{ width: 18, height: 3, background: metric.color, boxShadow: `0 0 8px ${metric.color}` }} />
            <Text size="sm">{metric.name}</Text>
          </Group>
        ))}
        <Text size="sm" c="dimmed">
          пунктир — прогноз, линия — факт по выписке
        </Text>
      </Group>
      <div style={{ width: '100%', height }}>
        {run && (
          <ResponsiveContainer>
            <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="day" stroke="#6b7685" tick={{ fontSize: 12 }} tickLine={false} interval="preserveStartEnd" />
              <YAxis stroke="#6b7685" tick={{ fontSize: 12 }} tickLine={false} tickFormatter={thousands} width={64} />
              <Tooltip content={<RaceTooltip month={ofMonth} />} cursor={{ stroke: 'rgba(255,255,255,0.25)' }} />
              {today !== null && <ReferenceLine x={today} stroke="#ffb547" strokeDasharray="2 4" label={{ value: 'сегодня', fill: '#ffb547', fontSize: 12, position: 'insideTopRight' }} />}
              {METRICS.map((metric) => (
                <Line
                  key={`${metric.key}Plan`}
                  dataKey={`${metric.key}Plan`}
                  type={metric.step ? 'stepAfter' : 'linear'}
                  stroke={metric.color}
                  strokeOpacity={0.55}
                  strokeWidth={1.5}
                  strokeDasharray="6 5"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={animate}
                />
              ))}
              {METRICS.map((metric) => (
                <Line
                  key={`${metric.key}Fact`}
                  dataKey={`${metric.key}Fact`}
                  type={metric.step ? 'stepAfter' : 'linear'}
                  stroke={metric.color}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                  style={{ filter: `drop-shadow(0 0 4px ${metric.color})` }}
                  isAnimationActive={animate}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Stack>
  );
}
