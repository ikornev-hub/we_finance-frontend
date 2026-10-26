import { Alert, Badge, Button, Group, Progress, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { IconArrowRight, IconCalendarDue, IconListSearch } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { expensesApi, loansApi, salaryApi } from '../api/endpoints';
import type { IncomeCheck, LoanDetailOut, YearReportOut } from '../api/types';
import { PageHeader, Panel } from '../components/Cards';
import { ErrorAlert } from '../components/ErrorAlert';
import { CHECK_BADGE, MonthSwitch, SampleNotice, monthTitle, percent, useSelectedMonth } from '../components/expenses/common';
import { MonthTotals, RemainingBadge, fill, limitLabel } from '../components/expenses/MonthView';
import { SAMPLE_INCOME_CHECK, SAMPLE_MONTH } from '../lib/expenseSamples';
import { PAYMENT_KIND, date, money, todayIso } from '../lib/format';
import { useOrSample } from '../lib/sample';

interface Event {
  date: string;
  title: string;
  amount: string;
  direction: 'in' | 'out';
}

function useLoad<T>(fn: () => Promise<T>): { data: T | null; error: unknown } {
  const [state, setState] = useState<{ data: T | null; error: unknown }>({ data: null, error: null });
  useEffect(() => {
    fn()
      .then((data) => setState({ data, error: null }))
      .catch((error) => setState({ data: null, error }));
    // Загружается один раз при открытии главной.
  }, []);
  return state;
}

/**
 * Главная: месяц целиком — доходы, расходы по категориям, остаток;
 * пришли ли доходы по выписке; что дальше по зарплате и кредитам.
 */
export function HomePage() {
  const today = todayIso();
  const [month, setMonth] = useSelectedMonth();
  const year = Number(month.slice(0, 4));

  const report = useOrSample(() => expensesApi.month(month), SAMPLE_MONTH, month);
  const checks = useOrSample(() => expensesApi.incomeCheck(year), SAMPLE_INCOME_CHECK, String(year));
  const salary = useLoad<YearReportOut>(() => salaryApi.year(Number(today.slice(0, 4))));
  const loans = useLoad<LoanDetailOut[]>(async () => {
    const [active, completed] = await Promise.all([loansApi.list(), loansApi.list(undefined, 'completed')]);
    return Promise.all([...active, ...completed].map((loan) => loansApi.detail(loan.id)));
  });

  const monthChecks: IncomeCheck[] = (checks.data ?? []).filter((check) => check.date.startsWith(month));
  const confirmed = monthChecks.filter((check) => check.status === 'confirmed').length;

  const events: Event[] = [
    ...(salary.data?.payments ?? [])
      .filter((payment) => payment.status !== 'done')
      .map((payment) => ({ date: payment.date, title: PAYMENT_KIND[payment.kind] ?? payment.kind, amount: payment.net, direction: 'in' as const })),
    ...(loans.data ?? []).flatMap((loan) =>
      loan.schedule
        .filter((row) => row.status !== 'done')
        .map((row) => ({ date: row.date, title: `Платёж: ${loan.name}`, amount: row.payment, direction: 'out' as const })),
    ),
  ]
    .filter((event) => event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const groups = (report.data?.groups ?? []).filter((group) => Number(group.amount) !== 0 || group.limit_mode);
  const max = Math.max(...groups.map((group) => Number(group.amount)), 1);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <PageHeader title={monthTitle(month)} subtitle="Сколько пришло, куда ушло и что осталось." />
        <MonthSwitch month={month} onChange={setMonth} />
      </Group>

      {report.sample && <SampleNotice what="Доходы, расходы и категории месяца" />}
      <ErrorAlert error={report.error} />
      {report.data && <MonthTotals report={report.data} />}

      {report.data && report.data.uncategorized_count > 0 && (
        <Alert color="orange" radius="lg" variant="light" icon={<IconListSearch size={18} />} title={`Ждут разбора: ${report.data.uncategorized_count}`}>
          <Group justify="space-between">
            <Text size="sm">Операции без категории не попадают в цели и доли.</Text>
            <Button size="xs" color="orange" variant="light" onClick={() => (window.location.hash = '#expenses/review')}>
              Разобрать
            </Button>
          </Group>
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Panel
          title="Группы трат"
          subtitle="Факт, доля, граница и сколько ещё можно; внутри — крупнейшие категории"
          actions={
            <Button variant="subtle" size="xs" rightSection={<IconArrowRight size={14} />} onClick={() => (window.location.hash = '#expenses/month')}>
              Подробно
            </Button>
          }
        >
          <Stack gap="md">
            {groups.length === 0 && (
              <Text size="sm" c="dimmed">
                Трат за месяц нет — загрузи выписку.
              </Text>
            )}
            {groups.map((group) => {
              const over = group.remaining !== null && Number(group.remaining) < 0;
              const top = group.categories.filter((category) => Number(category.amount) > 0).slice(0, 3);
              return (
                <Stack key={group.code} gap={4}>
                  <Group justify="space-between" wrap="nowrap">
                    <Text size="sm" fw={700}>
                      {group.name}
                    </Text>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
                        {money(group.amount)}
                      </Text>
                      <Text size="xs" c="dimmed" w={56} ta="right">
                        {percent(group.share)}
                      </Text>
                    </Group>
                  </Group>
                  <Progress value={fill(group, max)} size="sm" color={over ? 'red' : group.target ? 'teal' : group.code === 'mandatory' ? 'gray' : 'brand'} />
                  {top.length > 0 && (
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {top.map((category) => `${category.name} ${money(category.amount)}`).join(' · ')}
                    </Text>
                  )}
                  {group.limit_mode && (
                    <Group justify="space-between" wrap="nowrap">
                      <Text size="xs" c="dimmed">
                        граница {limitLabel(group)}
                      </Text>
                      <RemainingBadge category={group} />
                    </Group>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </Panel>

        <Stack gap="lg">
          <Panel title="Доходы по выписке" subtitle={monthChecks.length ? `Подтверждено ${confirmed} из ${monthChecks.length}` : 'Сверка расчёта с выпиской'}>
            {checks.sample && <SampleNotice what="Сверка доходов" />}
            <ErrorAlert error={checks.error} />
            {monthChecks.length === 0 ? (
              <Text size="sm" c="dimmed">
                В этом месяце выплат по расчёту нет.
              </Text>
            ) : (
              <Table verticalSpacing="xs">
                <Table.Tbody>
                  {monthChecks.map((check) => (
                    <Table.Tr key={`${check.date}-${check.kind}`}>
                      <Table.Td w={100}>{date(check.date)}</Table.Td>
                      <Table.Td>{PAYMENT_KIND[check.kind] ?? check.kind}</Table.Td>
                      <Table.Td ta="right">{money(check.expected)}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={CHECK_BADGE[check.status].color} radius="sm">
                          {CHECK_BADGE[check.status].text}
                        </Badge>
                        {check.status === 'mismatch' && check.difference && (
                          <Text size="xs" c="orange">
                            пришло {money(check.operation_amount)} ({money(check.difference)})
                          </Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Panel>

          <Panel title="Что дальше" subtitle="Ближайшие выплаты и платежи по кредитам">
            {events.length === 0 ? (
              <Text size="sm" c="dimmed">
                Ничего не запланировано.
              </Text>
            ) : (
              <Table verticalSpacing="xs">
                <Table.Tbody>
                  {events.map((event, index) => (
                    <Table.Tr key={index}>
                      <Table.Td w={110}>
                        <Group gap={6} wrap="nowrap">
                          <IconCalendarDue size={14} />
                          <Text size="sm" fw={event.date === today ? 600 : undefined}>
                            {event.date === today ? 'Сегодня' : date(event.date)}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{event.title}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" fw={600} c={event.direction === 'in' ? 'teal' : undefined}>
                          {event.direction === 'in' ? '+' : '−'}
                          {money(event.amount)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Panel>
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}
