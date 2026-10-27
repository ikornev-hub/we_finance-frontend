import { Alert, Badge, Button, Group, NumberInput, Progress, SegmentedControl, Slider, Stack, Table, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconDeviceFloppy, IconRefresh } from '@tabler/icons-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { expensesApi } from '../../api/endpoints';
import type { MonthGroup, MonthReport, SavingsGoal } from '../../api/types';
import { useOrSample } from '../../lib/sample';
import { PageHeader, Panel } from '../Cards';
import { ErrorAlert, errorText } from '../ErrorAlert';
import { monthTitle, shiftMonth, useSelectedMonth } from './common';
import { isShare, limitPatch } from '../../lib/limits';
import { ForecastBlock } from './ForecastBlock';
import classes from './BudgetSection.module.css';

// Пульт месяца: на что разложен доход (план) и сколько уже ушло (факт); границы трат
// и взносы целей правятся здесь же — рублями в поле или ползунком в % располагаемого
// (доход − обязательные, решение заказчика 2026-10-27).

const COLOR: Record<string, string> = {
  mandatory: 'gray.6',
  managed: 'brand.6',
  unmanaged: 'red.5',
  purchases: 'violet.5',
  goals: 'teal.6',
  free: 'green.3',
};

const LIMITED = new Set(['managed', 'unmanaged', 'purchases']);

const OF_MONTH = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
/** «2026-11» → «ноября 2026». */
const fromMonth = (month: string) => `${OF_MONTH[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
const rub = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`;
const pct = (value: number, base: number) => (base > 0 ? (value / base) * 100 : 0);
/** База ≤ 0 — доли нет («—»), как `share = null` в API. */
const pctText = (value: number, base: number) =>
  base > 0 ? `${pct(value, base).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} %` : '—';

/** Черновик: id → сумма в месяц (null — без границы). */
type Draft = Record<string, number | null>;

/** Как сейчас хранится каждая граница: доля или сумма (новая — суммой). */
function initialModes(report: MonthReport): Record<string, 'share' | 'amount'> {
  const modes: Record<string, 'share' | 'amount'> = {};
  for (const group of report.groups) {
    if (group.id) modes[group.id] = isShare(group) ? 'share' : 'amount';
    for (const category of group.categories) modes[category.id] = isShare(category) ? 'share' : 'amount';
  }
  return modes;
}

function initialDraft(report: MonthReport, goals: SavingsGoal[]): { groups: Draft; categories: Draft; goals: Draft } {
  const groups: Draft = {};
  const categories: Draft = {};
  for (const group of report.groups) {
    if (!group.id || !LIMITED.has(group.code)) continue;
    groups[group.id] = group.target === null ? null : Number(group.target);
    for (const category of group.categories) categories[category.id] = category.target === null ? null : Number(category.target);
  }
  return { groups, categories, goals: Object.fromEntries(goals.map((goal) => [goal.id, Number(goal.plan)])) };
}

/** Сколько группа забирает из располагаемого — как на backend: своя граница или сумма границ категорий. */
function groupTake(group: MonthGroup, groups: Draft, categories: Draft): number {
  const own = group.id ? groups[group.id] : null;
  if (own !== null && own !== undefined) return own;
  return group.categories.reduce((sum, category) => sum + (categories[category.id] ?? 0), 0);
}

/** Последний день месяца «2027-04» → «2027-04-30». */
function lastDay(month: string): string {
  const [year, number] = month.split('-').map(Number);
  return `${month}-${String(new Date(year, number, 0).getDate()).padStart(2, '0')}`;
}

/** Цель «к сроку»: при взносе monthly — к какому месяцу соберётся (от месяца month). */
function goalFinish(goal: SavingsGoal, monthly: number, month: string): string | null {
  const left = Number(goal.target_amount) - Number(goal.saved_before_month);
  if (left <= 0) return month;
  if (monthly <= 0) return null;
  const start = goal.start_date && goal.start_date.slice(0, 7) > month ? goal.start_date.slice(0, 7) : month;
  return shiftMonth(start, Math.ceil(left / monthly) - 1);
}

/** Как хранится граница: долей располагаемого (идёт за доходом) или суммой. */
type Mode = 'share' | 'amount';

/** Поле рублей (или % располагаемого) + ползунок в %; у границ — переключатель «₽ / %». */
function Amount({
  value,
  base,
  onChange,
  allowEmpty = true,
  disabled = false,
  mode,
  onMode,
}: {
  value: number | null;
  base: number;
  onChange: (value: number | null) => void;
  allowEmpty?: boolean;
  disabled?: boolean;
  mode?: Mode;
  onMode?: (mode: Mode) => void;
}) {
  const asShare = mode === 'share' && base > 0;
  return (
    <Group gap="sm" wrap="nowrap" justify="flex-end">
      <Slider
        visibleFrom="sm"
        w={160}
        min={0}
        max={100}
        step={0.5}
        value={Math.min(pct(value ?? 0, base), 100)}
        onChange={(share) => onChange(Math.round((base * share) / 100 / 100) * 100)}
        label={(share) => `${share} %`}
        size="sm"
        disabled={disabled || base <= 0}
      />
      <NumberInput
        w={{ base: 92, sm: 120 }}
        size="xs"
        radius="md"
        value={value === null ? '' : asShare ? Math.round((value / base) * 1000) / 10 : value}
        placeholder={allowEmpty ? 'нет' : '0'}
        min={0}
        max={asShare ? 100 : undefined}
        step={asShare ? 0.5 : 1000}
        thousandSeparator=" "
        decimalScale={asShare ? 1 : 0}
        suffix={asShare ? ' %' : ' ₽'}
        disabled={disabled}
        onChange={(next) =>
          onChange(next === '' ? (allowEmpty ? null : 0) : asShare ? Math.round((base * Number(next)) / 100) : Number(next))
        }
      />
      {mode && onMode && (
        <SegmentedControl
          size="xs"
          value={mode}
          onChange={(next) => onMode(next as Mode)}
          data={[
            { value: 'amount', label: '₽' },
            { value: 'share', label: '%' },
          ]}
          disabled={disabled || base <= 0}
          aria-label="Граница в рублях или в процентах располагаемого"
        />
      )}
    </Group>
  );
}

/** Факт против границы: тонкая полоса, перебор — красным. */
function FactBar({ amount, target }: { amount: number; target: number | null }) {
  if (!target) return null;
  const share = (amount / target) * 100;
  return <Progress value={Math.min(share, 100)} color={share > 100 ? 'red' : share > 85 ? 'orange' : 'teal'} size={4} mt={4} radius="xl" />;
}

export function BudgetSection() {
  const [month] = useSelectedMonth();
  const report = useOrSample(() => expensesApi.month(month), null as unknown as MonthReport, `budget/${month}`);
  const goalsData = useOrSample(() => expensesApi.goals(month), [] as SavingsGoal[], `budget-goals/${month}`);
  const data = report.data;
  const goals = useMemo(() => goalsData.data ?? [], [goalsData.data]);

  const [draft, setDraft] = useState<{ groups: Draft; categories: Draft; goals: Draft } | null>(null);
  const [modes, setModes] = useState<Record<string, Mode>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data) {
      setDraft(initialDraft(data, goals));
      setModes(initialModes(data));
    }
  }, [data, goals]);

  if (report.error) return <ErrorAlert error={report.error} />;
  if (!data || !draft) return <Text c="dimmed">Загружаю…</Text>;

  const initial = initialDraft(data, goals);
  const income = Number(data.forecast.income);
  const mandatory = Number(data.forecast.mandatory);
  const disposable = income - mandatory;
  const savings = goals.reduce((sum, goal) => sum + (draft.goals[goal.id] ?? 0), 0);
  const limitedGroups = data.groups.filter((group) => LIMITED.has(group.code));
  const takes = limitedGroups.map((group) => ({ group, take: groupTake(group, draft.groups, draft.categories) }));
  const limits = takes.reduce((sum, item) => sum + item.take, 0);
  const free = income - mandatory - savings - limits;
  const mandatoryGroup = data.groups.find((group) => group.code === 'mandatory');

  const startModes = initialModes(data);
  const changed = (kind: 'groups' | 'categories' | 'goals') =>
    Object.keys(draft[kind]).filter(
      (id) => draft[kind][id] !== initial[kind][id] || (kind !== 'goals' && draft[kind][id] !== null && modes[id] !== startModes[id]),
    );
  const modeOf = (id: string): Mode => modes[id] ?? 'amount';
  const setMode = (id: string, mode: Mode) => setModes({ ...modes, [id]: mode });
  const dirty = changed('groups').length + changed('categories').length + changed('goals').length;
  const set = (kind: 'groups' | 'categories' | 'goals', id: string, value: number | null) => setDraft({ ...draft, [kind]: { ...draft[kind], [id]: value } });

  const plan = [
    { key: 'mandatory', label: 'Обязательные', value: mandatory },
    ...takes.map(({ group, take }) => ({ key: group.code, label: group.name, value: take })),
    { key: 'goals', label: 'Цели', value: savings },
    { key: 'free', label: 'Свободно', value: Math.max(free, 0) },
  ];
  const fact = [
    ...data.groups.filter((group) => group.code !== 'service').map((group) => ({ key: group.code, label: group.name, value: Number(group.amount) })),
    { key: 'goals', label: 'Отложено', value: Number(data.saved) },
  ];
  const factTotal = fact.reduce((sum, item) => sum + item.value, 0);
  const scale = Math.max(income, mandatory + savings + limits, factTotal);

  const save = async () => {
    setSaving(true);
    try {
      // Граница хранится в выбранной форме: «%» — долей располагаемого (идёт за доходом), «₽» — суммой (#24).
      for (const id of changed('groups')) await expensesApi.updateGroup(id, limitPatch(draft.groups[id] ?? null, modeOf(id) === 'share', disposable));
      for (const id of changed('categories'))
        await expensesApi.updateCategory(id, limitPatch(draft.categories[id] ?? null, modeOf(id) === 'share', disposable));
      for (const id of changed('goals')) {
        const goal = goals.find((item) => item.id === id)!;
        const monthly = draft.goals[id] ?? 0;
        const finish = goal.deadline ? goalFinish(goal, monthly, month) : null;
        await expensesApi.updateGoal(id, {
          name: goal.name,
          target_amount: goal.target_amount,
          initial_amount: goal.initial_amount,
          start_date: goal.start_date,
          loan_id: goal.loan_id,
          // «к сроку»: взнос двигает срок; «взносом» — меняется сам взнос
          deadline: goal.deadline ? (finish ? lastDay(finish) : goal.deadline) : null,
          monthly_amount: goal.deadline ? null : monthly.toFixed(2),
        });
      }
      notifications.show({ color: 'teal', title: 'Сохранено', message: `Изменений: ${dirty}` });
      report.reload();
      goalsData.reload();
    } catch (error) {
      notifications.show({ color: 'red', title: 'Не сохранилось', message: errorText(error) });
    } finally {
      setSaving(false);
    }
  };

  const bar = (items: { key: string; label: string; value: number }[]) => (
    <Progress.Root size={30} radius="md">
      {items
        .filter((item) => item.value > 0)
        .map((item) => (
          <Tooltip key={item.key + item.label} label={`${item.label}: ${rub(item.value)} · ${pctText(item.value, income)} дохода`}>
            <Progress.Section value={pct(item.value, scale)} color={COLOR[item.key] ?? 'gray.4'}>
              {pct(item.value, scale) > 8 && <Progress.Label>{item.label}</Progress.Label>}
            </Progress.Section>
          </Tooltip>
        ))}
    </Progress.Root>
  );

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <PageHeader title="Бюджет и границы" subtitle="Куда идёт доход месяца: обязательные, траты по границам, цели и свободное. Двигай — итог пересчитается сразу." />
      </Group>

      <Panel title={`Доход ${monthTitle(month).toLowerCase()}: ${rub(income)}`} subtitle="План — как разложен доход; факт — сколько уже ушло по выписке">
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            План
          </Text>
          {bar(plan)}
          <Text size="xs" c="dimmed" mt="xs">
            Факт
          </Text>
          {factTotal > 0 ? (
            bar(fact)
          ) : (
            <Text size="sm" c="dimmed">
              Факта ещё нет: выписки за этот месяц нет.
            </Text>
          )}
          <Group gap="lg" mt="xs">
            {plan.map((item) => (
              <Group key={item.key + item.label} gap={6}>
                <div
                  style={{ width: 10, height: 10, borderRadius: 3, background: `var(--mantine-color-${(COLOR[item.key] ?? 'gray.4').replace('.', '-')})` }}
                />
                <Text size="xs">
                  {item.label} {rub(item.value)}
                </Text>
              </Group>
            ))}
          </Group>
          <Group justify="space-between" mt="sm">
            <Text fw={600}>Свободно</Text>
            <Text fw={700} size="xl" c={free < 0 ? 'red' : 'teal'}>
              {rub(free)}{' '}
              <Text span size="sm" c="dimmed">
                ({pctText(free, disposable)} располагаемого)
              </Text>
            </Text>
          </Group>
          {free < 0 && (
            <Alert color="red" variant="light" radius="md" icon={<IconAlertTriangle size={18} />}>
              Разложено больше дохода на {rub(-free)}. Урежь границы или взносы — иначе цели поделят остаток пропорционально и сдвинутся.
            </Alert>
          )}
        </Stack>
      </Panel>

      <Panel
        title="Соотношение"
        subtitle={`Граница — сколько можно потратить за месяц. Ползунок — % располагаемого (доход − обязательные = ${rub(disposable)}), поле — рубли. Границы общие для всех месяцев.`}
        actions={
          <Group gap="xs">
            <Button variant="default" size="xs" leftSection={<IconRefresh size={14} />} disabled={!dirty || saving} onClick={() => setDraft(initial)}>
              Сбросить
            </Button>
            <Button size="xs" leftSection={<IconDeviceFloppy size={14} />} disabled={!dirty} loading={saving} onClick={save}>
              Сохранить{dirty ? ` (${dirty})` : ''}
            </Button>
          </Group>
        }
      >
        <Table verticalSpacing="xs" highlightOnHover className={classes.ratio}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Статья</Table.Th>
              <Table.Th ta="right">Факт</Table.Th>
              <Table.Th ta="right">Доля</Table.Th>
              <Table.Th ta="right">Сколько в месяц</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {mandatoryGroup && (
              <>
                <GroupRow name={mandatoryGroup.name} color={COLOR.mandatory} amount={Number(mandatoryGroup.amount)} share={`${pctText(mandatory, income)} дохода`}>
                  <Text size="sm" c="dimmed">
                    {rub(mandatory)} по плану
                  </Text>
                </GroupRow>
                {mandatoryGroup.categories.map((category) => (
                  <Table.Tr key={category.id}>
                    <Table.Td pl="xl">
                      <Text size="sm">{category.name}</Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm">{rub(Number(category.amount))}</Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" c="dimmed">
                        {pctText(Number(category.amount), income)}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="xs" c="dimmed">
                        не урезать
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </>
            )}

            {takes.map(({ group, take }) => {
              const inner = group.categories.reduce((sum, category) => sum + (draft.categories[category.id] ?? 0), 0);
              const own = group.id ? draft.groups[group.id] : null;
              return (
                <Fragment key={group.code}>
                  <GroupRow name={group.name} color={COLOR[group.code]} amount={Number(group.amount)} share={pctText(take, disposable)} target={take}>
                    {group.id && (
                      <Amount
                        value={own ?? null}
                        base={disposable}
                        onChange={(value) => set('groups', group.id!, value)}
                        mode={modeOf(group.id)}
                        onMode={(mode) => setMode(group.id!, mode)}
                      />
                    )}
                    {own !== null && own !== undefined && (
                      <Text size="xs" c={inner > own ? 'orange' : 'dimmed'} ta="right">
                        {inner > own
                          ? `в категориях ${rub(inner)} — больше границы группы`
                          : `в категориях ${rub(inner)} из ${rub(own)}; категории делят границу группы, «Свободно» меняет только она`}
                      </Text>
                    )}
                  </GroupRow>
                  {group.categories.map((category) => (
                    <Table.Tr key={category.id}>
                      <Table.Td pl="xl">
                        <Text size="sm">{category.name}</Text>
                        <FactBar amount={Number(category.amount)} target={draft.categories[category.id] ?? null} />
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" c={draft.categories[category.id] && Number(category.amount) > draft.categories[category.id]! ? 'red' : undefined}>
                          {rub(Number(category.amount))}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" c="dimmed">
                          {draft.categories[category.id] ? pctText(draft.categories[category.id]!, disposable) : '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Amount
                          value={draft.categories[category.id] ?? null}
                          base={disposable}
                          onChange={(value) => set('categories', category.id, value)}
                          mode={modeOf(category.id)}
                          onMode={(mode) => setMode(category.id, mode)}
                        />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Fragment>
              );
            })}

            {goals.length > 0 && (
              <GroupRow name="Цели" color={COLOR.goals} amount={Number(data.saved)} share={pctText(savings, disposable)} target={savings}>
                <Text size="sm" c="dimmed">
                  {rub(savings)} в месяц
                </Text>
              </GroupRow>
            )}
            {goals.map((goal) => {
              const monthly = draft.goals[goal.id] ?? 0;
              const finish = goal.deadline ? goalFinish(goal, monthly, month) : null;
              const moved = goal.deadline && monthly !== initial.goals[goal.id];
              const waits = goal.start_date !== null && goal.start_date.slice(0, 7) > month;
              // Кредит «к дате»: ЧДП считает график кредита — здесь только смотреть, дату меняют в «Целях».
              const fixedLoan = Boolean(goal.loan_id && goal.deadline);
              return (
                <Table.Tr key={goal.id}>
                  <Table.Td pl="xl">
                    <Text size="sm">{goal.name}</Text>
                    <Text size="xs" c={moved ? 'orange' : 'dimmed'}>
                      {goal.loan_id
                        ? goal.closes_on
                          ? `${fixedLoan ? 'ЧДП к дате, ' : ''}закроешь ${goal.closes_on.split('-').reverse().join('.')}${monthly !== initial.goals[goal.id] ? ' (пересчитается после сохранения)' : ''}`
                          : 'кредит'
                        : waits
                          ? `копить с ${fromMonth(goal.start_date!.slice(0, 7))}`
                          : goal.deadline
                            ? finish
                              ? `${moved ? 'срок сдвинется: ' : 'к сроку: '}${monthTitle(moved ? finish : goal.deadline.slice(0, 7)).toLowerCase()}`
                              : 'взнос 0 — не соберётся'
                            : 'взнос в месяц'}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">{rub(Number(goal.saved))}</Text>
                    <Text size="xs" c="dimmed">
                      из {rub(Number(goal.target_amount))}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" c="dimmed">
                      {pctText(monthly, disposable)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Amount
                      value={monthly}
                      base={disposable}
                      allowEmpty={false}
                      disabled={waits || fixedLoan}
                      onChange={(value) => set('goals', goal.id, value ?? 0)}
                    />
                  </Table.Td>
                </Table.Tr>
              );
            })}

            <Table.Tr>
              <Table.Td>
                <Group gap={8}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--mantine-color-green-3)' }} />
                  <Text fw={600}>Свободно</Text>
                </Group>
              </Table.Td>
              <Table.Td />
              <Table.Td ta="right">
                <Text fw={600} c={free < 0 ? 'red' : undefined}>
                  {pctText(free, disposable)}
                </Text>
              </Table.Td>
              <Table.Td ta="right">
                <Badge size="lg" variant="light" color={free < 0 ? 'red' : 'teal'}>
                  {rub(free)}
                </Badge>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Panel>

      <ForecastBlock
        disposable={disposable}
        shareIds={new Set(data.categories.filter(isShare).map((category) => category.id))}
        onChanged={() => {
          report.reload();
          goalsData.reload();
        }}
      />
    </Stack>
  );
}

function GroupRow({
  name,
  color,
  amount,
  share,
  target,
  children,
}: {
  name: string;
  color: string;
  amount: number;
  share: string;
  target?: number;
  children: ReactNode;
}) {
  return (
    <Table.Tr bg="var(--mantine-color-default-hover)">
      <Table.Td>
        <Group gap={8}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: `var(--mantine-color-${color.replace('.', '-')})` }} />
          <Text fw={600}>{name}</Text>
        </Group>
        {target ? <FactBar amount={amount} target={target} /> : null}
      </Table.Td>
      <Table.Td ta="right">
        <Text fw={600}>{rub(amount)}</Text>
      </Table.Td>
      <Table.Td ta="right">
        <Text fw={600}>{share}</Text>
      </Table.Td>
      <Table.Td>{children}</Table.Td>
    </Table.Tr>
  );
}
