import { LineChart } from '@mantine/charts';
import { Badge, Button, Group, ScrollArea, Stack, Table, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowDownRight, IconArrowRight, IconArrowUpRight } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

import { expensesApi } from '../../api/endpoints';
import type { AnalysisStat, MonthReport, SpendingAnalysis } from '../../api/types';
import { useOrSample } from '../../lib/sample';
import { Panel } from '../Cards';
import { errorText } from '../ErrorAlert';
import { currentMonth, monthTitle, shiftMonth } from './common';

// Прогноз трат по категориям (Решение 2026-10-27): медиана последних 6 полных месяцев выписки —
// столько же в каждом из 3 следующих месяцев. «Растёт / падает» — медиана последних 3 полных
// месяцев против предыдущих; на сам прогноз не влияет. Подсветка у всех категорий.

const HORIZON = 3;
const GROWTH = 0.15;
const NOISE = 1000; // меньше тысячи в месяц — динамику не считаем: копейки дают ±100 %
const SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const short = (month: string) => `${SHORT[Number(month.slice(5, 7)) - 1]} ${month.slice(2, 4)}`;
const rub = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`;
const GROUP_NAME: Record<string, string> = { mandatory: 'Обязательные', managed: 'Управляемые', unmanaged: 'Неуправляемые', purchases: 'Покупки' };
const LIMITED = new Set(['managed', 'unmanaged', 'purchases']);

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

interface Row {
  stat: AnalysisStat;
  forecast: number;
  low: number;
  high: number;
  trend: number | null; // доля роста: 0.2 — +20 %
  live: number | null; // текущий месяц к концу — по темпу
  target: number | null;
}

export function ForecastBlock() {
  const current = currentMonth();
  const next = shiftMonth(current, 1);
  const data = useOrSample(
    () => expensesApi.analysis(shiftMonth(current, -6), current),
    { months: [], stats: [], pace: null, full_months: [] } as SpendingAnalysis,
    `forecast/${current}`,
  );
  const limits = useOrSample(() => expensesApi.month(next), null as unknown as MonthReport, `forecast-limits/${next}`);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo<Row[]>(() => {
    const analysis = data.data;
    if (!analysis) return [];
    const full = analysis.months.filter((month) => analysis.full_months.includes(month.month));
    const targets = new Map((limits.data?.categories ?? []).map((category) => [category.id, category.target === null ? null : Number(category.target)]));
    const pace = new Map((analysis.pace?.categories ?? []).map((item) => [item.id, Number(item.projected)]));
    return analysis.stats
      .filter((stat) => stat.kind === 'category' && stat.group_code !== 'service' && Number(stat.max) > 0)
      .map((stat) => {
        const values = full.map((month) => Number(month.categories[stat.id] ?? 0));
        const recent = median(values.slice(-3));
        const before = values.length >= 5 ? median(values.slice(-6, -3)) : null;
        return {
          stat,
          forecast: Number(stat.median),
          low: values.length ? Math.min(...values) : 0,
          high: values.length ? Math.max(...values) : 0,
          trend: before && before > 0 && Math.max(recent, before) >= NOISE ? recent / before - 1 : null,
          live: pace.get(stat.id) ?? null,
          target: targets.get(stat.id) ?? null,
        };
      })
      .sort((a, b) => b.forecast - a.forecast);
  }, [data.data, limits.data]);

  useEffect(() => {
    if (!picked && rows.length) setPicked((rows.find((row) => LIMITED.has(row.stat.group_code)) ?? rows[0]).stat.id);
  }, [rows, picked]);

  const analysis = data.data;
  if (!analysis || !rows.length) return null;
  const fullCount = analysis.full_months.length;
  const row = rows.find((item) => item.stat.id === picked) ?? rows[0];

  // график: факт по месяцам (текущий — по темпу), дальше — пунктир прогноза и граница
  const chart = [
    ...analysis.months
      .filter((month) => month.month === current || analysis.full_months.includes(month.month))
      .map((month) => {
        const isCurrent = month.month === current;
        const fact = Number(month.categories[row.stat.id] ?? 0);
        return {
          month: short(month.month),
          Факт: isCurrent ? undefined : fact,
          // пунктир начинается от последнего полного месяца
          Прогноз: isCurrent ? (row.live ?? row.forecast) : month.month === analysis.full_months.at(-1) ? fact : undefined,
          Граница: row.target ?? undefined,
        };
      }),
    ...Array.from({ length: HORIZON }, (_, index) => ({
      month: short(shiftMonth(current, index + 1)),
      Факт: undefined,
      Прогноз: row.forecast,
      Граница: row.target ?? undefined,
    })),
  ];

  const toLimit = async (item: Row) => {
    const amount = Math.ceil(item.forecast / 100) * 100;
    setBusy(item.stat.id);
    try {
      await expensesApi.updateCategory(item.stat.id, { target_amount: amount.toFixed(2), target_share: null });
      notifications.show({ color: 'teal', title: `${item.stat.name}: граница ${rub(amount)}`, message: 'Подтянута к прогнозу' });
      limits.reload();
    } catch (error) {
      notifications.show({ color: 'red', title: 'Не сохранилось', message: errorText(error) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      title={`Прогноз трат на ${HORIZON} месяца`}
      subtitle={`Медиана ${fullCount} полн${fullCount === 1 ? 'ого' : 'ых'} месяц${fullCount === 1 ? 'а' : 'ев'} выписки — столько же каждый месяц вперёд. Выбери категорию — график покажет её.`}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <div>
            <Text fw={600}>{row.stat.name}</Text>
            <Text size="xs" c="dimmed">
              обычно {rub(row.low)} – {rub(row.high)} в месяц, прогноз {rub(row.forecast)}
              {row.target !== null ? `, граница ${rub(row.target)}` : ', границы нет'}
            </Text>
          </div>
        </Group>
        <LineChart
          h={240}
          data={chart}
          dataKey="month"
          series={[
            { name: 'Факт', color: 'brand.6' },
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
          <Table verticalSpacing={6} highlightOnHover miw={820}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Категория</Table.Th>
                <Table.Th ta="right">{monthTitle(current).split(' ')[0]}: к концу</Table.Th>
                <Table.Th ta="right">Прогноз в месяц</Table.Th>
                <Table.Th ta="right">За {HORIZON} мес.</Table.Th>
                <Table.Th ta="right">Граница</Table.Th>
                <Table.Th>Динамика</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {['mandatory', 'managed', 'unmanaged', 'purchases'].flatMap((code) => {
                const items = rows.filter((item) => item.stat.group_code === code);
                if (!items.length) return [];
                return [
                  <Table.Tr key={code}>
                    <Table.Td colSpan={7}>
                      <Text size="xs" c="dimmed" fw={700}>
                        {GROUP_NAME[code]} · прогноз {rub(items.reduce((sum, item) => sum + item.forecast, 0))} в месяц
                      </Text>
                    </Table.Td>
                  </Table.Tr>,
                  ...items.map((item) => {
                    const over = item.target !== null && item.forecast > item.target;
                    const grows = item.trend !== null && item.trend > GROWTH;
                    const falls = item.trend !== null && item.trend < -GROWTH;
                    return (
                      <Table.Tr
                        key={item.stat.id}
                        onClick={() => setPicked(item.stat.id)}
                        style={{ cursor: 'pointer' }}
                        bg={item.stat.id === row.stat.id ? 'var(--mantine-color-default-hover)' : undefined}
                      >
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {item.stat.name}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                          <Text size="sm" c={item.live !== null && item.target !== null && item.live > item.target ? 'red' : 'dimmed'}>
                            {item.live !== null ? rub(item.live) : '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                          <Text size="sm" fw={600} c={over ? 'red' : undefined}>
                            {rub(item.forecast)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                          <Text size="sm" c="dimmed">
                            {rub(item.forecast * HORIZON)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                          <Text size="sm" c="dimmed">
                            {item.target !== null ? rub(item.target) : '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={6} wrap="nowrap">
                            {item.trend === null ? (
                              <Text size="xs" c="dimmed">
                                {item.forecast < NOISE ? 'мелочь' : 'мало месяцев'}
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
                                {over ? `перебор ${rub(item.forecast - item.target)}` : `запас ${rub(item.target - item.forecast)}`}
                              </Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td ta="right">
                          {LIMITED.has(item.stat.group_code) && Math.ceil(item.forecast / 100) * 100 !== item.target && item.forecast > 0 && (
                            <Button
                              size="compact-xs"
                              variant="subtle"
                              loading={busy === item.stat.id}
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
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Stack>
    </Panel>
  );
}
