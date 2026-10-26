import { Alert, Badge, Button, Group, SimpleGrid, Skeleton, Stack, Table, Text } from '@mantine/core';
import {
  IconArrowRight,
  IconBuildingBank,
  IconCalendarDue,
  IconCash,
  IconInfoCircle,
  IconPigMoney,
  IconWallet,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import { loansApi, salaryApi } from '../api/endpoints';
import type { LoanDetailOut, PaymentOut, YearReportOut } from '../api/types';
import { HeroCard, PageHeader, Panel, StatCard } from '../components/Cards';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';
import { ErrorAlert } from '../components/ErrorAlert';
import { PAYMENT_KIND, date, money, todayIso } from '../lib/format';

/** Сумма денег-строк без float: в копейках как целые. */
function sum(values: string[]): string {
  const cents = values.reduce((total, value) => total + Math.round(Number(value) * 100), 0);
  return (cents / 100).toFixed(2);
}

const MONTH_NOMINATIVE = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/** Одно событие ленты «что будет дальше»: поступление или платёж по кредиту. */
interface Event {
  date: string;
  title: string;
  amount: string;
  direction: 'in' | 'out';
}

type Load<T> = { data: T | null; error: unknown; loading: boolean };

function useLoad<T>(fn: () => Promise<T>): Load<T> {
  const [state, setState] = useState<Load<T>>({ data: null, error: null, loading: true });
  useEffect(() => {
    fn()
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error, loading: false }));
    // Загружается один раз при открытии главной.
  }, []);
  return state;
}

const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;

/**
 * Главная: «как у меня с деньгами в этом месяце».
 * Доход месяца, платежи по кредитам, сколько остаётся, и лента ближайших событий.
 */
export function HomePage() {
  const today = todayIso();
  const year = Number(today.slice(0, 4));
  const month = today.slice(0, 7);
  const monthIndex = Number(today.slice(5, 7)) - 1;

  const income = useLoad<YearReportOut>(() => salaryApi.year(year));
  const loans = useLoad<LoanDetailOut[]>(async () => {
    // Завершённые учитываются везде, как активные; удалённые — нигде (С8).
    const [active, completed] = await Promise.all([loansApi.list(), loansApi.list(undefined, 'completed')]);
    const list = [...active, ...completed];
    return Promise.all(list.map((loan) => loansApi.detail(loan.id)));
  });

  const noIncome = isNotFound(income.error);
  const payments: PaymentOut[] = income.data?.payments ?? [];
  const incomeThisMonth = payments.filter((payment) => payment.date.startsWith(month));
  const incomeNet = sum(incomeThisMonth.map((payment) => payment.net));
  const incomeReceived = sum(incomeThisMonth.filter((payment) => payment.status === 'done').map((payment) => payment.net));

  const loanList = loans.data ?? [];
  const loanRowsThisMonth = loanList.flatMap((loan) =>
    loan.schedule.filter((row) => row.date.startsWith(month)).map((row) => ({ loan, row })),
  );
  const loanOut = sum(loanRowsThisMonth.map(({ row }) => row.payment));
  const debt = sum(loanList.map((loan) => loan.actual.balance));
  const lastClose = loanList.map((loan) => loan.actual.close_date).sort().at(-1);

  const free = sum([incomeNet, `-${loanOut}`]);

  const events: Event[] = [
    ...payments
      .filter((payment) => payment.status !== 'done')
      .map((payment) => ({
        date: payment.date,
        title: PAYMENT_KIND[payment.kind] ?? payment.kind,
        amount: payment.net,
        direction: 'in' as const,
      })),
    ...loanList.flatMap((loan) =>
      loan.schedule
        .filter((row) => row.status !== 'done')
        .map((row) => ({ date: row.date, title: `Платёж: ${loan.name}`, amount: row.payment, direction: 'out' as const })),
    ),
  ]
    .filter((event) => event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  const loading = income.loading || loans.loading;

  return (
    <Stack gap="lg">
      <PageHeader
        title={`${MONTH_NOMINATIVE[monthIndex]} ${year}`}
        subtitle="Сколько придёт в этом месяце, сколько уйдёт на кредиты и что остаётся."
      />

      {noIncome && (
        <Alert color="blue" radius="lg" variant="light" icon={<IconInfoCircle size={18} />} title="Доходы ещё не заполнены">
          <Group justify="space-between">
            <Text size="sm">Без них главная не посчитает, сколько остаётся после кредитов.</Text>
            <Button size="xs" variant="light" onClick={() => (window.location.hash = '#income/data')}>
              Заполнить доходы
            </Button>
          </Group>
        </Alert>
      )}
      {!noIncome && <ErrorAlert error={income.error} />}
      <ErrorAlert error={loans.error} />

      {loading ? (
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} h={128} radius="lg" />
          ))}
        </SimpleGrid>
      ) : (
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
          <HeroCard
            label="Останется в этом месяце"
            value={noIncome ? '—' : money(free)}
            caption="Доход месяца на руки минус платежи по кредитам"
            icon={<IconPigMoney size={18} />}
          />
          <StatCard
            label="Доход в этом месяце"
            value={noIncome ? '—' : money(incomeNet)}
            icon={<IconWallet size={16} />}
            badge={noIncome ? undefined : { text: `получено ${money(incomeReceived)}`, color: 'teal' }}
          />
          <StatCard
            label="Кредиты в этом месяце"
            value={money(loanOut)}
            icon={<IconCash size={16} />}
            badge={{ text: `${loanRowsThisMonth.length} платеж(а)`, color: 'gray' }}
          />
          <StatCard
            label="Долг по кредитам"
            value={money(debt)}
            icon={<IconBuildingBank size={16} />}
            badge={lastClose ? { text: `до ${date(lastClose)}`, color: 'brand' } : { text: 'кредитов нет', color: 'gray' }}
          />
        </SimpleGrid>
      )}

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Panel title="Что дальше" subtitle="Ближайшие поступления и платежи по кредитам">
          {events.length === 0 ? (
            <Text size="sm" c="dimmed">
              {loading ? 'Загружаю…' : 'Ничего не запланировано.'}
            </Text>
          ) : (
            <Table verticalSpacing="xs" highlightOnHover>
              <Table.Tbody>
                {events.map((event, index) => (
                  <Table.Tr key={index}>
                    <Table.Td w={110}>
                      <Group gap={6} wrap="nowrap">
                        <IconCalendarDue size={14} />
                        <Text size="sm">{date(event.date)}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Text size="sm" fw={event.date === today ? 600 : undefined}>
                          {event.title}
                        </Text>
                        {event.date === today && <PaymentStatusBadge status="today" />}
                      </Group>
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

        <Panel title="Кредиты" subtitle="Остаток и ближайший платёж">
          <Stack gap="sm">
            {loanList.length === 0 && (
              <Text size="sm" c="dimmed">
                {loading ? 'Загружаю…' : 'Кредитов нет.'}
              </Text>
            )}
            {loanList.map((loan) => (
              <Group key={loan.id} justify="space-between" wrap="nowrap">
                <Stack gap={0}>
                  <Text size="sm" fw={600}>
                    {loan.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    остаток {money(loan.actual.balance)} · закрытие {date(loan.actual.close_date)}
                  </Text>
                </Stack>
                <Group gap="xs" wrap="nowrap">
                  {loan.actual.next_payment && (
                    <Badge variant="light" color="gray" radius="sm">
                      {date(loan.actual.next_payment.date)}: {money(loan.actual.next_payment.payment)}
                    </Badge>
                  )}
                  <Button
                    variant="subtle"
                    size="xs"
                    px={6}
                    onClick={() => (window.location.hash = `#loans/list/${loan.id}`)}
                    aria-label={`Открыть ${loan.name}`}
                  >
                    <IconArrowRight size={16} />
                  </Button>
                </Group>
              </Group>
            ))}
          </Stack>
        </Panel>
      </SimpleGrid>

      <Group gap="sm">
        <Button variant="default" rightSection={<IconArrowRight size={16} />} onClick={() => (window.location.hash = '#income/overview')}>
          Отчёт о доходах
        </Button>
        <Button variant="default" rightSection={<IconArrowRight size={16} />} onClick={() => (window.location.hash = '#loans/list')}>
          Все кредиты
        </Button>
      </Group>
    </Stack>
  );
}
