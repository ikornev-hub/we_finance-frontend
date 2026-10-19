import { Badge, ScrollArea, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { BarChart } from '@mantine/charts';
import { IconCash, IconReceiptTax, IconWallet, IconCalendarCheck } from '@tabler/icons-react';

import type { WhatIfOut, YearReportOut } from '../../api/types';
import { MONTHS, PAYMENT_KIND, date, money, signedMoney } from '../../lib/format';
import { HeroCard, Panel, StatCard } from '../Cards';

const chartMoney = (value: number) => `${value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`;

/** Отчёт за год: итоги, график по месяцам, все выплаты. */
export function ReportView({ report }: { report: YearReportOut }) {
  const received = report.payments.filter((payment) => payment.received).length;
  const chart = report.months.map((month) => ({
    month: MONTHS[month.month - 1],
    'На руки': Number(month.net),
    НДФЛ: Number(month.tax),
  }));

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        <HeroCard
          label={`На руки за ${report.year}`}
          value={money(report.net)}
          caption="Начислено минус НДФЛ"
          icon={<IconWallet size={18} />}
        />
        <StatCard label="Начислено" value={money(report.gross)} icon={<IconCash size={16} />} />
        <StatCard
          label="НДФЛ"
          value={money(report.tax)}
          icon={<IconReceiptTax size={16} />}
          badge={{ text: 'прогрессивная шкала', color: 'gray' }}
        />
        <StatCard
          label="Выплат"
          value={String(report.payments.length)}
          icon={<IconCalendarCheck size={16} />}
          badge={{ text: `получено ${received}`, color: 'teal' }}
          hint={`впереди ${report.payments.length - received}`}
        />
      </SimpleGrid>

      <Panel title="По месяцам" subtitle="На руки и НДФЛ по месяцу, за который начислено">
        <BarChart
          h={260}
          data={chart}
          dataKey="month"
          type="stacked"
          series={[
            { name: 'На руки', color: 'brand.6' },
            { name: 'НДФЛ', color: 'gray.5' },
          ]}
          valueFormatter={chartMoney}
          withLegend
          barProps={{ radius: 6 }}
          gridAxis="y"
        />
      </Panel>

      <Panel title="Выплаты" subtitle="Все поступления года по датам: аванс, остаток, отпускные, больничный">
        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="xs" miw={720}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Дата</Table.Th>
                <Table.Th>Вид</Table.Th>
                <Table.Th>За месяц</Table.Th>
                <Table.Th ta="right">Начислено</Table.Th>
                <Table.Th ta="right">НДФЛ</Table.Th>
                <Table.Th ta="right">На руки</Table.Th>
                <Table.Th>Статус</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {report.payments.map((payment, index) => (
                <Table.Tr key={index}>
                  <Table.Td>{date(payment.date)}</Table.Td>
                  <Table.Td>{PAYMENT_KIND[payment.kind] ?? payment.kind}</Table.Td>
                  <Table.Td>{MONTHS[payment.for_month - 1]}</Table.Td>
                  <Table.Td ta="right">{money(payment.gross)}</Table.Td>
                  <Table.Td ta="right">{money(payment.tax)}</Table.Td>
                  <Table.Td ta="right" fw={600}>
                    {money(payment.net)}
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={payment.received ? 'teal' : 'gray'} radius="sm">
                      {payment.received ? 'Получено' : 'Впереди'}
                    </Badge>
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
        <HeroCard label="Изменение за год" value={signedMoney(result.net_change)} caption="После минус до" />
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
