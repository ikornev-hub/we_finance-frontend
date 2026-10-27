import { Badge, Group, Progress, SimpleGrid, Stack, Table, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconArrowDownRight, IconArrowUpRight, IconChevronDown, IconChevronRight, IconScale, IconWallet } from '@tabler/icons-react';
import { Fragment, useState } from 'react';

import type { MonthCategory, MonthGroup, MonthReport } from '../../api/types';
import { money } from '../../lib/format';
import { HeroCard, Panel, StatCard } from '../Cards';
import { percent } from './common';

/** Что показывает граница и остаток: у группы и у категории одинаковые поля. */
type Limited = Pick<MonthCategory, 'limit_mode' | 'target_share' | 'target' | 'remaining'>;

/** Итоги месяца: сколько ещё можно потратить (прогноз), доходы, расходы, остаток по факту. */
export function MonthTotals({ report }: { report: MonthReport }) {
  const overspent = Number(report.forecast.can_spend) < 0;
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
      <HeroCard
        label={report.closed ? 'Осталось по итогам месяца' : 'Можно ещё потратить'}
        value={money(report.forecast.can_spend)}
        caption={`Располагаемый ${money(report.forecast.disposable)}${Number(report.forecast.savings) > 0 ? ` − в цели ${money(report.forecast.savings)}` : ''} − потрачено ${money(report.forecast.spent)}`}
        icon={<IconWallet size={18} />}
      />
      <StatCard label="Доходы" value={money(report.income)} icon={<IconArrowDownRight size={16} />} badge={{ text: 'по выписке', color: 'teal' }} />
      <StatCard
        label="Расходы"
        value={money(report.expenses)}
        icon={<IconArrowUpRight size={16} />}
        badge={overspent ? { text: 'больше располагаемого', color: 'red' } : { text: 'все группы', color: 'gray' }}
      />
      <StatCard
        label="Остаток месяца"
        value={money(report.balance)}
        icon={<IconScale size={16} />}
        hint={Number(report.saved) ? `доходы − расходы − отложено ${money(report.saved)}` : 'доходы − расходы по выписке'}
      />
    </SimpleGrid>
  );
}

/** Прогноз «план + факт»: откуда взялся располагаемый и сколько из него распределено границами. */
export function ForecastPanel({ report }: { report: MonthReport }) {
  const f = report.forecast;
  const mandatory = report.groups.find((group) => group.code === 'mandatory');
  const names = mandatory?.categories.map((category) => category.name.toLowerCase()).join(', ') ?? '';
  const rows: [string, string, string][] = [
    ['Доход', money(f.income), report.closed ? 'по выписке' : 'больше из: расчёт «Доходов» и факт по выписке'],
    ['− Обязательные', money(f.mandatory), names],
    ['= Располагаемый', money(f.disposable), 'от него доли и границы'],
    ['− Отложить на цели', money(f.savings), report.closed ? 'отложено по факту' : 'сначала себе: план целей (отложил больше — по факту)'],
    ['− Потрачено', money(f.spent), 'всё, кроме обязательных'],
    ['= Можно ещё', money(f.can_spend), report.closed ? 'осталось по итогам месяца' : 'до конца месяца'],
    ['Границами распределено', money(f.limits_total), `не распределено ${money(f.unallocated)} (после целей)`],
  ];
  return (
    <Panel
      title={report.closed ? 'Итог месяца' : 'Прогноз месяца'}
      subtitle={report.closed ? 'Месяц закончился — всё по факту выписки' : 'План + факт: в середине месяца доли не прыгают, пока не пришла зарплата'}
    >
      {report.warnings.map((warning) => (
        <Text key={warning} size="sm" c="orange" mb={4}>
          {warning}
        </Text>
      ))}
      <Table verticalSpacing={6}>
        <Table.Tbody>
          {rows.map(([label, value, hint]) => (
            <Table.Tr key={label}>
              <Table.Td>
                <Text size="sm" fw={label.startsWith('=') ? 700 : 500}>
                  {label}
                </Text>
              </Table.Td>
              <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                <Text size="sm" fw={label.startsWith('=') ? 700 : 500}>
                  {value}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="xs" c="dimmed">
                  {hint}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Panel>
  );
}

/** «15 % (14 925 ₽)» — граница в той форме, в какой задана, и вторая в скобках. */
export function limitLabel(item: Limited): string {
  if (item.target === null && item.limit_mode === null) return '—';
  if (item.limit_mode === 'amount') return `${money(item.target)} (${percent(item.target_share)})`;
  return `${percent(item.target_share)}${item.target ? ` (${money(item.target)})` : ''}`;
}

export function RemainingBadge({ category }: { category: Limited }) {
  if (category.remaining === null) return <>—</>;
  const over = Number(category.remaining) < 0;
  return (
    <Tooltip label={over ? 'Перерасход: факт больше границы' : 'Сколько ещё можно потратить до границы'}>
      <Badge variant="light" color={over ? 'red' : 'teal'} radius="sm">
        {over ? `перерасход ${money(String(-Number(category.remaining)))}` : `ещё ${money(category.remaining)}`}
      </Badge>
    </Tooltip>
  );
}

/** Заполнение полоски: от границы, если она есть, иначе от самой большой суммы рядом. */
export function fill(item: Limited & { amount: string }, max: number): number {
  const value = item.target ? (Number(item.amount) / Number(item.target)) * 100 : (Number(item.amount) / max) * 100;
  return Math.min(value, 100);
}

export const GROUP_HINT: Record<MonthGroup['code'], string> = {
  mandatory: 'вычитаются из дохода; доля — от дохода',
  managed: 'сколько тратить, решаешь сам',
  unmanaged: 'случаются, планировать трудно',
  purchases: 'вещи и разовые покупки',
  service: 'не статья трат: перекладывание и ещё не разобранное',
};

/** Группы → категории → подкатегории: факт ₽ и %, граница, сколько ещё можно. Клик по категории — её операции. */
export function MonthTree({ report, onPick }: { report: MonthReport; onPick?: (categoryId: string, title: string) => void }) {
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };
  const max = Math.max(...report.categories.map((category) => Number(category.amount)), 1);
  const groupMax = Math.max(...report.groups.map((group) => Number(group.amount)), 1);

  return (
    <Panel title="Куда ушли деньги" subtitle="Группы → категории → подкатегории. Нажми на группу — свернуть; на категорию — подкатегории; на подкатегорию — операции">
      <Table verticalSpacing="xs" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Группа / категория</Table.Th>
            <Table.Th ta="right">Факт</Table.Th>
            <Table.Th ta="right">Доля</Table.Th>
            <Table.Th ta="right">Граница</Table.Th>
            <Table.Th ta="right">Можно ещё</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {report.groups.map((group) => {
            const groupKey = group.code;
            const groupOpen = !closedGroups.has(groupKey);
            const groupOver = group.remaining !== null && Number(group.remaining) < 0;
            return (
              <Fragment key={groupKey}>
                <Table.Tr style={{ cursor: 'pointer', background: 'var(--mantine-color-default-hover)' }} onClick={() => setClosedGroups((prev) => toggle(prev, groupKey))}>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      {groupOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                      <Stack gap={2} w="100%">
                        <Group gap="xs">
                          <Text size="sm" fw={700}>
                            {group.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {GROUP_HINT[group.code]}
                          </Text>
                        </Group>
                        <Progress value={fill(group, groupMax)} size="xs" color={groupOver ? 'red' : group.target ? 'teal' : 'gray'} />
                      </Stack>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right" fw={700} style={{ whiteSpace: 'nowrap' }}>
                    {money(group.amount)}
                  </Table.Td>
                  <Table.Td ta="right" fw={600}>
                    {percent(group.share)}
                  </Table.Td>
                  <Table.Td ta="right" c="dimmed">
                    {limitLabel(group)}
                  </Table.Td>
                  <Table.Td ta="right">
                    <RemainingBadge category={group} />
                  </Table.Td>
                </Table.Tr>
                {groupOpen &&
                  group.categories.map((category) => (
                    <CategoryRows
                      key={category.id}
                      category={category}
                      max={max}
                      expanded={open.has(category.id)}
                      onToggle={() => setOpen((prev) => toggle(prev, category.id))}
                      onPick={onPick}
                    />
                  ))}
              </Fragment>
            );
          })}
        </Table.Tbody>
      </Table>
      <UnstyledButton mt="sm" onClick={() => setOpen(new Set(report.categories.map((category) => category.id)))}>
        <Text size="xs" c="dimmed">
          Раскрыть все категории
        </Text>
      </UnstyledButton>
    </Panel>
  );
}

function CategoryRows({
  category,
  max,
  expanded,
  onToggle,
  onPick,
}: {
  category: MonthCategory;
  max: number;
  expanded: boolean;
  onToggle: () => void;
  onPick?: (categoryId: string, title: string) => void;
}) {
  const over = category.remaining !== null && Number(category.remaining) < 0;
  return (
    <>
      <Table.Tr style={{ cursor: 'pointer' }} onClick={() => (category.children.length ? onToggle() : onPick?.(category.id, category.name))}>
        <Table.Td pl={28}>
          <Group gap={6} wrap="nowrap">
            {category.children.length > 0 ? expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} /> : <span style={{ width: 14 }} />}
            <Stack gap={2} w="100%">
              <Group gap="xs">
                <Text size="sm" fw={600}>
                  {category.name}
                </Text>
                {category.system_code === 'uncategorized' && Number(category.amount) !== 0 && (
                  <Badge size="xs" color="orange" variant="light">
                    разобрать
                  </Badge>
                )}
              </Group>
              <Progress value={fill(category, max)} size="xs" color={over ? 'red' : category.target ? 'teal' : 'brand'} />
            </Stack>
          </Group>
        </Table.Td>
        <Table.Td ta="right" fw={600} style={{ whiteSpace: 'nowrap' }}>
          {money(category.amount)}
        </Table.Td>
        <Table.Td ta="right">{percent(category.share)}</Table.Td>
        <Table.Td ta="right" c="dimmed">
          {limitLabel(category)}
        </Table.Td>
        <Table.Td ta="right">
          <RemainingBadge category={category} />
        </Table.Td>
      </Table.Tr>
      {expanded &&
        category.children.map((child) => (
          <Table.Tr key={child.id} style={{ cursor: 'pointer' }} onClick={() => onPick?.(child.id, `${category.name} / ${child.name}`)}>
            <Table.Td pl={64}>
              <Text size="sm">{child.name}</Text>
            </Table.Td>
            <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
              {money(child.amount)}
            </Table.Td>
            <Table.Td ta="right">{percent(child.share)}</Table.Td>
            <Table.Td />
            <Table.Td />
          </Table.Tr>
        ))}
    </>
  );
}
