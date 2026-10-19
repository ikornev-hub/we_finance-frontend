import { Alert, Button, Group, Stack, Table, Text } from '@mantine/core';
import { IconArrowLeft, IconChevronRight, IconEye, IconInfoCircle, IconPlus, IconRefresh, IconCash } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { loansApi } from '../api/endpoints';
import type { LoanCreateIn, LoanDetailOut, LoanSummaryOut, Prepayment, PreviewOut } from '../api/types';
import { PageHeader, Panel } from '../components/Cards';
import { ErrorAlert } from '../components/ErrorAlert';
import { AsOfField } from '../components/fields';
import { LoanForm, MODE_OPTIONS, PrepaymentFields } from '../components/loans/LoanForm';
import { CalculationView, PreviewView } from '../components/loans/LoanViews';
import { snapshotLoans, withBackup } from '../lib/backup';
import { confirmAction, notifySaved } from '../lib/confirm';
import { EXAMPLE_LOAN, EXAMPLE_PREPAYMENT, clone } from '../lib/examples';
import { date, money } from '../lib/format';
import { useAction } from '../lib/useAction';

export type LoansSection = 'list' | 'create';

export function LoansPage({ section, param }: { section: LoansSection; param?: string }) {
  if (section === 'create') return <CreateSection />;
  return param ? <DetailSection id={param} /> : <ListSection />;
}

function BackendFileNote() {
  return (
    <Alert color="brand" radius="lg" icon={<IconInfoCircle size={18} />} variant="light">
      <Text size="sm">
        Кредиты пишутся в файл из <b>CREDIT_DATA_PATH</b> бэкенда. Удалить кредит или ЧДП через API нельзя — перед
        каждой записью все кредиты скачиваются бэкапом.
      </Text>
    </Alert>
  );
}

// ---------- список ----------

function ListSection() {
  const [asOf, setAsOf] = useState('');
  const list = useAction<LoanSummaryOut[]>();
  const { run } = list;

  useEffect(() => {
    void run(() => loansApi.list());
  }, [run]);

  return (
    <Stack gap="lg">
      <PageHeader title="Кредиты" subtitle="Сохранённые кредиты: остаток и дата закрытия на выбранную дату. Нажми на строку — откроется карточка." />
      <Panel
        title={list.data ? `Всего: ${list.data.length}` : 'Список'}
        actions={
          <Group align="flex-end" gap="sm">
            <AsOfField value={asOf} onChange={setAsOf} />
            <Button variant="default" leftSection={<IconRefresh size={16} />} loading={list.loading} onClick={() => run(() => loansApi.list(asOf || undefined))}>
              Обновить
            </Button>
          </Group>
        }
      >
        <ErrorAlert error={list.error} />
        {list.data && list.data.length === 0 && (
          <Text size="sm" c="dimmed">
            Кредитов пока нет — добавь в разделе «Новый кредит».
          </Text>
        )}
        {list.data && list.data.length > 0 && (
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Название</Table.Th>
                <Table.Th ta="right">Сумма</Table.Th>
                <Table.Th ta="right">Остаток</Table.Th>
                <Table.Th>Закрытие</Table.Th>
                <Table.Th w={40} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.data.map((loan) => (
                <Table.Tr key={loan.id} style={{ cursor: 'pointer' }} onClick={() => (window.location.hash = `#loans/list/${loan.id}`)}>
                  <Table.Td fw={600}>{loan.name}</Table.Td>
                  <Table.Td ta="right">{money(loan.principal)}</Table.Td>
                  <Table.Td ta="right">{money(loan.balance)}</Table.Td>
                  <Table.Td>{date(loan.close_date)}</Table.Td>
                  <Table.Td>
                    <IconChevronRight size={16} opacity={0.5} />
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

// ---------- карточка кредита + ЧДП ----------

function DetailSection({ id }: { id: string }) {
  const [asOf, setAsOf] = useState('');
  const [prepayment, setPrepayment] = useState<Prepayment>(clone(EXAMPLE_PREPAYMENT));
  const detail = useAction<LoanDetailOut>();
  const preview = useAction<PreviewOut>();
  const add = useAction<LoanDetailOut>();
  const { run } = detail;

  useEffect(() => {
    void run(() => loansApi.detail(id));
  }, [run, id]);

  const addPrepayment = async () => {
    const mode = MODE_OPTIONS.find((option) => option.value === prepayment.mode)?.label ?? prepayment.mode;
    const ok = await confirmAction({
      title: 'Внести ЧДП? Отменить будет нельзя',
      message: (
        <Text size="sm">
          {money(prepayment.amount)} на {date(prepayment.date)}, «{mode}». По требованиям ЧДП нельзя удалить или изменить.
          Перед записью все кредиты скачаются бэкапом.
        </Text>
      ),
      confirmLabel: 'Внести ЧДП',
      danger: true,
    });
    if (!ok) return;
    const updated = await add.run(async () => {
      const { result, backup } = await withBackup('loans', `Перед ЧДП в кредит «${detail.data?.name ?? id}»`, snapshotLoans, () =>
        loansApi.addPrepayment(id, prepayment),
      );
      notifySaved('ЧДП внесён', backup);
      return result;
    });
    if (updated) {
      detail.setData(updated);
      preview.reset();
    }
  };

  return (
    <Stack gap="lg">
      <Group>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => (window.location.hash = '#loans/list')}>
          Все кредиты
        </Button>
      </Group>
      <PageHeader title={detail.data?.name ?? 'Кредит'} subtitle="Стартовые и актуальные данные, итоги ЧДП, график с отметкой «прошёл», история платежей." />
      <Panel>
        <Group align="flex-end" gap="sm">
          <AsOfField value={asOf} onChange={setAsOf} />
          <Button variant="default" leftSection={<IconRefresh size={16} />} loading={detail.loading} onClick={() => run(() => loansApi.detail(id, asOf || undefined))}>
            Показать на дату
          </Button>
        </Group>
        <ErrorAlert error={detail.error} />
      </Panel>

      {detail.data && <CalculationView calculation={detail.data} />}

      {detail.data && (
        <Panel title="Досрочный платёж (ЧДП)" subtitle="Сначала прогноз — он ничего не сохраняет. Внести — навсегда.">
          <Stack gap="md">
            <PrepaymentFields value={prepayment} onChange={setPrepayment} />
            <Group gap="sm">
              <Button variant="default" leftSection={<IconEye size={16} />} loading={preview.loading} onClick={() => preview.run(() => loansApi.preview(id, prepayment))}>
                Прогноз
              </Button>
              <Button color="red" variant="light" leftSection={<IconCash size={16} />} loading={add.loading} onClick={addPrepayment}>
                Внести ЧДП
              </Button>
            </Group>
            <BackendFileNote />
            <ErrorAlert error={preview.error} />
            <ErrorAlert error={add.error} />
            {preview.data && <PreviewView preview={preview.data} />}
          </Stack>
        </Panel>
      )}
    </Stack>
  );
}

// ---------- новый кредит ----------

function CreateSection() {
  const [loan, setLoan] = useState<LoanCreateIn>(clone(EXAMPLE_LOAN));
  const create = useAction<LoanDetailOut>();

  const submit = async () => {
    const ok = await confirmAction({
      title: 'Создать кредит на бэкенде?',
      message: (
        <Text size="sm">
          «{loan.name}» на {money(loan.principal)} сохранится в файл кредитов. Удалить его через API нельзя. Перед записью
          текущие кредиты скачаются бэкапом.
        </Text>
      ),
      confirmLabel: 'Создать',
    });
    if (!ok) return;
    const created = await create.run(async () => {
      const { result, backup } = await withBackup('loans', `Перед созданием кредита «${loan.name}»`, snapshotLoans, () => loansApi.create(loan));
      notifySaved('Кредит создан', backup);
      return result;
    });
    if (created) window.location.hash = `#loans/list/${created.id}`;
  };

  return (
    <Stack gap="lg">
      <PageHeader title="Новый кредит" subtitle="Параметры по договору. Заполнено учебным примером из требований." />
      <LoanForm value={loan} onChange={setLoan} withName />
      <Panel>
        <Stack gap="md">
          <Group gap="sm">
            <Button variant="default" onClick={() => setLoan(clone(EXAMPLE_LOAN))}>
              Учебный пример
            </Button>
            <Button leftSection={<IconPlus size={16} />} loading={create.loading} onClick={submit}>
              Создать кредит
            </Button>
          </Group>
          <BackendFileNote />
          <ErrorAlert error={create.error} />
        </Stack>
      </Panel>
    </Stack>
  );
}
