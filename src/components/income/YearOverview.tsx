import { Badge, Button, Collapse, Group, ScrollArea, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { BarChart } from '@mantine/charts';
import { useDisclosure } from '@mantine/hooks';
import { IconCalendarDue, IconCash, IconChevronDown, IconChevronUp, IconReceiptTax, IconWallet } from '@tabler/icons-react';

import type { PaymentOut, YearReportOut } from '../../api/types';
import { MONTHS, PAYMENT_KIND, date, money } from '../../lib/format';
import { HeroCard, Panel, StatCard } from '../Cards';
import { PaymentStatusBadge } from '../PaymentStatusBadge';

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const chartMoney = (value: number) => `${value.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`;

/** Сумма денег-строк без float: в копейках как целые. */
function sum(values: string[]): string {
  const cents = values.reduce((total, value) => total + Math.round(Number(value) * 100), 0);
  return (cents / 100).toFixed(2);
}

function netOf(payments: PaymentOut[]): string {
  return sum(payments.map((payment) => payment.net));
}

function grossOfKinds(payments: PaymentOut[], kinds: string[]): string {
  return sum(payments.filter((payment) => kinds.includes(payment.kind)).map((payment) => payment.gross));
}

type MonthStatus = 'done' | 'partly' | 'ahead';

function monthStatus(payments: PaymentOut[]): MonthStatus {
  const received = payments.filter((payment) => payment.status === 'done').length;
  if (received === 0) return 'ahead';
  return received === payments.length ? 'done' : 'partly';
}

const STATUS_BADGE: Record<MonthStatus, { text: string; color: string }> = {
  done: { text: 'Получено', color: 'teal' },
  partly: { text: 'Частично', color: 'yellow' },
  ahead: { text: 'Впереди', color: 'gray' },
};

/** Главная «Доходов»: итоги года, ближайшая выплата, годовой отчёт по месяцам (как лист Excel), все выплаты. */
export function YearOverview({ report }: { report: YearReportOut }) {
  const [paymentsOpen, payments] = useDisclosure(false);

  const received = report.payments.filter((payment) => payment.status === 'done');
  // «Впереди» — сегодняшние и запланированные: сегодняшняя выплата ещё не учтена.
  const ahead = report.payments.filter((payment) => payment.status !== 'done');
  const next = ahead[0];
  const taxRate = Number(report.gross) > 0 ? (Number(report.tax) / Number(report.gross)) * 100 : 0;

  const rows = report.months.map((month) => {
    const ofMonth = report.payments.filter((payment) => payment.for_month === month.month);
    return {
      ...month,
      vacation: grossOfKinds(ofMonth, ['vacation']),
      sick: grossOfKinds(ofMonth, ['sick_employer', 'sick_fund']),
      status: monthStatus(ofMonth),
    };
  });
  const totalVacation = sum(rows.map((row) => row.vacation));
  const totalSick = sum(rows.map((row) => row.sick));

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
          caption={`в среднем ${money((Number(report.net) / 12).toFixed(2))} в месяц`}
          icon={<IconWallet size={18} />}
        />
        <StatCard
          label="Уже получено"
          value={money(netOf(received))}
          icon={<IconCash size={16} />}
          badge={{ text: `${received.length} выплат`, color: 'teal' }}
          hint={`впереди ${money(netOf(ahead))}`}
        />
        <StatCard
          label="Удержано НДФЛ"
          value={money(report.tax)}
          icon={<IconReceiptTax size={16} />}
          badge={{ text: `${taxRate.toFixed(1)} % от начисленного`, color: 'gray' }}
          hint={`начислено ${money(report.gross)}`}
        />
        <StatCard
          label="Ближайшая выплата"
          value={next ? money(next.net) : '—'}
          icon={<IconCalendarDue size={16} />}
          badge={next ? { text: date(next.date), color: 'brand' } : { text: 'год закрыт', color: 'gray' }}
          hint={next ? PAYMENT_KIND[next.kind] ?? next.kind : undefined}
        />
      </SimpleGrid>

      <Panel title="Годовой отчёт" subtitle="По месяцу, за который начислено. Отпускные и больничные — входят в «Начислено».">
        <ScrollArea>
          <Table striped highlightOnHover verticalSpacing="xs" miw={760}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Месяц</Table.Th>
                <Table.Th ta="right">Начислено</Table.Th>
                <Table.Th ta="right">в т. ч. отпускные</Table.Th>
                <Table.Th ta="right">в т. ч. больничный</Table.Th>
                <Table.Th ta="right">НДФЛ</Table.Th>
                <Table.Th ta="right">На руки</Table.Th>
                <Table.Th>Статус</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.month}>
                  <Table.Td>{MONTH_NAMES[row.month - 1]}</Table.Td>
                  <Table.Td ta="right">{money(row.gross)}</Table.Td>
                  <Table.Td ta="right" c={Number(row.vacation) ? undefined : 'dimmed'}>
                    {Number(row.vacation) ? money(row.vacation) : '—'}
                  </Table.Td>
                  <Table.Td ta="right" c={Number(row.sick) ? undefined : 'dimmed'}>
                    {Number(row.sick) ? money(row.sick) : '—'}
                  </Table.Td>
                  <Table.Td ta="right">{money(row.tax)}</Table.Td>
                  <Table.Td ta="right" fw={600}>
                    {money(row.net)}
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={STATUS_BADGE[row.status].color} radius="sm">
                      {STATUS_BADGE[row.status].text}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
            <Table.Tfoot>
              <Table.Tr>
                <Table.Th>Итого за год</Table.Th>
                <Table.Th ta="right">{money(report.gross)}</Table.Th>
                <Table.Th ta="right">{Number(totalVacation) ? money(totalVacation) : '—'}</Table.Th>
                <Table.Th ta="right">{Number(totalSick) ? money(totalSick) : '—'}</Table.Th>
                <Table.Th ta="right">{money(report.tax)}</Table.Th>
                <Table.Th ta="right">{money(report.net)}</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Tfoot>
          </Table>
        </ScrollArea>
      </Panel>

      <Panel title="По месяцам" subtitle="На руки и НДФЛ">
        <BarChart
          h={240}
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

      <Panel
        title="Выплаты по датам"
        subtitle="Когда и сколько придёт: аванс, остаток, отпускные, больничный"
        actions={
          <Button
            variant="subtle"
            size="xs"
            rightSection={paymentsOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            onClick={payments.toggle}
          >
            {paymentsOpen ? 'Скрыть' : `Показать все (${report.payments.length})`}
          </Button>
        }
      >
        <Collapse in={paymentsOpen}>
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
                    <Table.Td>{MONTH_NAMES[payment.for_month - 1]}</Table.Td>
                    <Table.Td ta="right">{money(payment.gross)}</Table.Td>
                    <Table.Td ta="right">{money(payment.tax)}</Table.Td>
                    <Table.Td ta="right" fw={600}>
                      {money(payment.net)}
                    </Table.Td>
                    <Table.Td>
                      <PaymentStatusBadge status={payment.status} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Collapse>
        {!paymentsOpen && (
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              Получено {received.length} из {report.payments.length}.
            </Text>
          </Group>
        )}
      </Panel>
    </Stack>
  );
}
