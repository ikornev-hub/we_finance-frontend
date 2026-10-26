import { Badge, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { BarChart } from '@mantine/charts';

import type { WhatIfOut } from '../../api/types';
import { MONTHS, money, signedMoney } from '../../lib/format';
import { HeroCard, Panel, StatCard } from '../Cards';

const chartMoney = (value: number) => `${value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`;

/** «Что если»: до, после, изменение — по году и по месяцам. */
export function WhatIfView({ result }: { result: WhatIfOut }) {
  const change = Number(result.net_change);
  const color = change < 0 ? 'red' : change > 0 ? 'teal' : 'gray';
  const chart = result.months.map((month) => ({
    month: MONTHS[month.month - 1],
    Было: Number(month.net_before),
    Станет: Number(month.net_after),
  }));
  const changed = result.months.filter((month) => Number(month.net_change) !== 0);

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <StatCard label={`На руки за ${result.year} — сейчас`} value={money(result.net_before)} />
        <StatCard label="На руки — если так" value={money(result.net_after)} />
        <HeroCard label="Изменение за год" value={signedMoney(result.net_change)} caption="Насколько больше (+) или меньше (−) на руки за год, чем сейчас" />
      </SimpleGrid>

      <Panel title="По месяцам: было и станет">
        <BarChart
          h={260}
          data={chart}
          dataKey="month"
          series={[
            { name: 'Было', color: 'gray.5' },
            { name: 'Станет', color: 'brand.6' },
          ]}
          valueFormatter={chartMoney}
          withLegend
          barProps={{ radius: 6 }}
          gridAxis="y"
        />
      </Panel>

      <Panel title="Месяцы, которые изменятся">
        {changed.length === 0 ? (
          <Text size="sm" c="dimmed">
            В этом году ничего не меняется.
          </Text>
        ) : (
          <Table verticalSpacing="xs" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Месяц</Table.Th>
                <Table.Th ta="right">Было</Table.Th>
                <Table.Th ta="right">Станет</Table.Th>
                <Table.Th ta="right">Изменение</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {changed.map((month) => (
                <Table.Tr key={month.month}>
                  <Table.Td>{MONTHS[month.month - 1]}</Table.Td>
                  <Table.Td ta="right">{money(month.net_before)}</Table.Td>
                  <Table.Td ta="right">{money(month.net_after)}</Table.Td>
                  <Table.Td ta="right">
                    <Badge variant="light" color={color} radius="sm">
                      {signedMoney(month.net_change)}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Panel>
    </Stack>
  );
}
