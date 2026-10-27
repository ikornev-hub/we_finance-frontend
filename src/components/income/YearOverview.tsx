import { Badge, Box, Grid, Group, Paper, Progress, ScrollArea, Stack, Table, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { Fragment, useState } from 'react';

import type { IncomeCheck, PaymentOut, PaymentStatus, WhatIfOut, YearReportOut } from '../../api/types';
import { CHECK_BADGE } from '../expenses/common';
import { PAYMENT_KIND, date, money, signedMoney, todayIso } from '../../lib/format';
import { Panel } from '../Cards';
import { PaymentStatusBadge } from '../PaymentStatusBadge';

// Отчёт о доходах за год (решение заказчика 2026-10-27): сверху — полоса года и таймер ближайшей выплаты,
// ниже — одна таблица по месяцу начисления (как в расчётном листке); клик по месяцу раскрывает его выплаты.
// «Что если» — колонки «Станет» и «Разница» в той же таблице.

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/** Сумма денег-строк без float: в копейках как целые. */
function sum(values: string[]): string {
  const cents = values.reduce((total, value) => total + Math.round(Number(value) * 100), 0);
  return (cents / 100).toFixed(2);
}

const netOf = (payments: PaymentOut[]) => sum(payments.map((payment) => payment.net));
const shortDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
const isVacation = (payment: PaymentOut) => payment.kind === 'vacation';
const isSick = (payment: PaymentOut) => payment.kind === 'sick_employer' || payment.kind === 'sick_fund';

const CHIP: Record<PaymentStatus, { color: string; variant: 'light' | 'filled' | 'outline' }> = {
  done: { color: 'teal', variant: 'light' },
  today: { color: 'brand', variant: 'filled' },
  planned: { color: 'gray', variant: 'outline' },
};

/** «через 3 дня» / «завтра» / «сегодня». */
function untilText(iso: string): string {
  const days = Math.round((Date.parse(iso) - Date.parse(todayIso())) / 86_400_000);
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'завтра';
  const tail = days % 10 === 1 && days % 100 !== 11 ? 'день' : [2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100) ? 'дня' : 'дней';
  return `через ${days} ${tail}`;
}

/** Полоса года: получено — сплошная, впереди — штриховка; НДФЛ — человеческой фразой. */
function YearStrip({ report, whatIf }: { report: YearReportOut; whatIf?: WhatIfOut | null }) {
  const received = netOf(report.payments.filter((payment) => payment.status === 'done'));
  const ahead = netOf(report.payments.filter((payment) => payment.status !== 'done'));
  const total = Number(report.net) || 1;
  const per100 = Number(report.gross) > 0 ? (Number(report.tax) / Number(report.gross)) * 100 : 0;
  return (
    <Paper p="lg" radius="lg" withBorder h="100%">
      <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{ letterSpacing: '0.08em' }}>
        На руки за {report.year}
      </Text>
      <Group align="baseline" gap="md" mb="sm">
        <Text fz={{ base: 32, sm: 40 }} fw={900} lh={1.1}>
          {money(report.net)}
        </Text>
        {whatIf && (
          <Text fw={700} c={Number(whatIf.net_change) < 0 ? 'red' : 'teal'}>
            если так: {money(whatIf.net_after)} ({signedMoney(whatIf.net_change)})
          </Text>
        )}
      </Group>
      <Progress.Root size={18} radius="xl">
        <Progress.Section value={(Number(received) / total) * 100} color="brand" />
        <Progress.Section value={(Number(ahead) / total) * 100} color="brand.3" striped />
      </Progress.Root>
      <Group justify="space-between" mt={6} gap="xs">
        <Text size="sm">
          получено <b>{money(received)}</b>
        </Text>
        <Text size="sm" c="dimmed">
          впереди {money(ahead)}
        </Text>
      </Group>
      <Text size="sm" c="dimmed" mt="sm">
        НДФЛ {money(report.tax)} — {per100.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ₽ с каждых 100 начисленных ·
        в среднем на руки {money((Number(report.net) / 12).toFixed(2))} в месяц
      </Text>
    </Paper>
  );
}

/** Таймер ближайшей выплаты и точки выплат её месяца. */
function NextPayment({ report }: { report: YearReportOut }) {
  const next = report.payments.find((payment) => payment.status !== 'done');
  if (!next) {
    return (
      <Paper p="lg" radius="lg" withBorder h="100%">
        <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{ letterSpacing: '0.08em' }}>
          Ближайшая выплата
        </Text>
        <Text fz={24} fw={800} mt="xs">
          Год закрыт
        </Text>
        <Text size="sm" c="dimmed">
          Все выплаты {report.year} года получены.
        </Text>
      </Paper>
    );
  }
  const sameMonth = report.payments.filter((payment) => payment.date.slice(0, 7) === next.date.slice(0, 7));
  return (
    <Paper p="lg" radius="lg" withBorder h="100%" style={{ borderColor: 'var(--mantine-color-brand-6)' }}>
      <Text size="xs" tt="uppercase" fw={700} c="brand" style={{ letterSpacing: '0.08em' }}>
        Ближайшая выплата · {untilText(next.date)}
      </Text>
      <Text fz={{ base: 28, sm: 32 }} fw={900} lh={1.1} mt={4}>
        {money(next.net)}
      </Text>
      <Text size="sm" c="dimmed" mb="sm">
        {date(next.date)} · {PAYMENT_KIND[next.kind] ?? next.kind}
      </Text>
      <Group gap="md">
        {sameMonth.map((payment, index) => (
          <Group key={index} gap={6} wrap="nowrap">
            <Box
              w={10}
              h={10}
              style={{
                borderRadius: '50%',
                border: '2px solid var(--mantine-color-brand-6)',
                background: payment.status === 'done' ? 'var(--mantine-color-brand-6)' : 'transparent',
              }}
            />
            <Text size="xs">
              {shortDate(payment.date)} {PAYMENT_KIND[payment.kind]?.toLowerCase() ?? payment.kind}
            </Text>
          </Group>
        ))}
      </Group>
    </Paper>
  );
}

/** Сверка выплаты с выпиской: пришло, расхождение, не найдено… */
function StatementCheck({ check }: { check: IncomeCheck | undefined }) {
  if (!check) return null;
  const badge = CHECK_BADGE[check.status];
  return (
    <Group gap={6} wrap="nowrap">
      <Badge variant="light" color={badge.color} radius="sm">
        {badge.text}
      </Badge>
      {check.status === 'mismatch' && (
        <Text size="xs" c="orange">
          пришло {money(check.operation_amount)}
        </Text>
      )}
    </Group>
  );
}

/** Копеечные расхождения — известное округление, их сворачиваем в одну строку. */
const SMALL_DIFF = 100;

/** Расчёт против выписки за год: суммы по прошедшим выплатам, счётчики, крупные расхождения. */
function CheckSummary({ checks, year }: { checks: IncomeCheck[]; year: number }) {
  // «Прошло»: пришло (ровно или нет) и не найдено при наличии выписки. Будущие и без выписки — не в суммах.
  const past = checks.filter((check) => ['confirmed', 'mismatch', 'missing'].includes(check.status));
  if (past.length === 0) return null;
  const expected = sum(past.map((check) => check.expected));
  const received = sum(past.map((check) => check.operation_amount ?? '0'));
  const difference = sum([received, `-${expected}`]);
  const count = (status: IncomeCheck['status']) => checks.filter((check) => check.status === status).length;
  const mismatches = checks.filter((check) => check.status === 'mismatch');
  const big = [
    ...mismatches.filter((check) => Math.abs(Number(check.difference)) >= SMALL_DIFF),
    ...checks.filter((check) => check.status === 'missing'),
  ].sort((a, b) => Math.abs(Number(b.difference ?? b.expected)) - Math.abs(Number(a.difference ?? a.expected)));
  const small = mismatches.filter((check) => Math.abs(Number(check.difference)) < SMALL_DIFF);
  const diffColor = Number(difference) < 0 ? 'red' : Number(difference) > 0 ? 'teal' : undefined;
  const totals: [string, string, string | undefined][] = [
    ['Ожидалось', money(expected), undefined],
    ['Пришло', money(received), undefined],
    ['Разница', signedMoney(difference), diffColor],
  ];

  return (
    <Panel title={`Расчёт против выписки · ${year}`} subtitle="По выплатам, которые уже были: сколько насчитали и сколько реально пришло на счёт.">
      <Grid gutter="md">
        {totals.map(([label, value, color]) => (
          <Grid.Col key={label} span={{ base: 12, xs: 4 }}>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{ letterSpacing: '0.08em' }}>
              {label}
            </Text>
            <Text fz={24} fw={800} c={color}>
              {value}
            </Text>
          </Grid.Col>
        ))}
      </Grid>
      <Group gap="xs" mt="sm">
        <Badge variant="light" color="teal" radius="sm" tt="none">
          ✓ совпало {count('confirmed')}
        </Badge>
        <Badge variant="light" color="orange" radius="sm" tt="none">
          ⚠ расхождений {count('mismatch')}
        </Badge>
        <Badge variant="light" color="red" radius="sm" tt="none">
          ✗ не найдено {count('missing')}
        </Badge>
        {count('no_statement') > 0 && (
          <Badge variant="light" color="gray" radius="sm" tt="none">
            нет выписки {count('no_statement')}
          </Badge>
        )}
        <Badge variant="light" color="blue" radius="sm" tt="none">
          ⏳ впереди {count('expected')}
        </Badge>
      </Group>
      {big.length > 0 && (
        <ScrollArea>
          <Table verticalSpacing={4} mt="md" fz="sm" miw={520}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Крупные расхождения (от {SMALL_DIFF} ₽)</Table.Th>
                <Table.Th ta="right">Ждали</Table.Th>
                <Table.Th ta="right">Пришло</Table.Th>
                <Table.Th ta="right">Разница</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {big.map((check) => (
                <Table.Tr key={`${check.date}-${check.kind}`}>
                  <Table.Td>
                    {date(check.date)} · {PAYMENT_KIND[check.kind]?.toLowerCase() ?? check.kind}
                    {check.operation_date && check.operation_date !== check.date && (
                      <Text span size="xs" c="dimmed">
                        {' '}
                        (пришло {date(check.operation_date)})
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td ta="right">{money(check.expected)}</Table.Td>
                  <Table.Td ta="right">{check.operation_amount === null ? 'не пришло' : money(check.operation_amount)}</Table.Td>
                  <Table.Td ta="right" fw={700} c={Number(check.difference ?? -1) < 0 ? 'red' : 'teal'}>
                    {signedMoney(check.difference ?? `-${check.expected}`)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
      {small.length > 0 && (
        <Text size="sm" c="dimmed" mt="sm">
          Копеечные (до {SMALL_DIFF} ₽): {small.length} выплат, в сумме {signedMoney(sum(small.map((check) => check.difference ?? '0')))} — округление.
        </Text>
      )}
    </Panel>
  );
}

/** Выплата значком: дата, цвет — статус; отпускные 🏖, больничный 🤒. */
function PaymentChip({ payment }: { payment: PaymentOut }) {
  const chip = CHIP[payment.status];
  const mark = isVacation(payment) ? '🏖 ' : isSick(payment) ? '🤒 ' : '';
  return (
    <Badge variant={chip.variant} color={chip.color} radius="sm" tt="none" fw={500} title={PAYMENT_KIND[payment.kind]}>
      {mark}
      {shortDate(payment.date)}
    </Badge>
  );
}

export function YearOverview({ report, checks, whatIf }: { report: YearReportOut; checks?: IncomeCheck[]; whatIf?: WhatIfOut | null }) {
  const checkOf = (paymentDate: string, kind: string) => checks?.find((check) => check.date === paymentDate && check.kind === kind);
  const now = todayIso();
  const current = Number(now.slice(0, 4)) === report.year ? Number(now.slice(5, 7)) : null;
  const [open, setOpen] = useState<number | null>(current);
  const maxNet = Math.max(...report.months.map((month) => Number(month.net)), 1);
  const changeOf = (month: number) => whatIf?.months.find((item) => item.month === month);
  const withChecks = Boolean(checks?.length);
  const columns = (whatIf ? 8 : 6) + (withChecks ? 1 : 0);
  /** Сумма расхождений с выпиской по выплатам месяца; null — сравнивать нечего. */
  const monthDiff = (payments: PaymentOut[]): string | null => {
    const found = payments.flatMap((payment) => {
      const check = checkOf(payment.date, payment.kind);
      return check?.difference != null ? [check.difference] : [];
    });
    return found.length ? sum(found) : null;
  };

  return (
    <Stack gap="lg">
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <YearStrip report={report} whatIf={whatIf} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <NextPayment report={report} />
        </Grid.Col>
      </Grid>

      {checks && <CheckSummary checks={checks} year={report.year} />}

      <Panel title="По месяцам" subtitle="По месяцу, за который начислено, — как в расчётном листке. Клик по месяцу — его выплаты и сверка с выпиской.">
        <ScrollArea>
          <Table verticalSpacing="xs" miw={(whatIf ? 900 : 720) + (withChecks ? 110 : 0)} highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Месяц</Table.Th>
                <Table.Th ta="right">Начислено</Table.Th>
                <Table.Th ta="right">НДФЛ</Table.Th>
                <Table.Th ta="right">На руки</Table.Th>
                {whatIf && <Table.Th ta="right">Станет</Table.Th>}
                {whatIf && <Table.Th ta="right">Разница</Table.Th>}
                {withChecks && <Table.Th ta="right">Δ выписка</Table.Th>}
                <Table.Th>Выплаты</Table.Th>
                <Table.Th w={8} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {report.months.map((month) => {
                const payments = report.payments.filter((payment) => payment.for_month === month.month);
                const ahead = payments.length > 0 && payments.every((payment) => payment.status === 'planned');
                const expanded = open === month.month;
                const change = changeOf(month.month);
                const isCurrent = month.month === current;
                const diff = withChecks ? monthDiff(payments) : null;
                return (
                  <Fragment key={month.month}>
                    <Table.Tr
                      onClick={() => setOpen(expanded ? null : month.month)}
                      style={{
                        cursor: 'pointer',
                        opacity: ahead ? 0.65 : 1,
                        background: isCurrent ? 'var(--mantine-color-brand-light)' : undefined,
                      }}
                    >
                      <Table.Td>
                        <UnstyledButton aria-expanded={expanded}>
                          <Group gap={6} wrap="nowrap">
                            {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                            <Text size="sm" fw={isCurrent ? 700 : 500}>
                              {MONTH_NAMES[month.month - 1]}
                            </Text>
                          </Group>
                        </UnstyledButton>
                      </Table.Td>
                      <Table.Td ta="right">{money(month.gross)}</Table.Td>
                      <Table.Td ta="right" c="dimmed">
                        {money(month.tax)}
                      </Table.Td>
                      <Table.Td ta="right">
                        <Stack gap={3} align="flex-end">
                          <Text size="sm" fw={700}>
                            {money(month.net)}
                          </Text>
                          <Box w={96} h={4} style={{ background: 'var(--mantine-color-default-border)', borderRadius: 2 }}>
                            <Box h={4} w={`${(Number(month.net) / maxNet) * 100}%`} bg="brand" style={{ borderRadius: 2, marginLeft: 'auto' }} />
                          </Box>
                        </Stack>
                      </Table.Td>
                      {whatIf && <Table.Td ta="right">{change ? money(change.net_after) : '—'}</Table.Td>}
                      {whatIf && (
                        <Table.Td ta="right" fw={600} c={!change || Number(change.net_change) === 0 ? 'dimmed' : Number(change.net_change) < 0 ? 'red' : 'teal'}>
                          {change && Number(change.net_change) !== 0 ? signedMoney(change.net_change) : '—'}
                        </Table.Td>
                      )}
                      {withChecks && (
                        <Table.Td ta="right" fw={600} c={diff === null || Math.abs(Number(diff)) < 1 ? 'dimmed' : Number(diff) < 0 ? 'red' : 'teal'}>
                          {diff === null ? '—' : signedMoney(diff)}
                        </Table.Td>
                      )}
                      <Table.Td>
                        <Group gap={4}>
                          {payments.map((payment, index) => (
                            <PaymentChip key={index} payment={payment} />
                          ))}
                        </Group>
                      </Table.Td>
                      <Table.Td />
                    </Table.Tr>
                    {expanded &&
                      payments.map((payment, index) => (
                        <Table.Tr key={`${month.month}-${index}`} style={{ background: 'var(--mantine-color-default-hover)' }}>
                          <Table.Td pl={32}>
                            <Text size="xs">
                              {date(payment.date)} · {PAYMENT_KIND[payment.kind] ?? payment.kind}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="xs">{money(payment.gross)}</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="xs" c="dimmed">
                              {money(payment.tax)}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="xs" fw={600}>
                              {money(payment.net)}
                            </Text>
                          </Table.Td>
                          {whatIf && <Table.Td />}
                          {whatIf && <Table.Td />}
                          {withChecks && <Table.Td />}
                          <Table.Td colSpan={2}>
                            <Group gap={6} wrap="nowrap">
                              <PaymentStatusBadge status={payment.status} />
                              <StatementCheck check={checkOf(payment.date, payment.kind)} />
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    {expanded && payments.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={columns} pl={32}>
                          <Text size="xs" c="dimmed">
                            Выплат за этот месяц нет.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Fragment>
                );
              })}
            </Table.Tbody>
            <Table.Tfoot>
              <Table.Tr>
                <Table.Th>Итого за год</Table.Th>
                <Table.Th ta="right">{money(report.gross)}</Table.Th>
                <Table.Th ta="right">{money(report.tax)}</Table.Th>
                <Table.Th ta="right">{money(report.net)}</Table.Th>
                {whatIf && <Table.Th ta="right">{money(whatIf.net_after)}</Table.Th>}
                {whatIf && (
                  <Table.Th ta="right" c={Number(whatIf.net_change) < 0 ? 'red' : 'teal'}>
                    {signedMoney(whatIf.net_change)}
                  </Table.Th>
                )}
                {withChecks && <Table.Th />}
                <Table.Th colSpan={2} />
              </Table.Tr>
            </Table.Tfoot>
          </Table>
        </ScrollArea>
      </Panel>
    </Stack>
  );
}
