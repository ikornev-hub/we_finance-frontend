import { Alert, Badge, Button, Group, SegmentedControl, Stack, Table, Text } from '@mantine/core';
import {
  IconArchive,
  IconArrowLeft,
  IconCash,
  IconChevronRight,
  IconCircleCheck,
  IconEye,
  IconInfoCircle,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { loansApi } from '../api/endpoints';
import type { LoanCreateIn, LoanDetailOut, LoanStatus, LoanSummaryOut, Prepayment, PreviewOut } from '../api/types';
import { PageHeader, Panel } from '../components/Cards';
import { ErrorAlert } from '../components/ErrorAlert';
import { AsOfField } from '../components/fields';
import { LoanForm, MODE_OPTIONS, PrepaymentFields } from '../components/loans/LoanForm';
import { CalculationView, PreviewView } from '../components/loans/LoanViews';
import { confirmAction, notifyDone } from '../lib/confirm';
import { EXAMPLE_LOAN, EXAMPLE_PREPAYMENT, clone } from '../lib/examples';
import { date, money } from '../lib/format';
import { useAction } from '../lib/useAction';

export type LoansSection = 'list' | 'archive' | 'create';

export function LoansPage({ section, param }: { section: LoansSection; param?: string }) {
  if (section === 'create') return <CreateSection />;
  if (param) return <DetailSection id={param} back={section} />;
  return section === 'archive' ? <ArchiveSection /> : <ListSection />;
}

function StorageNote() {
  return (
    <Alert color="brand" radius="lg" icon={<IconInfoCircle size={18} />} variant="light">
      <Text size="sm">
        Кредиты хранятся в базе бэкенда (Postgres). Кредит и ЧДП после записи не меняются и не удаляются — история
        платежей остаётся такой, какой её внесли. Копии базы — забота сервера, а не браузера.
      </Text>
    </Alert>
  );
}

// ---------- список ----------

const STATUS_BADGE: Record<LoanStatus, { text: string; color: string }> = {
  active: { text: 'Активный', color: 'teal' },
  completed: { text: 'Завершён', color: 'gray' },
  deleted: { text: 'Удалён', color: 'red' },
};

function LoansTable({ loans, section }: { loans: LoanSummaryOut[]; section: LoansSection }) {
  return (
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
        {loans.map((loan) => (
          <Table.Tr key={loan.id} style={{ cursor: 'pointer' }} onClick={() => (window.location.hash = `#loans/${section}/${loan.id}`)}>
            <Table.Td>
              <Group gap="xs">
                <Text fw={600} size="sm">
                  {loan.name}
                </Text>
                {loan.can_complete && (
                  <Badge variant="light" color="teal" radius="sm" size="sm">
                    выплачен
                  </Badge>
                )}
              </Group>
            </Table.Td>
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
  );
}

function ListSection() {
  const [asOf, setAsOf] = useState('');
  const list = useAction<LoanSummaryOut[]>();
  const { run } = list;

  useEffect(() => {
    void run(() => loansApi.list());
  }, [run]);

  return (
    <Stack gap="lg">
      <PageHeader title="Кредиты" subtitle="Активные кредиты: остаток и дата закрытия на выбранную дату. Нажми на строку — откроется карточка." />
      <Panel
        title={list.data ? `Активных: ${list.data.length}` : 'Список'}
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
            Активных кредитов нет — добавь в разделе «Новый кредит» или загляни в «Архив».
          </Text>
        )}
        {list.data && list.data.length > 0 && <LoansTable loans={list.data} section="list" />}
      </Panel>
    </Stack>
  );
}

// ---------- архив: завершённые и удалённые ----------

function ArchiveSection() {
  const [status, setStatus] = useState<LoanStatus>('completed');
  const list = useAction<LoanSummaryOut[]>();
  const { run } = list;

  useEffect(() => {
    void run(() => loansApi.list(undefined, status));
  }, [run, status]);

  return (
    <Stack gap="lg">
      <PageHeader
        title="Архив"
        subtitle="Завершённые — выплаченные, учитываются во всех расчётах. Удалённые — не учитываются нигде, их можно восстановить."
      />
      <Panel
        title={list.data ? `${status === 'completed' ? 'Завершённых' : 'Удалённых'}: ${list.data.length}` : 'Архив'}
        actions={
          <SegmentedControl
            radius="xl"
            value={status}
            onChange={(value) => setStatus(value as LoanStatus)}
            data={[
              { value: 'completed', label: 'Завершённые' },
              { value: 'deleted', label: 'Удалённые' },
            ]}
          />
        }
      >
        <ErrorAlert error={list.error} />
        {list.data && list.data.length === 0 && (
          <Text size="sm" c="dimmed">
            Здесь пусто.
          </Text>
        )}
        {list.data && list.data.length > 0 && <LoansTable loans={list.data} section="archive" />}
      </Panel>
    </Stack>
  );
}

// ---------- карточка кредита + ЧДП ----------

function DetailSection({ id, back }: { id: string; back: LoansSection }) {
  const [asOf, setAsOf] = useState('');
  const [prepayment, setPrepayment] = useState<Prepayment>(clone(EXAMPLE_PREPAYMENT));
  const detail = useAction<LoanDetailOut>();
  const preview = useAction<PreviewOut>();
  const add = useAction<LoanDetailOut>();
  const change = useAction<LoanDetailOut>();
  const { run } = detail;

  const changeStatus = async (action: 'remove' | 'complete' | 'restore') => {
    const name = detail.data?.name ?? 'кредит';
    const texts = {
      remove: {
        title: `Удалить «${name}»?`,
        message: 'Кредит уйдёт в «Архив → Удалённые» и перестанет учитываться в расчётах. Его можно восстановить.',
        label: 'Удалить',
        done: 'Кредит в «Удалённых»',
      },
      complete: {
        title: `Перевести «${name}» в завершённые?`,
        message: 'Кредит выплачен. Он уйдёт из «Мои кредиты» в «Архив → Завершённые» и продолжит учитываться в статистике.',
        label: 'В завершённые',
        done: 'Кредит в «Завершённых»',
      },
      restore: {
        title: `Восстановить «${name}»?`,
        message: 'Кредит вернётся туда, откуда его удалили, со всеми ЧДП.',
        label: 'Восстановить',
        done: 'Кредит восстановлен',
      },
    }[action];
    const ok = await confirmAction({
      title: texts.title,
      message: <Text size="sm">{texts.message}</Text>,
      confirmLabel: texts.label,
      danger: action === 'remove',
    });
    if (!ok) return;
    const updated = await change.run(() => loansApi[action](id));
    if (updated) {
      detail.setData(updated);
      notifyDone(texts.done, '');
    }
  };

  useEffect(() => {
    void run(() => loansApi.detail(id));
  }, [run, id]);

  const addPrepayment = async () => {
    const mode = MODE_OPTIONS.find((option) => option.value === prepayment.mode)?.label ?? prepayment.mode;
    const ok = await confirmAction({
      title: 'Внести ЧДП? Отменить будет нельзя',
      message: (
        <Text size="sm">
          {money(prepayment.amount)} на {date(prepayment.date)}, «{mode}». По требованиям ЧДП нельзя удалить или изменить:
          он навсегда останется в истории кредита.
        </Text>
      ),
      confirmLabel: 'Внести ЧДП',
      danger: true,
    });
    if (!ok) return;
    const updated = await add.run(async () => {
      const result = await loansApi.addPrepayment(id, prepayment);
      notifyDone('ЧДП внесён', 'Записан в базу и добавлен в историю кредита.');
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
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => (window.location.hash = `#loans/${back}`)}>
          {back === 'archive' ? 'Архив' : 'Все кредиты'}
        </Button>
        {detail.data && (
          <Badge variant="light" radius="sm" color={STATUS_BADGE[detail.data.status].color}>
            {STATUS_BADGE[detail.data.status].text}
          </Badge>
        )}
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

      {detail.data?.can_complete && (
        <Alert color="teal" radius="lg" variant="light" icon={<IconCircleCheck size={18} />} title="Кредит выплачен">
          <Group justify="space-between">
            <Text size="sm">Остаток долга — 0. Можно убрать его в архив завершённых: в статистике он останется.</Text>
            <Button size="xs" color="teal" leftSection={<IconArchive size={14} />} loading={change.loading} onClick={() => changeStatus('complete')}>
              В архив завершённых
            </Button>
          </Group>
        </Alert>
      )}
      {detail.data?.status === 'deleted' && (
        <Alert color="red" radius="lg" variant="light" icon={<IconTrash size={18} />} title="Кредит удалён">
          <Group justify="space-between">
            <Text size="sm">Он не учитывается ни в каких расчётах, и ЧДП в него не вносятся.</Text>
            <Button size="xs" variant="light" color="red" leftSection={<IconRestore size={14} />} loading={change.loading} onClick={() => changeStatus('restore')}>
              Восстановить
            </Button>
          </Group>
        </Alert>
      )}
      <ErrorAlert error={change.error} />

      {detail.data && <CalculationView calculation={detail.data} />}

      {detail.data?.status === 'active' && (
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
            <StorageNote />
            <ErrorAlert error={preview.error} />
            <ErrorAlert error={add.error} />
            {preview.data && <PreviewView preview={preview.data} />}
          </Stack>
        </Panel>
      )}
      {detail.data && detail.data.status !== 'deleted' && (
        <Group justify="flex-end">
          <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} loading={change.loading} onClick={() => changeStatus('remove')}>
            Удалить кредит
          </Button>
        </Group>
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
          «{loan.name}» на {money(loan.principal)} сохранится в базу. Удалить или изменить его через API нельзя.
        </Text>
      ),
      confirmLabel: 'Создать',
    });
    if (!ok) return;
    const created = await create.run(async () => {
      const result = await loansApi.create(loan);
      notifyDone('Кредит создан', 'Записан в базу.');
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
          <StorageNote />
          <ErrorAlert error={create.error} />
        </Stack>
      </Panel>
    </Stack>
  );
}
