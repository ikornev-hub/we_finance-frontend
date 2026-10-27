import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
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
  IconArrowsMove,
  IconCheck,
  IconInfoCircle,
  IconListSearch,
  IconPlus,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { expensesApi, loansApi } from '../api/endpoints';
import type { AccountKind, ExpenseAccountIn, ExpenseGroup, LoanSummaryOut, SavingsGoal, ExpenseCategory, ExpenseOperation, RulePreview } from '../api/types';
import { PageHeader, Panel } from '../components/Cards';
import { ErrorAlert, errorText } from '../components/ErrorAlert';
import { CategorySelect, SampleNotice, categoryOptions, monthTitle, useSelectedMonth } from '../components/expenses/common';
import { AnalysisSection } from '../components/expenses/AnalysisSection';
import { BudgetSection } from '../components/expenses/BudgetSection';
import { GoalsSection } from '../components/expenses/GoalsSection';
import { ImportSection } from '../components/expenses/ImportSection';
import { ForecastPanel, GROUP_HINT, MonthTotals, MonthTree } from '../components/expenses/MonthView';
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

export type ExpensesSection = 'budget' | 'month' | 'analysis' | 'goals' | 'review' | 'import' | 'categories' | 'accounts';

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
    case 'analysis':
      return <AnalysisSection />;
    case 'goals':
      return <GoalsSection />;
    case 'budget':
      return <BudgetSection />;
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
  const [month] = useSelectedMonth();
  const [picked, setPicked] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => setPicked(null), [month]);
  const report = useOrSample(() => expensesApi.month(month), SAMPLE_MONTH, month);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <PageHeader title="Расходы" subtitle="Куда ушли деньги за месяц: категории, доли от располагаемого дохода, цели и перерасход." />
        <Group gap="sm">
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
          <ForecastPanel report={report.data} />
          <MonthTree report={report.data} onPick={(id, title) => setPicked({ id, title })} />
          {picked && <CategoryOperations month={month} categoryId={picked.id} title={picked.title} onChanged={report.reload} />}
        </>
      )}
    </Stack>
  );
}

/** Операции категории месяца; перенос операции пересчитывает и сам месяц (onChanged). */
function CategoryOperations({ month, categoryId, title, onChanged }: { month: string; categoryId: string; title: string; onChanged: () => void }) {
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
        <OperationsTable
          operations={operations.data}
          categories={categories.data}
          onChanged={() => {
            operations.reload();
            onChanged();
          }}
        />
      )}
    </Panel>
  );
}

// ---------- разобрать неопределённые ----------

function ReviewSection() {
  const [month] = useSelectedMonth();
  // По умолчанию — выбранный месяц, как в баннере «Ждут разбора: N» (#10).
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const operations = useOrSample(
    () => expensesApi.operations(scope === 'month' ? { uncategorized: true, month } : { uncategorized: true }),
    SAMPLE_UNCATEGORIZED,
    `uncategorized/${scope}/${month}`,
  );
  const categories = useCategories();

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <PageHeader
          title="Без категории"
          subtitle="Выбери категорию. «Запомнить» — система создаст правило для этого получателя или мерчанта, и в следующий раз разложит сама."
        />
        <Group gap="sm">
          <SegmentedControl
            value={scope}
            onChange={(next) => setScope(next as 'month' | 'all')}
            data={[
              { value: 'month', label: monthTitle(month) },
              { value: 'all', label: 'Все месяцы' },
            ]}
          />
        </Group>
      </Group>
      {operations.sample && <SampleNotice what="Операции без категории" />}
      <ErrorAlert error={operations.error} />
      {operations.data && operations.data.length === 0 && (
        <Alert color="teal" radius="lg" variant="light" icon={<IconCheck size={18} />} title="Всё разобрано">
          <Text size="sm">{scope === 'month' ? `В ${monthTitle(month).toLowerCase()} операций без категории нет.` : 'Операций без категории нет.'}</Text>
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
  // Выбор списком: отметить несколько операций и разом поставить им категорию.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const ids = new Set(operations.map((operation) => operation.id));
    setSelected((prev) => new Set([...prev].filter((id) => ids.has(id))));
  }, [operations]);
  const all = operations.length > 0 && selected.size === operations.length;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = async () => {
    if (!bulkCategory || selected.size === 0) return;
    setBusy(true);
    try {
      const result = await expensesApi.setCategories([...selected], bulkCategory);
      const title = categoryOptions(categories).find((option) => option.value === bulkCategory)?.label ?? '';
      notifications.show({ color: 'teal', title: `Разложено: ${result.updated}`, message: `→ ${title}` });
      setSelected(new Set());
      setBulkCategory(null);
      onChanged();
    } catch (error) {
      notifications.show({ color: 'red', title: 'Не сохранилось', message: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="sm">
      {selected.size > 0 && (
        <Group gap="sm" p="sm" style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--mantine-color-body)', borderRadius: 12, border: '1px solid var(--mantine-color-default-border)' }}>
          <Text size="sm" fw={600}>
            Выбрано: {selected.size}
          </Text>
          <CategorySelect categories={categories} value={bulkCategory} onChange={setBulkCategory} width={260} />
          <Button size="sm" disabled={!bulkCategory} loading={busy} onClick={apply}>
            Поставить категорию
          </Button>
          <Button size="sm" variant="subtle" onClick={() => setSelected(new Set())}>
            Снять выбор
          </Button>
        </Group>
      )}
      <Table verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={36}>
              <Checkbox
                aria-label="Выбрать все"
                checked={all}
                indeterminate={selected.size > 0 && !all}
                onChange={() => setSelected(all ? new Set() : new Set(operations.map((operation) => operation.id)))}
              />
            </Table.Th>
            <Table.Th>Дата</Table.Th>
            <Table.Th>Операция</Table.Th>
            <Table.Th ta="right">Сумма</Table.Th>
            <Table.Th>Категория</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {operations.map((operation) => (
            <OperationRow
              key={operation.id}
              operation={operation}
              categories={categories}
              onChanged={onChanged}
              withRemember={withRemember}
              selected={selected.has(operation.id)}
              onSelect={() => toggle(operation.id)}
            />
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

function OperationRow({
  operation,
  categories,
  onChanged,
  withRemember,
  selected,
  onSelect,
}: {
  operation: ExpenseOperation;
  categories: ExpenseCategory[];
  onChanged: () => void;
  withRemember: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const [category, setCategory] = useState<string | null>(withRemember ? null : operation.category_id);
  const [remember, setRemember] = useState(withRemember);
  const save = useAction<unknown>();
  const who = operation.counterparty ?? operation.merchant;
  // Предпросмотр — только когда выбрана категория: иначе запрос на каждую строку при открытии (#12).
  const preview = useRulePreview(operation.id, withRemember && remember && Boolean(who) && category !== null);

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
    <Table.Tr bg={selected ? 'var(--mantine-color-default-hover)' : undefined}>
      <Table.Td>
        <Checkbox aria-label="Выбрать операцию" checked={selected} onChange={onSelect} />
      </Table.Td>
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
          <Text size="xs" c="dimmed" style={{ wordBreak: 'break-word' }}>
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
      <Table.Td ta="right" fw={600} c={Number(operation.amount) > 0 ? 'teal' : undefined} style={{ whiteSpace: 'nowrap' }}>
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

// ---------- категории ----------

function CategoriesSection() {
  const categories = useCategories();
  const groups = useOrSample(() => expensesApi.groups(), [] as ExpenseGroup[], 'groups');
  const [name, setName] = useState('');
  const [parent, setParent] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const change = useAction<unknown>();

  // Пустую группу не показываем (решение 2026-10-27: «Покупки» стали категорией).
  const groupList = (groups.data ?? []).filter((item) => item.category_ids.length > 0);
  const [deleting, setDeleting] = useState<{ id: string; name: string; isTop: boolean; hasChildren: boolean; parentId: string | null } | null>(null);
  const [moving, setMoving] = useState<{ id: string; name: string; isTop: boolean } | null>(null);
  const managed = groupList.find((item) => item.code === 'managed')?.id ?? null;
  const groupOptions = [...groupList.map((item) => ({ value: item.id, label: item.name })), { value: SERVICE, label: 'Служебные' }];
  const codeOf = (groupId: string | null | undefined) => groupList.find((item) => item.id === groupId)?.code ?? 'service';

  /** true — получилось; при ошибке введённое не стираем (#14). */
  const run = async (call: () => Promise<unknown>): Promise<boolean> => {
    try {
      await call();
      categories.reload();
      groups.reload();
      return true;
    } catch (error) {
      if (notImplemented(error)) {
        notifications.show({ color: 'yellow', title: 'Пример', message: 'Изменения заработают, когда backend научится управлять категориями.' });
        return false;
      }
      // Плашка ошибки — вверху страницы, а правят обычно ниже: дублируем уведомлением.
      notifications.show({ color: 'red', title: 'Не сохранилось', message: errorText(error) });
      void change.run(() => Promise.reject(error));
      return false;
    }
  };
  const saved = (title: string, message: string) => (ok: boolean) => ok && notifications.show({ color: 'teal', title, message });

  /** Удаление — с выбором, куда перенести операции и правила (по умолчанию: родитель или разбор). */
  const remove = (category: { id: string; name: string }, isTop: boolean, hasChildren = false, parentId: string | null = null) =>
    setDeleting({ id: category.id, name: category.name, isTop, hasChildren, parentId });
  const uncategorizedId = (categories.data ?? []).find((category) => category.system_code === 'uncategorized')?.id ?? null;

  // Дерево по группам: обязательные, управляемые, неуправляемые, покупки; служебные и «Доход» — в конце.
  const sections = [
    ...groupList.map((item) => ({ key: item.id, title: item.name, items: (categories.data ?? []).filter((category) => category.group_id === item.id) })),
    {
      key: SERVICE,
      title: 'Служебные и доход',
      items: (categories.data ?? []).filter((category) => !category.group_id || !groupList.some((item) => item.id === category.group_id)),
    },
  ];

  return (
    <Stack gap="lg">
      <PageHeader
        title="Категории"
        subtitle="Группы → категории → подкатегории. Обязательные вычитаются из дохода; у остальных групп и их категорий — граница в % располагаемого или суммой."
      />
      {categories.sample && <SampleNotice what="Категории" />}
      <ErrorAlert error={categories.error} />
      <ErrorAlert error={change.error} />

      {groupList.length > 0 && (
        <Panel title="Группы" subtitle="Граница группы — на все её категории сразу">
          <Table verticalSpacing="xs">
            <Table.Tbody>
              {groupList.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <NameInput name={item.name} bold onSave={(next) => run(() => expensesApi.updateGroup(item.id, { name: next }))} />
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {GROUP_HINT[item.code]}
                    </Text>
                  </Table.Td>
                  <Table.Td w={300}>
                    {item.code === 'mandatory' ? (
                      <Text size="xs" c="dimmed">
                        без границы — вычитаются из дохода
                      </Text>
                    ) : (
                      <LimitEditor
                        category={item}
                        onSave={(limit, text) => void run(() => expensesApi.updateGroup(item.id, limit)).then(saved('Граница группы сохранена', `${item.name}: ${text}`))}
                      />
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Panel>
      )}

      <Panel title="Новая категория">
        <Group align="flex-end" gap="sm">
          <TextInput label="Название" value={name} onChange={(event) => setName(event.currentTarget.value)} radius="md" w={220} />
          <Select
            label="Внутри категории"
            placeholder="— верхний уровень —"
            data={(categories.data ?? []).filter((category) => !category.system_code).map((category) => ({ value: category.id, label: category.name }))}
            value={parent}
            onChange={setParent}
            searchable
            nothingFoundMessage="Нет такой"
            clearable
            radius="md"
            w={220}
          />
          {parent === null && groupList.length > 0 && (
            <Select label="Группа" data={groupList.map((item) => ({ value: item.id, label: item.name }))} value={group ?? managed} onChange={setGroup} radius="md" w={180} />
          )}
          <Button
            leftSection={<IconPlus size={16} />}
            disabled={!name.trim()}
            onClick={() =>
              run(() => expensesApi.createCategory({ name: name.trim(), parent_id: parent, ...(parent === null ? { group_id: group ?? managed } : {}) })).then(
                (ok) => ok && setName(''),
              )
            }
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
                <Table.Th w={190}>Группа</Table.Th>
                <Table.Th w={300}>Граница: % располагаемого или сумма</Table.Th>
                <Table.Th w={60} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sections.map((section) => [
                <Table.Tr key={`section-${section.key}`} style={{ background: 'var(--mantine-color-default-hover)' }}>
                  <Table.Td colSpan={4}>
                    <Text size="sm" fw={700}>
                      {section.title}
                    </Text>
                  </Table.Td>
                </Table.Tr>,
                ...section.items.flatMap((category) => [
                  <Table.Tr key={category.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <NameInput name={category.name} bold onSave={(next) => run(() => expensesApi.updateCategory(category.id, { name: next }))} />
                        {category.system_code && (
                          <Badge size="xs" variant="light" color="gray">
                            системная
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {category.system_code !== 'income' && groupList.length > 0 && (
                        <Select
                          size="xs"
                          w={170}
                          data={groupOptions}
                          value={category.group_id ?? SERVICE}
                          allowDeselect={false}
                          onChange={(next) =>
                            next &&
                            void run(() => expensesApi.updateCategory(category.id, { group_id: next === SERVICE ? null : next })).then(
                              saved('Категория перенесена', `${category.name} → ${groupOptions.find((option) => option.value === next)?.label ?? ''}`),
                            )
                          }
                        />
                      )}
                    </Table.Td>
                    <Table.Td>
                      {LIMITED.has(codeOf(category.group_id)) && (
                        <LimitEditor
                          category={category}
                          onSave={(limit, text) => void run(() => expensesApi.updateCategory(category.id, limit)).then(saved('Граница сохранена', `${category.name}: ${text}`))}
                        />
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={2} wrap="nowrap">
                        {!FIXED.has(category.system_code ?? '') && (
                          <Tooltip label="Переместить внутрь другой категории">
                            <ActionIcon variant="subtle" color="gray" onClick={() => setMoving({ id: category.id, name: category.name, isTop: true })} aria-label={`Переместить ${category.name}`}>
                              <IconArrowsMove size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {!category.system_code && (
                          <ActionIcon variant="subtle" color="red" onClick={() => remove(category, true, category.children.length > 0)} aria-label={`Удалить ${category.name}`}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>,
                  ...category.children.map((child) => (
                    <Table.Tr key={child.id}>
                      <Table.Td pl={36}>
                        <NameInput name={child.name} onSave={(next) => run(() => expensesApi.updateCategory(child.id, { name: next }))} />
                      </Table.Td>
                      <Table.Td />
                      <Table.Td />
                      <Table.Td>
                        <Group gap={2} wrap="nowrap">
                          <Tooltip label="Переместить в другую категорию">
                            <ActionIcon variant="subtle" color="gray" onClick={() => setMoving({ id: child.id, name: child.name, isTop: false })} aria-label={`Переместить ${child.name}`}>
                              <IconArrowsMove size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <ActionIcon variant="subtle" color="red" onClick={() => remove(child, false, false, category.id)} aria-label={`Удалить ${child.name}`}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  )),
                ]),
              ])}
            </Table.Tbody>
          </Table>
        </Panel>
      )}

      {deleting && (
        <DeleteCategoryModal
          target={deleting}
          options={categoryOptions(categories.data ?? []).filter(
            (option) => option.value !== deleting.id && !(categories.data ?? []).find((category) => category.id === deleting.id)?.children.some((child) => child.id === option.value),
          )}
          initial={deleting.parentId ?? uncategorizedId}
          onClose={() => setDeleting(null)}
          onConfirm={(moveTo) =>
            void run(() => expensesApi.deleteCategory(deleting.id, moveTo ?? undefined)).then((ok) => {
              if (ok) {
                setDeleting(null);
                saved('Категория удалена', `${deleting.name}: операции и правила перенесены`)(ok);
              }
            })
          }
        />
      )}
      {moving && (
        <MoveCategoryModal
          target={moving}
          options={(categories.data ?? [])
            .filter((category) => category.id !== moving.id && !FIXED.has(category.system_code ?? '') && category.system_code !== 'income')
            .map((category) => ({ value: category.id, label: category.name }))}
          onClose={() => setMoving(null)}
          onConfirm={(parentId) =>
            void run(() => expensesApi.updateCategory(moving.id, { parent_id: parentId })).then((ok) => {
              if (ok) {
                setMoving(null);
                saved('Категория перемещена', moving.name)(ok);
              }
            })
          }
        />
      )}
    </Stack>
  );
}

/** Системные, на которые опирается автоматика: не переносятся внутрь других. */
const FIXED = new Set(['credit', 'housing', 'income', 'own_transfer', 'savings', 'uncategorized', 'cash']);
const TOP = '__top__';

function DeleteCategoryModal({
  target,
  options,
  initial,
  onClose,
  onConfirm,
}: {
  target: { name: string; isTop: boolean; hasChildren: boolean };
  options: { value: string; label: string }[];
  initial: string | null;
  onClose: () => void;
  onConfirm: (moveTo: string | null) => void;
}) {
  const [moveTo, setMoveTo] = useState<string | null>(initial);
  return (
    <Modal opened onClose={onClose} title={`Удалить «${target.name}»?`} radius="lg" centered>
      <Stack gap="sm">
        <Text size="sm">
          {target.hasChildren ? 'Подкатегории удалятся вместе с ней. ' : ''}Все её операции и правила перейдут в выбранную категорию — ничего не потеряется.
        </Text>
        <Select label="Куда перенести операции и правила" data={options} value={moveTo} onChange={setMoveTo} searchable nothingFoundMessage="Нет такой" radius="md" />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button color="red" disabled={!moveTo} onClick={() => onConfirm(moveTo)}>
            Удалить и перенести
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function MoveCategoryModal({
  target,
  options,
  onClose,
  onConfirm,
}: {
  target: { name: string; isTop: boolean };
  options: { value: string; label: string }[];
  onClose: () => void;
  onConfirm: (parentId: string | null) => void;
}) {
  const [parent, setParent] = useState<string | null>(null);
  const data = target.isTop ? options : [{ value: TOP, label: '— сделать категорией верхнего уровня —' }, ...options];
  return (
    <Modal opened onClose={onClose} title={`Переместить «${target.name}»`} radius="lg" centered>
      <Stack gap="sm">
        <Text size="sm">
          Операции и правила остаются с ней. Уровней два: у перемещаемой внутрь категории не должно быть своих подкатегорий.
        </Text>
        <Select label="Внутрь категории" data={data} value={parent} onChange={setParent} searchable nothingFoundMessage="Нет такой" radius="md" />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={!parent} onClick={() => onConfirm(parent === TOP ? null : parent)}>
            Переместить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Значение «Служебные» в выборе группы (у категории group_id = null). */
const SERVICE = 'service';
/** Группы, у которых и у их категорий есть граница. */
const LIMITED = new Set(['managed', 'unmanaged', 'purchases']);


/** Имя категории, которое правится на месте: изменил и ушёл из поля — сохранено. */
function NameInput({ name, bold = false, onSave }: { name: string; bold?: boolean; onSave: (name: string) => void }) {
  return (
    <TextInput
      key={name}
      defaultValue={name}
      variant="unstyled"
      size="sm"
      w={200}
      styles={{ input: { fontWeight: bold ? 600 : 400 } }}
      aria-label="Название категории"
      onBlur={(event) => {
        const next = event.currentTarget.value.trim();
        if (next && next !== name) onSave(next);
        else event.currentTarget.value = name;
      }}
    />
  );
}

/** Граница категории: в % от располагаемого или суммой. Пусто — без границы. */
type Limit = { target_share: string | null } | { target_amount: string | null };

/**
 * Граница категории: в % от располагаемого или суммой. Пусто — без границы.
 * Сохраняется по Enter или при уходе из поля; без изменений сервер не дёргаем.
 */
function LimitEditor({ category, onSave }: { category: { target_share: string | null; target_amount?: string | null }; onSave: (limit: Limit, text: string) => void }) {
  const [mode, setMode] = useState<'share' | 'amount'>(category.target_amount ? 'amount' : 'share');
  const current = mode === 'amount' ? (category.target_amount ? Number(category.target_amount) : undefined) : category.target_share ? Number(category.target_share) * 100 : undefined;
  const save = (raw: string) => {
    const value = raw.replace(/[^\d.,]/g, '').replace(',', '.');
    const number = value ? Number(value) : undefined;
    if (number === current) return;
    if (number === undefined) {
      onSave({ target_share: null }, 'без границы');
      return;
    }
    if (mode === 'amount') onSave({ target_amount: number.toFixed(2) }, money(number.toFixed(2)));
    else onSave({ target_share: String(number / 100) }, `${number.toLocaleString('ru-RU')} % располагаемого`);
  };
  return (
    <Group gap={6} wrap="nowrap">
      <SegmentedControl size="xs" value={mode} onChange={(next) => setMode(next as 'share' | 'amount')} data={[{ value: 'share', label: '%' }, { value: 'amount', label: '₽' }]} />
      <NumberInput
        key={`${mode}-${current ?? ''}`}
        size="xs"
        w={130}
        min={0}
        max={mode === 'share' ? 100 : undefined}
        clampBehavior="strict"
        allowNegative={false}
        decimalScale={2}
        thousandSeparator=" "
        decimalSeparator=","
        suffix={mode === 'share' ? ' %' : ' ₽'}
        defaultValue={current}
        placeholder="без границы"
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        onBlur={(event) => save(event.currentTarget.value)}
      />
    </Group>
  );
}

// ---------- свои счета ----------

const EMPTY_ACCOUNT: ExpenseAccountIn = { bank: 'alfa', name: '', kind: 'own', number_tail: null, phone: null, loan_id: null, goal_id: null };

/** «8 (900) 123-45-67», «+7 900 …», «9001234567» → «+79001234567», как номер в выписке. */
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+7${digits}`;
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) return `+7${digits.slice(1)}`;
  return phone.trim();
}

function useLoans(): LoanSummaryOut[] {
  const [loans, setLoans] = useState<LoanSummaryOut[]>([]);
  useEffect(() => {
    loansApi.list().then(setLoans).catch(() => setLoans([]));
  }, []);
  return loans;
}

function AccountsSection() {
  const accounts = useOrSample(() => expensesApi.accounts(), SAMPLE_ACCOUNTS, 'accounts');
  const [draft, setDraft] = useState<ExpenseAccountIn>(EMPTY_ACCOUNT);
  const change = useAction<unknown>();
  const loans = useLoans();
  const goals = useOrSample(() => expensesApi.goals(), [] as SavingsGoal[], 'goals').data ?? [];
  const loanName = (id: string | null) => loans.find((loan) => loan.id === id)?.name ?? id;
  // Проверка до отправки — по-человечески, а не текстом валидатора (#13).
  const phone = normalizePhone(draft.phone);
  const phoneError = phone && !/^\+7\d{10}$/.test(phone) ? 'Номер из 11 цифр, например 8 900 000-00-00' : null;
  const tailError = draft.number_tail && !/^\d{4}$/.test(draft.number_tail) ? 'Последние 4 цифры счёта' : null;

  const removeAccount = async (account: { id: string; name: string; kind: AccountKind }) => {
    const ok = await confirmAction({
      title: `Удалить «${account.name}»?`,
      message: (
        <Text size="sm">
          {account.kind === 'credit'
            ? 'Переводы на этот счёт в следующих выписках перестанут считаться платежами по кредиту.'
            : 'Переводы на этот номер или счёт в следующих выписках станут обычными тратами. Уже загруженные операции не изменятся.'}
        </Text>
      ),
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (ok) await run(() => expensesApi.deleteAccount(account.id));
  };

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
            onChange={(kind) => setDraft({ ...draft, kind: kind as AccountKind, loan_id: kind === 'credit' ? draft.loan_id : null, goal_id: kind === 'savings' ? draft.goal_id : null })}
            data={[
              { value: 'own', label: 'Свой' },
              { value: 'credit', label: 'Счёт кредита' },
              { value: 'savings', label: 'Накопительный' },
            ]}
          />
          <TextInput label="Название" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.currentTarget.value })} radius="md" w={180} />
          <TextInput label="Банк" value={draft.bank} onChange={(event) => setDraft({ ...draft, bank: event.currentTarget.value })} radius="md" w={110} />
          <TextInput
            label="Телефон"
            placeholder="+79991234567"
            value={draft.phone ?? ''}
            onChange={(event) => setDraft({ ...draft, phone: event.currentTarget.value || null })}
            error={phoneError}
            radius="md"
            w={150}
          />
          <TextInput
            label="Хвост счёта"
            placeholder="1234"
            value={draft.number_tail ?? ''}
            onChange={(event) => setDraft({ ...draft, number_tail: event.currentTarget.value || null })}
            error={tailError}
            radius="md"
            w={110}
          />
          {draft.kind === 'savings' && (
            <Select
              label="Цель"
              placeholder={goals.length ? 'Выбери' : 'Сначала заведи цель'}
              data={goals.map((goal) => ({ value: goal.id, label: goal.name }))}
              value={draft.goal_id ?? null}
              onChange={(goalId) => setDraft({ ...draft, goal_id: goalId })}
              radius="md"
              w={200}
            />
          )}
          {draft.kind === 'credit' && (
            <Select
              label="Кредит"
              placeholder={loans.length ? 'Выбери' : 'Нет кредитов'}
              data={loans.map((loan) => ({ value: loan.id, label: loan.name }))}
              value={draft.loan_id}
              onChange={(loanId) => setDraft({ ...draft, loan_id: loanId })}
              radius="md"
              w={200}
            />
          )}
          <Button leftSection={<IconPlus size={16} />} disabled={!draft.name.trim() || (!draft.phone && !draft.number_tail) || (draft.kind === 'credit' && !draft.loan_id) || (draft.kind === 'savings' && (!draft.goal_id || !draft.number_tail)) || Boolean(phoneError || tailError)}
            onClick={() => run(() => expensesApi.createAccount({ ...draft, phone }))}
          >
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
                    <Badge variant="light" color={account.kind === 'credit' ? 'brand' : account.kind === 'savings' ? 'teal' : 'gray'}>
                      {account.kind === 'credit' ? 'кредит' : account.kind === 'savings' ? 'накопительный' : 'свой'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {account.loan_id ? loanName(account.loan_id) : account.goal_id ? `цель: ${goals.find((goal) => goal.id === account.goal_id)?.name ?? ''}` : ''}
                    </Text>
                  </Table.Td>
                  <Table.Td>{account.phone ?? (account.number_tail ? `…${account.number_tail}` : '—')}</Table.Td>
                  <Table.Td>{account.bank}</Table.Td>
                  <Table.Td w={50}>
                    <ActionIcon variant="subtle" color="red" onClick={() => removeAccount(account)} aria-label={`Удалить ${account.name}`}>
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
