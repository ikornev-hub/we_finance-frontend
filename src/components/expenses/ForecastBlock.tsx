import { LineChart } from '@mantine/charts';
import { Badge, Button, Group, ScrollArea, Stack, Table, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowDownRight, IconArrowRight, IconArrowUpRight } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

import { expensesApi } from '../../api/endpoints';
import type { MonthReport, SavingsGoal, SpendingAnalysis } from '../../api/types';
import { useOrSample } from '../../lib/sample';
import { Panel } from '../Cards';
import { errorText } from '../ErrorAlert';
import { monthTitle, shiftMonth, useSelectedMonth } from './common';

// Прогноз на 3 месяца по месяцам (Решение 2026-10-27):
// - траты по категориям — медиана последних 6 полных месяцев выписки;
// - обязательные с планом — план месяца: кредит по графику + ЧДП из цели «закрыть кредит», жильё по правилу;
// - цели — план взноса месяца (с прогнозом накоплений);
// - итог: доход − траты − цели = сколько останется.
// «Растёт / падает» — медиана последних 3 полных месяцев против предыдущих; на прогноз не влияет.

const HORIZON = 3;
const GROWTH = 0.15;
const NOISE = 1000; // меньше тысячи в месяц — динамику не считаем: копейки дают ±100 %
const SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const short = (month: string) => `${SHORT[Number(month.slice(5, 7)) - 1]} ${month.slice(2, 4)}`;
const rub = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`;
const GROUP_NAME: Record<string, string> = {
  mandatory: 'Обязательные',
  managed: 'Управляемые',
  unmanaged: 'Неуправляемые',
  purchases: 'Покупки',
  goals: 'Цели',
};
const LIMITED = new Set(['managed', 'unmanaged', 'purchases']);

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

interface Future {
  month: string;
  report: MonthReport;
  goals: SavingsGoal[];
}

interface Row {
  id: string;
  name: string;
  group: string;
  values: number[]; // по месяцам горизонта
  hints: (string | null)[]; // из чего сложилось (кредит: график + ЧДП)
  median: number;
  low: number;
  high: number;
  trend: number | null; // доля роста: 0.2 — +20 %
  live: number | null; // текущий месяц к концу — по темпу
  target: number | null;
  past: boolean; // есть факт за прошлые месяцы
}

export function ForecastBlock() {
  const [current] = useSelectedMonth();
  const months = useMemo(() => Array.from({ length: HORIZON }, (_, index) => shiftMonth(current, index + 1)), [current]);
  const data = useOrSample(
    () => expensesApi.analysis(shiftMonth(current, -6), current),
    { months: [], stats: [], pace: null, full_months: [] } as SpendingAnalysis,
    `forecast/${current}`,
  );
  const [future, setFuture] = useState<Future[] | null>(null);
  const [tick, setTick] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(months.map((month) => Promise.all([expensesApi.month(month), expensesApi.goals(month)]).then(([report, goals]) => ({ month, report, goals }))))
      .then(setFuture)
      .catch(() => setFuture(null));
  }, [months, tick]);

  const rows = useMemo<Row[]>(() => {
    const analysis = data.data;
    if (!analysis || !future) return [];
    const full = analysis.months.filter((month) => analysis.full_months.includes(month.month));
    const first = future[0].report;
    const targets = new Map(first.categories.map((category) => [category.id, category.target === null ? null : Number(category.target)]));
    const codes = new Map(first.categories.map((category) => [category.id, category.system_code]));
    const pace = new Map((analysis.pace?.categories ?? []).map((item) => [item.id, Number(item.projected)]));

    const spending: Row[] = analysis.stats
      .filter((stat) => stat.kind === 'category' && stat.group_code !== 'service' && Number(stat.max) > 0)
      .map((stat) => {
        const history = full.map((month) => Number(month.categories[stat.id] ?? 0));
        const typical = Number(stat.median);
        const recent = median(history.slice(-3));
        const before = history.length >= 5 ? median(history.slice(-6, -3)) : null;
        const hints: (string | null)[] = [];
        const values = future.map(({ report, goals }) => {
          if (stat.group_code !== 'mandatory') {
            hints.push(null);
            return typical;
          }
          const planned = Number(report.forecast.mandatory_by_category[stat.id] ?? 0);
          if (codes.get(stat.id) === 'credit') {
            const prepay = goals.filter((goal) => goal.loan_id).reduce((sum, goal) => sum + Number(goal.plan), 0);
            hints.push(`по графику ${rub(planned)}${prepay ? ` + ЧДП ${rub(prepay)}` : ''}`);
            return planned + prepay;
          }
          hints.push(planned > 0 ? 'по плану' : null);
          return planned > 0 ? planned : typical;
        });
        return {
          id: stat.id,
          name: stat.name,
          group: stat.group_code,
          values,
          hints,
          median: typical,
          low: history.length ? Math.min(...history) : 0,
          high: history.length ? Math.max(...history) : 0,
          trend: before && before > 0 && Math.max(recent, before) >= NOISE ? recent / before - 1 : null,
          live: pace.get(stat.id) ?? null,
          target: targets.get(stat.id) ?? null,
          past: true,
        };
      });

    // цели (кроме кредитных — их ЧДП уже в «Кредите»)
    const goals: Row[] = future[0].goals
      .filter((goal) => !goal.loan_id)
      .map((goal) => ({
        id: goal.id,
        name: goal.name,
        group: 'goals',
        values: future.map((month) => Number(month.goals.find((item) => item.id === goal.id)?.plan ?? 0)),
        hints: future.map(() => null),
        median: 0,
        low: 0,
        high: 0,
        trend: null,
        live: null,
        target: null,
        past: false,
      }));
    const total = (row: Row) => row.values.reduce((sum, value) => sum + value, 0);
    return [...spending.sort((a, b) => total(b) - total(a)), ...goals];
  }, [data.data, future]);

  useEffect(() => {
    if (!picked && rows.length) setPicked((rows.find((row) => LIMITED.has(row.group)) ?? rows[0]).id);
  }, [rows, picked]);

  const analysis = data.data;
  if (!analysis || !future || !rows.length) return null;
  const fullCount = analysis.full_months.length;
  const row = rows.find((item) => item.id === picked) ?? rows[0];

  // итоги по месяцам
  const sumOf = (filter: (item: Row) => boolean, index: number) => rows.filter(filter).reduce((sum, item) => sum + item.values[index], 0);
  const totals = future.map(({ report }, index) => {
    const income = Number(report.forecast.income);
    const spent = sumOf((item) => item.group !== 'goals', index);
    const goals = sumOf((item) => item.group === 'goals', index);
    return { income, spent, goals, left: income - spent - goals };
  });

  // график: факт за полные месяцы, текущий — по темпу, дальше — пунктир прогноза и граница
  const chart = [
    ...(row.past
      ? analysis.months
          .filter((month) => month.month === current || analysis.full_months.includes(month.month))
          .map((month) => {
            const isCurrent = month.month === current;
            const fact = Number(month.categories[row.id] ?? 0);
            return {
              month: short(month.month),
              Факт: isCurrent ? undefined : fact,
              Прогноз: isCurrent ? (row.live ?? row.values[0]) : month.month === analysis.full_months.at(-1) ? fact : undefined,
              Граница: row.target ?? undefined,
            };
          })
      : []),
    ...months.map((month, index) => ({ month: short(month), Факт: undefined, Прогноз: row.values[index], Граница: row.target ?? undefined })),
  ];

  const toLimit = async (item: Row) => {
    const amount = Math.ceil(item.median / 100) * 100;
    setBusy(item.id);
    try {
      await expensesApi.updateCategory(item.id, { target_amount: amount.toFixed(2), target_share: null });
      notifications.show({ color: 'teal', title: `${item.name}: граница ${rub(amount)}`, message: 'Подтянута к прогнозу' });
      setTick((value) => value + 1);
    } catch (error) {
      notifications.show({ color: 'red', title: 'Не сохранилось', message: errorText(error) });
    } finally {
      setBusy(null);
    }
  };

  const cols = 5 + HORIZON;
  return (
    <Panel
      title={`Прогноз на ${HORIZON} месяца`}
      subtitle={`Траты — медиана ${fullCount} полных месяцев выписки; кредит — по графику + ЧДП из цели; жильё — по правилу; цели — план взноса. Нажми на строку — график покажет её.`}
    >
      <Stack gap="md">
        <div>
          <Text fw={600}>{row.name}</Text>
          <Text size="xs" c="dimmed">
            {row.past ? `обычно ${rub(row.low)} – ${rub(row.high)} в месяц` : 'план взноса цели'}
            {row.hints.some(Boolean) ? ` · ${row.hints.map((hint, index) => (hint ? `${short(months[index])}: ${hint}` : '')).filter(Boolean).join('; ')}` : ''}
            {row.target !== null ? ` · граница ${rub(row.target)}` : ''}
          </Text>
        </div>
        <LineChart
          h={240}
          data={chart}
          dataKey="month"
          series={[
            ...(row.past ? [{ name: 'Факт', color: 'brand.6' }] : []),
            { name: 'Прогноз', color: 'blue.5', strokeDasharray: '6 4' },
            ...(row.target !== null ? [{ name: 'Граница', color: 'gray.6', strokeDasharray: '2 4' }] : []),
          ]}
          valueFormatter={(value) => rub(value)}
          connectNulls={false}
          withLegend
          curveType="linear"
          gridAxis="y"
        />

        <ScrollArea>
          <Table verticalSpacing={6} highlightOnHover miw={980}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Статья</Table.Th>
                <Table.Th ta="right">{SHORT[Number(current.slice(5, 7)) - 1]}: к концу</Table.Th>
                {months.map((month) => (
                  <Table.Th key={month} ta="right">
                    {monthTitle(month).split(' ')[0]}
                  </Table.Th>
                ))}
                <Table.Th ta="right">Граница</Table.Th>
                <Table.Th>Динамика</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {['mandatory', 'managed', 'unmanaged', 'purchases', 'goals'].flatMap((code) => {
                const items = rows.filter((item) => item.group === code);
                if (!items.length) return [];
                return [
                  <Table.Tr key={code}>
                    <Table.Td colSpan={cols}>
                      <Text size="xs" c="dimmed" fw={700}>
                        {GROUP_NAME[code]}
                      </Text>
                    </Table.Td>
                  </Table.Tr>,
                  ...items.map((item) => {
                    const peak = Math.max(...item.values);
                    const over = item.target !== null && peak > item.target;
                    const grows = item.trend !== null && item.trend > GROWTH;
                    const falls = item.trend !== null && item.trend < -GROWTH;
                    return (
                      <Table.Tr
                        key={item.id}
                        onClick={() => setPicked(item.id)}
                        style={{ cursor: 'pointer' }}
                        bg={item.id === row.id ? 'var(--mantine-color-default-hover)' : undefined}
                      >
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {item.name}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                          <Text size="sm" c={item.live !== null && item.target !== null && item.live > item.target ? 'red' : 'dimmed'}>
                            {item.live !== null ? rub(item.live) : '—'}
                          </Text>
                        </Table.Td>
                        {item.values.map((value, index) => (
                          <Table.Td key={months[index]} ta="right" style={{ whiteSpace: 'nowrap' }}>
                            <Tooltip label={item.hints[index] ?? ''} disabled={!item.hints[index]}>
                              <Text size="sm" fw={600} c={item.target !== null && value > item.target ? 'red' : undefined}>
                                {rub(value)}
                              </Text>
                            </Tooltip>
                          </Table.Td>
                        ))}
                        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                          <Text size="sm" c="dimmed">
                            {item.target !== null ? rub(item.target) : '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={6} wrap="nowrap">
                            {item.group === 'goals' ? null : item.trend === null ? (
                              <Text size="xs" c="dimmed">
                                {item.median < NOISE ? 'мелочь' : 'мало месяцев'}
                              </Text>
                            ) : (
                              <Tooltip label="Медиана последних 3 полных месяцев против предыдущих">
                                <Badge
                                  variant="light"
                                  radius="sm"
                                  color={grows ? 'orange' : falls ? 'teal' : 'gray'}
                                  leftSection={grows ? <IconArrowUpRight size={12} /> : falls ? <IconArrowDownRight size={12} /> : <IconArrowRight size={12} />}
                                >
                                  {grows ? 'растёт' : falls ? 'падает' : 'ровно'} {item.trend > 0 ? '+' : ''}
                                  {Math.round(item.trend * 100)} %
                                </Badge>
                              </Tooltip>
                            )}
                            {item.target !== null && (
                              <Badge variant="light" radius="sm" color={over ? 'red' : 'teal'}>
                                {over ? `перебор ${rub(peak - item.target)}` : `запас ${rub(item.target - peak)}`}
                              </Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td ta="right">
                          {LIMITED.has(item.group) && Math.ceil(item.median / 100) * 100 !== item.target && item.median > 0 && (
                            <Button
                              size="compact-xs"
                              variant="subtle"
                              loading={busy === item.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                void toLimit(item);
                              }}
                            >
                              граница = прогноз
                            </Button>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  }),
                ];
              })}

              {(
                [
                  ['Доход', (index: number) => totals[index].income, undefined],
                  ['Траты', (index: number) => -totals[index].spent, undefined],
                  ['Цели', (index: number) => -totals[index].goals, undefined],
                  ['Останется', (index: number) => totals[index].left, true],
                ] as const
              ).map(([label, value, strong]) => (
                <Table.Tr key={label} bg={strong ? 'var(--mantine-color-default-hover)' : undefined}>
                  <Table.Td>
                    <Text size="sm" fw={strong ? 700 : 600}>
                      {label}
                    </Text>
                  </Table.Td>
                  <Table.Td />
                  {months.map((month, index) => (
                    <Table.Td key={month} ta="right" style={{ whiteSpace: 'nowrap' }}>
                      <Text size="sm" fw={strong ? 700 : 600} c={strong ? (value(index) < 0 ? 'red' : 'teal') : undefined}>
                        {rub(value(index))}
                      </Text>
                    </Table.Td>
                  ))}
                  <Table.Td colSpan={3} />
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Stack>
    </Panel>
  );
}
