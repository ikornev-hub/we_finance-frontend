import { BarChart } from '@mantine/charts';
import { Badge, Group, ScrollArea, SegmentedControl, Stack, Table, Text, Tooltip } from '@mantine/core';
import { useState } from 'react';

import { expensesApi } from '../../api/endpoints';
import type { AnalysisStat, SpendingAnalysis } from '../../api/types';
import { money } from '../../lib/format';
import { useOrSample } from '../../lib/sample';
import { PageHeader, Panel } from '../Cards';
import { ErrorAlert } from '../ErrorAlert';
import { currentMonth, monthTitle, shiftMonth } from './common';

const chartMoney = (value: number) => `${value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`;
const SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const short = (month: string) => SHORT[Number(month.slice(5, 7)) - 1];

const SERIES = [
  { name: 'Обязательные', code: 'mandatory', color: 'gray.6' },
  { name: 'Управляемые', code: 'managed', color: 'brand.6' },
  { name: 'Неуправляемые', code: 'unmanaged', color: 'red.5' },
  { name: 'Покупки', code: 'purchases', color: 'violet.5' },
  { name: 'Служебные', code: 'service', color: 'yellow.5' },
];

const EMPTY: SpendingAnalysis = { months: [], stats: [], pace: null };

/** Выброс: месяц больше медианы в полтора раза и заметно по сумме. */
function spike(amount: number, stat: AnalysisStat | undefined): boolean {
  const median = Number(stat?.median ?? 0);
  return amount > 1000 && amount > median * 1.5;
}

/** Анализ трат: динамика групп и категорий, медиана и выбросы, темп текущего месяца. */
export function AnalysisSection() {
  const [period, setPeriod] = useState('6');
  const to = currentMonth();
  const from = shiftMonth(to, -(Number(period) - 1));
  const data = useOrSample(() => expensesApi.analysis(from, to), EMPTY, `${from}/${to}`);
  const analysis = data.data ?? EMPTY;

  const chart = analysis.months.map((month) => ({
    month: short(month.month),
    ...Object.fromEntries(SERIES.map((series) => [series.name, Number(month.groups[series.code] ?? 0)])),
    Отложено: Number(month.saved),
  }));
  const categoryStats = analysis.stats.filter((stat) => stat.kind === 'category' && Number(stat.max) > 0);
  const groupOrder = SERIES.map((series) => series.code);
  categoryStats.sort((a, b) => groupOrder.indexOf(a.group_code) - groupOrder.indexOf(b.group_code) || Number(b.median) - Number(a.median));

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <PageHeader title="Анализ трат" subtitle="Динамика по месяцам, медиана и выбросы, темп текущего месяца. Медиана — по полным месяцам с выпиской." />
        <SegmentedControl
          value={period}
          onChange={setPeriod}
          data={[
            { value: '3', label: '3 мес' },
            { value: '6', label: '6 мес' },
            { value: '12', label: '12 мес' },
          ]}
        />
      </Group>
      <ErrorAlert error={data.error} />

      {analysis.pace && <PaceBlock pace={analysis.pace} />}

      <Panel title="Группы по месяцам" subtitle="Сколько уходит в каждую группу; «Отложено» — на цели">
        <BarChart
          h={280}
          data={chart}
          dataKey="month"
          type="stacked"
          series={[...SERIES.map((series) => ({ name: series.name, color: series.color })), { name: 'Отложено', color: 'teal.5' }]}
          valueFormatter={chartMoney}
          withLegend
          barProps={{ radius: 4 }}
          gridAxis="y"
        />
      </Panel>

      <Panel title="Категории по месяцам" subtitle="Оранжевым — месяц в полтора раза выше медианы: выброс или разовая трата">
        <ScrollArea>
          <Table verticalSpacing={6} highlightOnHover miw={760}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Категория</Table.Th>
                {analysis.months.map((month) => (
                  <Table.Th key={month.month} ta="right">
                    {short(month.month)}
                  </Table.Th>
                ))}
                <Table.Th ta="right">Медиана</Table.Th>
                <Table.Th ta="right">Среднее</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {categoryStats.map((stat) => (
                <Table.Tr key={stat.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {stat.name}
                    </Text>
                  </Table.Td>
                  {analysis.months.map((month) => {
                    const amount = Number(month.categories[stat.id] ?? 0);
                    return (
                      <Table.Td key={month.month} ta="right" style={{ whiteSpace: 'nowrap' }}>
                        <Text size="sm" c={spike(amount, stat) ? 'orange' : amount ? undefined : 'dimmed'} fw={spike(amount, stat) ? 600 : undefined}>
                          {amount ? chartMoney(amount) : '—'}
                        </Text>
                      </Table.Td>
                    );
                  })}
                  <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                    <Text size="sm" fw={600}>
                      {money(stat.median)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                    <Tooltip label={stat.max_month ? `максимум ${money(stat.max)} — ${monthTitle(stat.max_month).toLowerCase()}` : 'трат не было'}>
                      <Text size="sm" c="dimmed">
                        {money(stat.mean)}
                      </Text>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Panel>
    </Stack>
  );
}

function PaceBlock({ pace }: { pace: NonNullable<SpendingAnalysis['pace']> }) {
  const rows = [...pace.groups, ...pace.categories.filter((item) => Number(item.amount) > 0)];
  return (
    <Panel title={`Темп: ${monthTitle(pace.month).toLowerCase()}`} subtitle={`Прошло ${pace.day} из ${pace.days} дней — если тратить так же, к концу месяца будет`}>
      <Table verticalSpacing={6}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Группа / категория</Table.Th>
            <Table.Th ta="right">Сейчас</Table.Th>
            <Table.Th ta="right">К концу месяца</Table.Th>
            <Table.Th ta="right">Граница</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((item, index) => {
            const over = item.target !== null && Number(item.projected) > Number(item.target);
            const isGroup = index < pace.groups.length;
            return [
              index === pace.groups.length && (
                <Table.Tr key="categories-header">
                  <Table.Td colSpan={5}>
                    <Text size="xs" c="dimmed" fw={600}>
                      Категории с границей
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ),
              <Table.Tr key={item.id}>
                <Table.Td>
                  <Text size="sm" fw={isGroup ? 700 : 400} pl={isGroup ? 0 : 'md'}>
                    {item.name}
                  </Text>
                </Table.Td>
                <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                  {money(item.amount)}
                </Table.Td>
                <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }} fw={600}>
                  {money(item.projected)}
                </Table.Td>
                <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }} c="dimmed">
                  {item.target ? money(item.target) : '—'}
                </Table.Td>
                <Table.Td ta="right">
                  {item.target !== null && (
                    <Badge variant="light" color={over ? 'red' : 'teal'} radius="sm">
                      {over ? `перерасход ≈ ${money((Number(item.projected) - Number(item.target)).toFixed(2))}` : 'в границе'}
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>,
            ];
          })}
        </Table.Tbody>
      </Table>
    </Panel>
  );
}
