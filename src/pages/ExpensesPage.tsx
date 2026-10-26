import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  FileInput,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconFileSpreadsheet,
  IconInfoCircle,
  IconListSearch,
  IconPlus,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { expensesApi } from '../api/endpoints';
import type { AccountKind, ExpenseAccountIn, ExpenseCategory, ExpenseOperation, ImportResult, RulePreview } from '../api/types';
import { PageHeader, Panel } from '../components/Cards';
import { ErrorAlert } from '../components/ErrorAlert';
import { CategorySelect, MonthSwitch, SampleNotice, currentMonth, monthTitle } from '../components/expenses/common';
import { MonthTotals, MonthTree } from '../components/expenses/MonthView';
import { confirmAction } from '../lib/confirm';
import {
  SAMPLE_ACCOUNTS,
  SAMPLE_CATEGORIES,
  SAMPLE_MONTH,
  SAMPLE_UNCATEGORIZED,
  sampleOperations,
} from '../lib/expenseSamples';
import { date, money } from '../lib/format';
import { notImplemented, useOrSample } from '../lib/sample';
import { useAction } from '../lib/useAction';

export type ExpensesSection = 'month' | 'review' | 'import' | 'categories' | 'accounts';

const go = (section: ExpensesSection) => () => (window.location.hash = `#expenses/${section}`);

const TYPE_LABEL: Record<string, string> = {
  income: 'Доход',
  card: 'Покупка',
  payment: 'Платёж',
  transfer_own: 'Себе',
  transfer_credit: 'В кредит',
  transfer_person: 'Перевод',
  transfer_in: 'Входящий',
};

export function ExpensesPage({ section }: { section: ExpensesSection }) {
  switch (section) {
    case 'review':
      return <ReviewSection />;
    case 'import':
      return <ImportSection />;
    case 'categories':
      return <CategoriesSection />;
    case 'accounts':
      return <AccountsSection />;
    default:
      return <MonthSection />;
  }
}

function useCategories() {
  return useOrSample(() => expensesApi.categories(), SAMPLE_CATEGORIES, 'categories');
}

// ---------- месяц ----------

function MonthSection() {
  const [month, setMonth] = useState(currentMonth());
  const [picked, setPicked] = useState<{ id: string; title: string } | null>(null);
  const report = useOrSample(() => expensesApi.month(month), SAMPLE_MONTH, month);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <PageHeader title="Расходы" subtitle="Куда ушли деньги за месяц: категории, доли от располагаемого дохода, цели и перерасход." />
        <Group gap="sm">
          <MonthSwitch month={month} onChange={(next) => { setMonth(next); setPicked(null); }} />
          <Button variant="default" leftSection={<IconUpload size={16} />} onClick={go('import')}>
            Загрузить выписку
          </Button>
        </Group>
      </Group>
      {report.sample && <SampleNotice what={`Месяц ${monthTitle(month)}`} />}
      <ErrorAlert error={report.error} />
      {report.data && (
        <>
          <MonthTotals report={report.data} />
          {report.data.uncategorized_count > 0 && (
            <Alert color="orange" radius="lg" variant="light" icon={<IconListSearch size={18} />} title={`Без категории: ${report.data.uncategorized_count}`}>
              <Group justify="space-between">
                <Text size="sm">Разбери их — система запомнит получателя, и в следующем месяце они разложатся сами.</Text>
                <Button size="xs" color="orange" variant="light" onClick={go('review')}>
                  Разобрать
                </Button>
              </Group>
            </Alert>
          )}
          <MonthTree report={report.data} onPick={(id, title) => setPicked({ id, title })} />
          {picked && <CategoryOperations month={month} categoryId={picked.id} title={picked.title} />}
        </>
      )}
    </Stack>
  );
}

function CategoryOperations({ month, categoryId, title }: { month: string; categoryId: string; title: string }) {
  const operations = useOrSample(
    () => expensesApi.operations({ month, category_id: categoryId }),
    sampleOperations(categoryId),
    `${month}/${categoryId}`,
  );
  const categories = useCategories();
  return (
    <Panel title={`Операции: ${title}`} subtitle="Можно перенести операцию в другую категорию">
      {operations.sample && <SampleNotice what="Операции" />}
      <ErrorAlert error={operations.error} />
      {operations.data && categories.data && (
        <OperationsTable operations={operations.data} categories={categories.data} onChanged={operations.reload} />
      )}
    </Panel>
  );
}

// ---------- разобрать неопределённые ----------

function ReviewSection() {
  const operations = useOrSample(() => expensesApi.operations({ uncategorized: true }), SAMPLE_UNCATEGORIZED, 'uncategorized');
  const categories = useCategories();

  return (
    <Stack gap="lg">
      <PageHeader
        title="Без категории"
        subtitle="Выбери категорию. «Запомнить» — система создаст правило для этого получателя или мерчанта, и в следующий раз разложит сама."
      />
      {operations.sample && <SampleNotice what="Операции без категории" />}
      <ErrorAlert error={operations.error} />
      {operations.data && operations.data.length === 0 && (
        <Alert color="teal" radius="lg" variant="light" icon={<IconCheck size={18} />} title="Всё разобрано">
          <Text size="sm">Операций без категории нет.</Text>
        </Alert>
      )}
      {operations.data && operations.data.length > 0 && categories.data && (
        <Panel title={`Осталось: ${operations.data.length}`}>
          <OperationsTable operations={operations.data} categories={categories.data} onChanged={operations.reload} withRemember />
        </Panel>
      )}
    </Stack>
  );
}

function OperationsTable({
  operations,
  categories,
  onChanged,
  withRemember = false,
}: {
  operations: ExpenseOperation[];
  categories: ExpenseCategory[];
  onChanged: () => void;
  withRemember?: boolean;
}) {
  return (
    <Table verticalSpacing="sm" highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Дата</Table.Th>
          <Table.Th>Операция</Table.Th>
          <Table.Th ta="right">Сумма</Table.Th>
          <Table.Th>Категория</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {operations.map((operation) => (
          <OperationRow key={operation.id} operation={operation} categories={categories} onChanged={onChanged} withRemember={withRemember} />
        ))}
      </Table.Tbody>
    </Table>
  );
}

function OperationRow({
  operation,
  categories,
  onChanged,
  withRemember,
}: {
  operation: ExpenseOperation;
  categories: ExpenseCategory[];
  onChanged: () => void;
  withRemember: boolean;
}) {
  const [category, setCategory] = useState<string | null>(withRemember ? null : operation.category_id);
  const [remember, setRemember] = useState(withRemember);
  const save = useAction<unknown>();
  const who = operation.counterparty ?? operation.merchant;
  const preview = useRulePreview(operation.id, withRemember && remember && Boolean(who));

  const submit = async () => {
    if (!category) return;
    try {
      const result = await expensesApi.setCategory(operation.id, category, remember);
      notifications.show({
        color: 'teal',
        title: 'Категория сохранена',
        message: result.rule
          ? `Запомнил: «${result.rule.pattern}» → эта категория` + (result.applied.length ? `. Ещё разложено: ${result.applied.length}` : '')
          : 'Только для этой операции',
      });
      onChanged();
    } catch (error) {
      if (notImplemented(error)) {
        notifications.show({ color: 'yellow', title: 'Пример', message: 'Сохранение заработает, когда backend научится переносить операции.' });
        return;
      }
      void save.run(() => Promise.reject(error));
    }
  };

  return (
    <Table.Tr>
      <Table.Td w={100}>{date(operation.operated_at)}</Table.Td>
      <Table.Td>
        <Stack gap={2}>
          <Group gap="xs">
            <Badge size="xs" variant="light" color="gray">
              {TYPE_LABEL[operation.type] ?? operation.type}
            </Badge>
            <Text size="sm" fw={600}>
              {who ?? '—'}
            </Text>
          </Group>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {operation.description}
          </Text>
          {preview && <SimilarList preview={preview} />}
          {withRemember && !who && (
            <Text size="xs" c="dimmed">
              Запомнить нечего: в выписке нет ни получателя, ни магазина. Такие разбираются вручную.
            </Text>
          )}
          <ErrorAlert error={save.error} />
        </Stack>
      </Table.Td>
      <Table.Td ta="right" fw={600} c={Number(operation.amount) > 0 ? 'teal' : undefined}>
        {money(operation.amount)}
      </Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <CategorySelect categories={categories} value={category} onChange={setCategory} width={230} />
          {withRemember && who && (
            <Tooltip label={`Всегда относить «${who}» сюда`}>
              <Checkbox checked={remember} onChange={(event) => setRemember(event.currentTarget.checked)} label="Запомнить" size="xs" />
            </Tooltip>
          )}
          <ActionIcon variant="light" size="lg" disabled={!category || category === operation.category_id} onClick={submit} aria-label="Сохранить">
            <IconCheck size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

/** Что заберёт «Запомнить» — грузится, только пока галочка стоит. Пример (404/405) — ничего не показываем. */
function useRulePreview(operationId: string, enabled: boolean): RulePreview | null {
  const [preview, setPreview] = useState<RulePreview | null>(null);
  useEffect(() => {
    if (!enabled) {
      setPreview(null);
      return;
    }
    let alive = true;
    expensesApi
      .similar(operationId)
      .then((result) => alive && setPreview(result))
      .catch(() => alive && setPreview(null));
    return () => {
      alive = false;
    };
  }, [operationId, enabled]);
  return preview;
}

function SimilarList({ preview }: { preview: RulePreview }) {
  if (preview.operations.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        Других таких без категории нет — правило сработает на следующих выписках.
      </Text>
    );
  }
  return (
    <Stack gap={2} mt={4}>
      <Text size="xs" fw={600} c="orange">
        Сюда же лягут ещё {preview.operations.length}:
      </Text>
      {preview.operations.map((similar) => (
        <Text key={similar.id} size="xs" c="dimmed">
          {date(similar.operated_at)} · {money(similar.amount)} · {similar.description}
        </Text>
      ))}
    </Stack>
  );
}

// ---------- загрузить выписку ----------

function ImportSection() {
  const [bank, setBank] = useState('alfa');
  const [file, setFile] = useState<File | null>(null);
  const upload = useAction<ImportResult>();

  return (
    <Stack gap="lg">
      <PageHeader title="Загрузить выписку" subtitle="Раз в месяц: выгрузи выписку в банке и загрузи сюда. Уже загруженные операции не задвоятся." />
      <Panel>
        <Stack gap="md">
          <SegmentedControl
            value={bank}
            onChange={setBank}
            data={[
              { value: 'alfa', label: 'Альфа-Банк (XLSX)' },
              { value: 'ozon', label: 'Озон Банк (PDF) — скоро', disabled: true },
            ]}
          />
          <FileInput
            label="Файл выписки"
            placeholder="Выбери файл"
            accept=".xlsx"
            value={file}
            onChange={setFile}
            leftSection={<IconFileSpreadsheet size={16} />}
            radius="md"
            clearable
          />
          <Group>
            <Button leftSection={<IconUpload size={16} />} disabled={!file} loading={upload.loading} onClick={() => file && upload.run(() => expensesApi.importStatement(bank, file))}>
              Загрузить
            </Button>
          </Group>
          <ErrorAlert error={upload.error} />
          {upload.data && (
            <Alert color="teal" radius="lg" variant="light" icon={<IconCheck size={18} />} title="Выписка загружена">
              <Stack gap="xs">
                <Text size="sm">
                  Операций: <b>{upload.data.total}</b> · новых: <b>{upload.data.new}</b> · уже были: <b>{upload.data.duplicates}</b> · без категории:{' '}
                  <b>{upload.data.uncategorized}</b>
                </Text>
                <Group gap="sm">
                  {upload.data.uncategorized > 0 && (
                    <Button size="xs" color="orange" variant="light" onClick={go('review')}>
                      Разобрать без категории
                    </Button>
                  )}
                  <Button size="xs" variant="light" onClick={go('month')}>
                    К месяцу
                  </Button>
                </Group>
              </Stack>
            </Alert>
          )}
        </Stack>
      </Panel>
    </Stack>
  );
}

// ---------- категории ----------

function CategoriesSection() {
  const categories = useCategories();
  const [name, setName] = useState('');
  const [parent, setParent] = useState<string | null>(null);
  const change = useAction<unknown>();

  const run = async (call: () => Promise<unknown>) => {
    try {
      await call();
      categories.reload();
    } catch (error) {
      if (notImplemented(error)) {
        notifications.show({ color: 'yellow', title: 'Пример', message: 'Изменения заработают, когда backend научится управлять категориями.' });
        return;
      }
      void change.run(() => Promise.reject(error));
    }
  };

  const remove = async (category: { id: string; name: string }, hasChildren: boolean) => {
    const ok = await confirmAction({
      title: `Удалить «${category.name}»?`,
      message: (
        <Text size="sm">
          {hasChildren
            ? 'Её операции и подкатегории уйдут в «Неопределённые», правила для неё удалятся.'
            : 'Её операции перейдут в родительскую категорию, правила для неё удалятся.'}
        </Text>
      ),
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (ok) await run(() => expensesApi.deleteCategory(category.id));
  };

  return (
    <Stack gap="lg">
      <PageHeader title="Категории" subtitle="Дерево трат: категории и подкатегории. Есть стартовые — меняй как удобно. Системные не удаляются: на них опирается автоматика." />
      {categories.sample && <SampleNotice what="Категории" />}
      <ErrorAlert error={categories.error} />
      <ErrorAlert error={change.error} />
      <Panel title="Новая категория">
        <Group align="flex-end" gap="sm">
          <TextInput label="Название" value={name} onChange={(event) => setName(event.currentTarget.value)} radius="md" w={220} />
          <Select
            label="Внутри категории"
            placeholder="— верхний уровень —"
            data={(categories.data ?? []).filter((category) => !category.system_code).map((category) => ({ value: category.id, label: category.name }))}
            value={parent}
            onChange={setParent}
            clearable
            radius="md"
            w={220}
          />
          <Button
            leftSection={<IconPlus size={16} />}
            disabled={!name.trim()}
            onClick={() => run(() => expensesApi.createCategory({ name: name.trim(), parent_id: parent })).then(() => setName(''))}
          >
            Добавить
          </Button>
        </Group>
      </Panel>
      {categories.data && (
        <Panel title="Дерево">
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Категория</Table.Th>
                <Table.Th w={200}>Цель, % располагаемого</Table.Th>
                <Table.Th w={60} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {categories.data.map((category) => [
                <Table.Tr key={category.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <Text fw={600} size="sm">
                        {category.name}
                      </Text>
                      {category.system_code && (
                        <Badge size="xs" variant="light" color="gray">
                          системная
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    {!category.system_code && (
                      <NumberInput
                        size="xs"
                        w={120}
                        min={0}
                        max={100}
                        suffix=" %"
                        defaultValue={category.target_share ? Number(category.target_share) * 100 : undefined}
                        placeholder="нет цели"
                        onBlur={(event) => {
                          const value = event.currentTarget.value.replace(/[^\d.,]/g, '').replace(',', '.');
                          void run(() => expensesApi.updateCategory(category.id, { target_share: value ? String(Number(value) / 100) : null }));
                        }}
                      />
                    )}
                  </Table.Td>
                  <Table.Td>
                    {!category.system_code && (
                      <ActionIcon variant="subtle" color="red" onClick={() => remove(category, category.children.length > 0)} aria-label={`Удалить ${category.name}`}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    )}
                  </Table.Td>
                </Table.Tr>,
                ...category.children.map((child) => (
                  <Table.Tr key={child.id}>
                    <Table.Td pl={36}>
                      <Text size="sm">{child.name}</Text>
                    </Table.Td>
                    <Table.Td />
                    <Table.Td>
                      <ActionIcon variant="subtle" color="red" onClick={() => remove(child, false)} aria-label={`Удалить ${child.name}`}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                )),
              ])}
            </Table.Tbody>
          </Table>
        </Panel>
      )}
    </Stack>
  );
}

// ---------- свои счета ----------

const EMPTY_ACCOUNT: ExpenseAccountIn = { bank: 'alfa', name: '', kind: 'own', number_tail: null, phone: null, loan_id: null };

function AccountsSection() {
  const accounts = useOrSample(() => expensesApi.accounts(), SAMPLE_ACCOUNTS, 'accounts');
  const [draft, setDraft] = useState<ExpenseAccountIn>(EMPTY_ACCOUNT);
  const change = useAction<unknown>();

  const run = async (call: () => Promise<unknown>) => {
    try {
      await call();
      accounts.reload();
      setDraft(EMPTY_ACCOUNT);
    } catch (error) {
      if (notImplemented(error)) {
        notifications.show({ color: 'yellow', title: 'Пример', message: 'Изменения заработают, когда backend научится хранить счета.' });
        return;
      }
      void change.run(() => Promise.reject(error));
    }
  };

  return (
    <Stack gap="lg">
      <PageHeader
        title="Свои счета и номера"
        subtitle="Переводы на свои счета и номера — не траты. Перевод на счёт кредита — расход «Кредит»."
      />
      {accounts.sample && <SampleNotice what="Счета" />}
      <Alert color="blue" radius="lg" variant="light" icon={<IconInfoCircle size={18} />}>
        <Text size="sm">
          Счёт кредита называй так, как банк пишет его в выписке (например, «ОТП Банк»): по этому имени система узнаёт перевод в кредит.
        </Text>
      </Alert>
      <ErrorAlert error={accounts.error} />
      <ErrorAlert error={change.error} />
      <Panel title="Добавить">
        <Group align="flex-end" gap="sm">
          <SegmentedControl
            value={draft.kind}
            onChange={(kind) => setDraft({ ...draft, kind: kind as AccountKind })}
            data={[
              { value: 'own', label: 'Свой' },
              { value: 'credit', label: 'Счёт кредита' },
            ]}
          />
          <TextInput label="Название" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.currentTarget.value })} radius="md" w={180} />
          <TextInput label="Банк" value={draft.bank} onChange={(event) => setDraft({ ...draft, bank: event.currentTarget.value })} radius="md" w={110} />
          <TextInput
            label="Телефон"
            placeholder="+79991234567"
            value={draft.phone ?? ''}
            onChange={(event) => setDraft({ ...draft, phone: event.currentTarget.value || null })}
            radius="md"
            w={150}
          />
          <TextInput
            label="Хвост счёта"
            placeholder="1234"
            value={draft.number_tail ?? ''}
            onChange={(event) => setDraft({ ...draft, number_tail: event.currentTarget.value || null })}
            radius="md"
            w={110}
          />
          {draft.kind === 'credit' && (
            <TextInput
              label="Кредит (id)"
              value={draft.loan_id ?? ''}
              onChange={(event) => setDraft({ ...draft, loan_id: event.currentTarget.value || null })}
              radius="md"
              w={160}
            />
          )}
          <Button leftSection={<IconPlus size={16} />} disabled={!draft.name.trim() || (!draft.phone && !draft.number_tail)} onClick={() => run(() => expensesApi.createAccount(draft))}>
            Добавить
          </Button>
        </Group>
      </Panel>
      {accounts.data && (
        <Panel title={`Счетов: ${accounts.data.length}`}>
          <Table verticalSpacing="xs">
            <Table.Tbody>
              {accounts.data.map((account) => (
                <Table.Tr key={account.id}>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {account.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={account.kind === 'credit' ? 'brand' : 'gray'}>
                      {account.kind === 'credit' ? 'кредит' : 'свой'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{account.phone ?? (account.number_tail ? `…${account.number_tail}` : '—')}</Table.Td>
                  <Table.Td>{account.bank}</Table.Td>
                  <Table.Td w={50}>
                    <ActionIcon variant="subtle" color="red" onClick={() => run(() => expensesApi.deleteAccount(account.id))} aria-label={`Удалить ${account.name}`}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Panel>
      )}
    </Stack>
  );
}
