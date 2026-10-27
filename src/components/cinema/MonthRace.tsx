import { Group, SimpleGrid, Slider, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { BalanceView, ExpenseCategory, ExpenseOperation, MonthReport } from '../../api/types';
import { groupLimit } from '../../lib/limits';

// «Разгон месяца»: как замер разгона — все кривые нарастающим итогом по дням месяца,
// прогноз пунктиром на весь месяц, факт сплошной до дня последней выписки.

/** Линия графика: ключ (поля `${key}Plan` и `${key}Fact` в точке), подпись, цвет; ступеньки или плавно. */
export interface RaceMetric {
  key: string;
  name: string;
  color: string;
  step: boolean;
  /** Меньше плана — хорошо (траты). */
  lowerIsBetter?: boolean;
}

/** «Кино»: доход, расход, цели, экономия. */
export const CINEMA_METRICS: RaceMetric[] = [
  { key: 'income', name: 'Доход', color: '#2ee6d6', step: true },
  { key: 'expense', name: 'Расход', color: '#ff4d5e', step: false, lowerIsBetter: true },
  { key: 'goals', name: 'Цели', color: '#b38cff', step: true },
  { key: 'economy', name: 'Экономия', color: '#9cff6b', step: false },
];

/** «Расходы»: группы трат. */
export const GROUP_METRICS: RaceMetric[] = [
  { key: 'mandatory', name: 'Обязательные', color: '#ffb547', step: false, lowerIsBetter: true },
  { key: 'managed', name: 'Управляемые', color: '#2ee6d6', step: false, lowerIsBetter: true },
  { key: 'unmanaged', name: 'Неуправляемые', color: '#b38cff', step: false, lowerIsBetter: true },
  { key: 'purchases', name: 'Покупки', color: '#ff7ab6', step: false, lowerIsBetter: true },
];

/** Точка дня: план и факт по каждой линии; факт после последней выписки — null (линия обрывается). */
export type RacePoint = { day: number } & Record<string, number | null>;

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
 * Цели: взносы в дни выплат. Экономия: «Свободно» прогноза (unallocated) раскладывается по дням;
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

/** Группа трат каждой категории месяца (id категории верхнего уровня → код группы). */
function groupOfCategory(report: MonthReport): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of report.groups) for (const category of group.categories) map.set(category.id, group.code);
  return map;
}

/**
 * «Расходы»: траты групп нарастающим итогом.
 * План: обязательные — ступеньки по датам платежей, не выше прогноза, остаток ровно по дням;
 * остальные группы — их граница ровно по дням. Факт — как «Расходы» месяца: по категории «ушло − вернулось», не меньше нуля.
 */
export function buildGroupRace(report: MonthReport, balance: BalanceView, operations: ExpenseOperation[], categories: ExpenseCategory[]): RacePoint[] {
  const [year, month] = balance.month.split('-').map(Number);
  const days = new Date(year, month, 0).getDate();
  const dayOf = (iso: string) => Number(iso.slice(8, 10));
  const until = factUntil(balance, days);
  const topOf = tops(categories);
  const groupOf = groupOfCategory(report);
  const codes = GROUP_METRICS.map((metric) => metric.key);

  const mandatorySteps = new Array<number>(days + 1).fill(0);
  for (const event of balance.events) {
    const amount = Number(event.amount);
    if (amount < 0 && !event.label.startsWith('Цель:')) mandatorySteps[dayOf(event.day)] -= amount;
  }
  const mandatoryTotal = Number(report.forecast.mandatory);
  const stepsTotal = mandatorySteps.reduce((sum, value) => sum + value, 0);
  const mandatoryPerDay = Math.max(mandatoryTotal - stepsTotal, 0) / days;
  const perDay = new Map(report.groups.map((group) => [group.code as string, (groupLimit(group) ?? 0) / days]));

  const spentByDay: Map<string, number>[] = Array.from({ length: days + 1 }, () => new Map());
  for (const op of operations) {
    const top = op.category_id ? topOf.get(op.category_id) : undefined;
    if (!top || !groupOf.has(top.id)) continue;
    const day = dayOf(op.operated_at);
    spentByDay[day].set(top.id, (spentByDay[day].get(top.id) ?? 0) - Number(op.amount));
  }

  const points: RacePoint[] = [];
  const soFar = new Map<string, number>();
  let steps = 0;
  for (let day = 1; day <= days; day += 1) {
    steps += mandatorySteps[day];
    for (const [id, value] of spentByDay[day]) soFar.set(id, (soFar.get(id) ?? 0) + value);
    const fact = new Map<string, number>(codes.map((code) => [code, 0]));
    for (const [id, value] of soFar) {
      const code = groupOf.get(id)!;
      if (fact.has(code)) fact.set(code, fact.get(code)! + Math.max(value, 0));
    }
    const known = day <= until;
    const point: RacePoint = { day };
    for (const code of codes) {
      point[`${code}Plan`] = code === 'mandatory' ? Math.min(steps, mandatoryTotal) + mandatoryPerDay * day : (perDay.get(code) ?? 0) * day;
      point[`${code}Fact`] = known ? fact.get(code)! : null;
    }
    points.push(point);
  }
  return points;
}

const rub = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`;
const thousands = (value: number) => (Math.abs(value) >= 1000 ? `${Math.round(value / 1000).toLocaleString('ru-RU')} тыс` : String(Math.round(value)));

const OF_MONTH = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const GOOD = '#2fb344';
const BAD = '#ff4d5e';

/** Карточка метрики на выбранный день: план, факт и разница (зелёная — лучше плана). */
function DayCard({ metric, point }: { metric: RaceMetric; point: RacePoint }) {
  const plan = point[`${metric.key}Plan`] ?? 0;
  const fact = point[`${metric.key}Fact`] ?? null;
  const diff = fact === null ? null : fact - plan;
  // Траты: лучше — когда меньше плана; остальное — когда больше.
  const good = diff !== null && (metric.lowerIsBetter ? diff <= 0 : diff >= 0);
  return (
    <div style={{ borderLeft: `3px solid ${metric.color}`, padding: '4px 10px', background: 'var(--race-card, var(--mantine-color-default-hover))', borderRadius: 4 }}>
      <Text size="sm" fw={700} style={{ color: metric.color }}>
        {metric.name}
      </Text>
      <Text size="xs" c="dimmed">
        план <span style={{ color: 'var(--race-text, var(--mantine-color-text))' }}>{rub(plan)}</span>
      </Text>
      <Text size="xs" c="dimmed">
        факт <span style={{ color: 'var(--race-text, var(--mantine-color-text))' }}>{fact === null ? 'нет выписки' : rub(fact)}</span>
      </Text>
      {diff !== null && (
        <Text size="xs" fw={700} style={{ color: good ? GOOD : BAD }}>
          {diff >= 0 ? '+' : '−'}
          {rub(Math.abs(diff))}
        </Text>
      )}
    </div>
  );
}

export function MonthRace({
  points,
  month,
  today,
  run,
  animate,
  height = 420,
  metrics = CINEMA_METRICS,
}: {
  metrics?: RaceMetric[];
  points: RacePoint[];
  month: string;
  today: number | null;
  run: boolean;
  animate: boolean;
  /** Высота графика: число (px) или CSS-выражение. */
  height?: number | string;
}) {
  const ofMonth = OF_MONTH[Number(month.slice(5, 7)) - 1];
  const last = points.length;
  const lastFact = points.reduce((max, point) => (metrics.some((metric) => point[`${metric.key}Fact`] != null) ? point.day : max), 0);
  // День по умолчанию: сегодня, у прошедшего месяца — последний день. Новый месяц — сброс.
  const [day, setDay] = useState(today ?? last);
  useEffect(() => setDay(today ?? last), [month, today, last]);
  const point = points[Math.min(Math.max(day, 1), last) - 1];

  return (
    <Stack gap={8}>
      <Group gap="lg">
        {metrics.map((metric) => (
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
            <LineChart
              data={points}
              margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
              onClick={(state) => state?.activeLabel !== undefined && setDay(Number(state.activeLabel))}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="day" stroke="#6b7685" tick={{ fontSize: 12 }} tickLine={false} interval="preserveStartEnd" />
              <YAxis stroke="#6b7685" tick={{ fontSize: 12 }} tickLine={false} tickFormatter={thousands} width={64} />
              {/* Подсказки нет — всё под графиком; Tooltip нужен, чтобы клик знал день. */}
              <Tooltip content={() => null} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
              {today !== null && today !== day && <ReferenceLine x={today} stroke="#ffb547" strokeOpacity={0.5} strokeDasharray="2 4" />}
              <ReferenceLine x={day} stroke="#ffffff" strokeWidth={1.5} strokeOpacity={0.8} />
              {metrics.map((metric) => (
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
              {metrics.map((metric) => (
                <Line
                  key={`${metric.key}Fact`}
                  dataKey={`${metric.key}Fact`}
                  type={metric.step ? 'stepAfter' : 'linear'}
                  stroke={metric.color}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={false}
                  style={{ filter: `drop-shadow(0 0 4px ${metric.color})` }}
                  isAnimationActive={animate}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <Slider
        value={day}
        onChange={setDay}
        min={1}
        max={last}
        step={1}
        color="cyan"
        label={(value) => `${value} ${ofMonth}`}
        marks={[{ value: 1, label: '1' }, ...(today !== null ? [{ value: today, label: 'сегодня' }] : []), { value: last, label: String(last) }]}
        mx={72}
        mb={18}
        styles={{ markLabel: { color: '#6b7685', fontSize: 11 } }}
        aria-label="День месяца"
      />
      <Text size="sm" fw={700}>
        {point.day} {ofMonth}
        <Text span size="xs" c="dimmed" fw={400}>
          {' · '}
          {lastFact === 0 ? 'выписки за месяц нет' : `факт по выписке до ${lastFact} ${ofMonth}`}
        </Text>
      </Text>
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
        {metrics.map((metric) => (
          <DayCard key={metric.key} metric={metric} point={point} />
        ))}
      </SimpleGrid>
    </Stack>
  );
}
