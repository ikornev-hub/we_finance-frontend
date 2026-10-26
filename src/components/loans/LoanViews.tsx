import { Alert, Badge, ScrollArea, SimpleGrid, Stack, Table, Tabs, Text } from '@mantine/core';
import { IconCalendarEvent, IconCoins, IconPigMoney, IconReceipt2 } from '@tabler/icons-react';

import type { CalculationOut, HistoryEntryOut, LoanStateOut, PreviewOut, ScheduleRowOut, WarningOut } from '../../api/types';
import { date, money } from '../../lib/format';
import { HeroCard, Panel, StatCard } from '../Cards';

export function Warnings({ warnings }: { warnings: WarningOut[] }) {
  if (warnings.length === 0) return null;
  return (
    <Stack gap="xs">
      {warnings.map((warning) => (
        <Alert key={warning.code} color="yellow" radius="lg" title="Обратите внимание">
          <Text size="sm">{warning.message}</Text>
        </Alert>
      ))}
    </Stack>
  );
}

/** График платежей; past — отметка «уже прошёл» (есть у сохранённых кредитов и полного расчёта). */
export function ScheduleTable({ rows }: { rows: (ScheduleRowOut & { past?: boolean })[] }) {
  const withPast = rows.some((row) => row.past !== undefined);
  return (
    <ScrollArea h={rows.length > 14 ? 520 : undefined}>
      <Table striped highlightOnHover verticalSpacing="xs" stickyHeader miw={720}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>№</Table.Th>
            <Table.Th>Дата</Table.Th>
            <Table.Th ta="right">Платёж</Table.Th>
            <Table.Th ta="right">Долг</Table.Th>
            <Table.Th ta="right">Проценты</Table.Th>
            <Table.Th ta="right">Комиссия</Table.Th>
            <Table.Th ta="right">Остаток</Table.Th>
            {withPast && <Table.Th>Статус</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.number} opacity={row.past ? 0.6 : 1}>
              <Table.Td>{row.number}</Table.Td>
              <Table.Td>{date(row.date)}</Table.Td>
              <Table.Td ta="right" fw={600}>
                {money(row.payment)}
              </Table.Td>
              <Table.Td ta="right">{money(row.principal)}</Table.Td>
              <Table.Td ta="right">{money(row.interest)}</Table.Td>
              <Table.Td ta="right">{money(row.fee)}</Table.Td>
              <Table.Td ta="right">{money(row.balance)}</Table.Td>
              {withPast && (
                <Table.Td>
                  <Badge variant="light" color={row.past ? 'gray' : 'brand'} radius="sm">
                    {row.past ? 'Прошёл' : 'Впереди'}
                  </Badge>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}

export function HistoryTable({ rows }: { rows: HistoryEntryOut[] }) {
  if (rows.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        На эту дату платежей ещё не было.
      </Text>
    );
  }
  return (
    <ScrollArea>
      <Table striped highlightOnHover verticalSpacing="xs" miw={720}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Дата</Table.Th>
            <Table.Th>Тип</Table.Th>
            <Table.Th ta="right">Сумма</Table.Th>
            <Table.Th ta="right">Долг</Table.Th>
            <Table.Th ta="right">Проценты</Table.Th>
            <Table.Th ta="right">Комиссия</Table.Th>
            <Table.Th ta="right">Остаток</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, index) => (
            <Table.Tr key={index}>
              <Table.Td>{date(row.date)}</Table.Td>
              <Table.Td>
                <Badge variant="light" color={row.kind === 'prepayment' ? 'brand' : 'gray'} radius="sm">
                  {row.kind === 'prepayment' ? 'ЧДП' : 'Платёж'}
                </Badge>
              </Table.Td>
              <Table.Td ta="right" fw={600}>
                {money(row.amount)}
              </Table.Td>
              <Table.Td ta="right">{money(row.principal)}</Table.Td>
              <Table.Td ta="right">{money(row.interest)}</Table.Td>
              <Table.Td ta="right">{money(row.fee)}</Table.Td>
              <Table.Td ta="right">{money(row.balance)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}

function StateTable({
  start,
  actual,
  labels = ['По договору (без ЧДП)', 'Фактически'],
}: {
  start: LoanStateOut;
  actual: LoanStateOut;
  labels?: [string, string];
}) {
  const rows: [string, string, string][] = [
    ['Остаток долга', money(start.balance), money(actual.balance)],
    ['Следующий платёж', start.next_payment ? date(start.next_payment.date) : '—', actual.next_payment ? date(actual.next_payment.date) : '—'],
    ['Сумма следующего', money(start.next_payment?.payment), money(actual.next_payment?.payment)],
    ['Последний платёж', money(start.last_payment), money(actual.last_payment)],
    ['Дата закрытия', date(start.close_date), date(actual.close_date)],
    ['Платежей осталось', String(start.payments_left), String(actual.payments_left)],
  ];
  return (
    <Table verticalSpacing="xs">
      <Table.Thead>
        <Table.Tr>
          <Table.Th />
          <Table.Th ta="right">{labels[0]}</Table.Th>
          <Table.Th ta="right">{labels[1]}</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map(([label, before, after]) => (
          <Table.Tr key={label}>
            <Table.Td c="dimmed">{label}</Table.Td>
            <Table.Td ta="right">{before}</Table.Td>
            <Table.Td ta="right" fw={600}>
              {after}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

/** Всё о кредите на дату: итоги, сравнение с договором, график и история. */
export function CalculationView({ calculation }: { calculation: CalculationOut }) {
  const { actual } = calculation;
  return (
    <Stack gap="lg">
      <Warnings warnings={calculation.warnings} />
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        <HeroCard
          label={`Остаток долга на ${date(actual.as_of)}`}
          value={money(actual.balance)}
          caption={`Платежей осталось: ${actual.payments_left}`}
          icon={<IconCoins size={18} />}
        />
        <StatCard
          label="Следующий платёж"
          value={money(actual.next_payment?.payment)}
          hint={actual.next_payment ? date(actual.next_payment.date) : 'кредит закрыт'}
          icon={<IconCalendarEvent size={16} />}
        />
        <StatCard
          label="Внесено ЧДП"
          value={money(calculation.prepaid_total)}
          icon={<IconReceipt2 size={16} />}
          badge={calculation.months_saved > 0 ? { text: `−${calculation.months_saved} мес.`, color: 'teal' } : undefined}
        />
        <StatCard
          label="Сэкономлено процентов"
          value={money(calculation.interest_saved)}
          hint={`закрытие ${date(actual.close_date)}`}
          icon={<IconPigMoney size={16} />}
        />
      </SimpleGrid>

      <Panel title="Договор и факт" subtitle="Как было бы без досрочных платежей и как есть">
        <StateTable start={calculation.start} actual={calculation.actual} />
      </Panel>

      <Panel>
        <Tabs defaultValue="schedule" radius="md">
          <Tabs.List mb="md">
            <Tabs.Tab value="schedule">График ({calculation.schedule.length})</Tabs.Tab>
            <Tabs.Tab value="history">История ({calculation.history.length})</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="schedule">
            <ScheduleTable rows={calculation.schedule} />
          </Tabs.Panel>
          <Tabs.Panel value="history">
            <HistoryTable rows={calculation.history} />
          </Tabs.Panel>
        </Tabs>
      </Panel>
    </Stack>
  );
}

/** Прогноз ЧДП: до и после. */
export function PreviewView({ preview }: { preview: PreviewOut }) {
  return (
    <Stack gap="md">
      <Warnings warnings={preview.warnings} />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <HeroCard label="Сэкономите процентов" value={money(preview.interest_saved)} caption={`Срок короче на ${preview.months_saved} мес.`} />
        <StatCard label="Платёж сейчас → после" value={money(preview.after.next_payment?.payment)} hint={`было ${money(preview.before.next_payment?.payment)}`} />
        <StatCard label="Закрытие сейчас → после" value={date(preview.after.close_date)} hint={`было ${date(preview.before.close_date)}`} />
      </SimpleGrid>
      <StateTable start={preview.before} actual={preview.after} labels={['Сейчас', 'После ЧДП']} />
    </Stack>
  );
}
