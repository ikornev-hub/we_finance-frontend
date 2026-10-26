import { Badge, Group, Progress, SimpleGrid, Stack, Table, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconArrowDownRight, IconArrowUpRight, IconChevronDown, IconChevronRight, IconScale, IconWallet } from '@tabler/icons-react';
import { useState } from 'react';

import type { MonthCategory, MonthReport } from '../../api/types';
import { money } from '../../lib/format';
import { HeroCard, Panel, StatCard } from '../Cards';
import { percent } from './common';

/** Итоги месяца: сколько ещё можно потратить (прогноз), доходы, расходы, остаток по факту. */
export function MonthTotals({ report }: { report: MonthReport }) {
  const overspent = Number(report.forecast.can_spend) < 0;
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
      <HeroCard
        label={report.closed ? 'Осталось по итогам месяца' : 'Можно ещё потратить'}
        value={money(report.forecast.can_spend)}
        caption={`Располагаемый ${money(report.forecast.disposable)} − потрачено ${money(report.forecast.spent)}`}
        icon={<IconWallet size={18} />}
      />
      <StatCard label="Доходы" value={money(report.income)} icon={<IconArrowDownRight size={16} />} badge={{ text: 'по выписке', color: 'teal' }} />
      <StatCard
        label="Расходы"
        value={money(report.expenses)}
        icon={<IconArrowUpRight size={16} />}
        badge={overspent ? { text: 'больше располагаемого', color: 'red' } : { text: 'с кредитом и жильём', color: 'gray' }}
      />
      <StatCard label="Остаток месяца" value={money(report.balance)} icon={<IconScale size={16} />} hint="доходы − расходы по выписке" />
    </SimpleGrid>
  );
}

/** Прогноз «план + факт»: откуда взялся располагаемый и сколько из него распределено границами. */
export function ForecastPanel({ report }: { report: MonthReport }) {
  const f = report.forecast;
  const rows: [string, string, string][] = [
    ['Доход', money(f.income), 'больше из: расчёт «Доходов» и факт по выписке'],
    ['− Кредит', money(f.credit), 'больше из: график «Кредитов» и переводы в кредит'],
    ['− Жильё', money(f.housing), 'больше из: правило аренды и факт'],
    ['= Располагаемый', money(f.disposable), 'от него доли и границы'],
    ['Потрачено', money(f.spent), 'всё, кроме кредита и жилья'],
    ['Границами распределено', money(f.limits_total), `не распределено ${money(f.unallocated)}`],
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
              <Table.Td ta="right">
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

/** «12,3 % · граница 15 % (15 000 ₽)» — граница в той форме, в какой задана, и вторая в скобках. */
export function limitLabel(category: MonthCategory): string {
  if (category.target === null && category.limit_mode === null) return '—';
  if (category.limit_mode === 'amount') return `${money(category.target)} (${percent(category.target_share)})`;
  return `${percent(category.target_share)}${category.target ? ` (${money(category.target)})` : ''}`;
}

export function RemainingBadge({ category }: { category: MonthCategory }) {
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

/** Дерево категорий месяца: факт ₽ и %, граница, сколько ещё можно. Клик по строке — её операции. */
export function MonthTree({ report, onPick }: { report: MonthReport; onPick?: (categoryId: string, title: string) => void }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const max = Math.max(...report.categories.map((category) => Number(category.amount)), 1);

  return (
    <Panel title="Куда ушли деньги" subtitle="Факт и доля от располагаемого, рядом — граница и сколько ещё можно. Нажми на категорию — подкатегории; на подкатегорию — операции">
      <Table verticalSpacing="xs" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Категория</Table.Th>
            <Table.Th ta="right">Факт</Table.Th>
            <Table.Th ta="right">Доля</Table.Th>
            <Table.Th ta="right">Граница</Table.Th>
            <Table.Th ta="right">Можно ещё</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {report.categories.map((category) => {
            const expanded = open.has(category.id);
            const over = category.remaining !== null && Number(category.remaining) < 0;
            const required = category.system_code === 'credit' || category.system_code === 'housing';
            const fill = category.target ? (Number(category.amount) / Number(category.target)) * 100 : (Number(category.amount) / max) * 100;
            return [
              <Table.Tr key={category.id} style={{ cursor: 'pointer' }} onClick={() => (category.children.length ? toggle(category.id) : onPick?.(category.id, category.name))}>
                <Table.Td>
                  <Group gap={6} wrap="nowrap">
                    {category.children.length > 0 ? expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} /> : <span style={{ width: 14 }} />}
                    <Stack gap={2} w="100%">
                      <Group gap="xs">
                        <Text size="sm" fw={600}>
                          {category.name}
                        </Text>
                        {required && (
                          <Badge size="xs" color="gray" variant="light">
                            обязательное
                          </Badge>
                        )}
                        {category.system_code === 'uncategorized' && Number(category.amount) !== 0 && (
                          <Badge size="xs" color="orange" variant="light">
                            разобрать
                          </Badge>
                        )}
                      </Group>
                      <Progress value={Math.min(fill, 100)} size="xs" color={over ? 'red' : category.target ? 'teal' : 'brand'} />
                    </Stack>
                  </Group>
                </Table.Td>
                <Table.Td ta="right" fw={600}>
                  {money(category.amount)}
                </Table.Td>
                <Table.Td ta="right">{percent(category.share)}</Table.Td>
                <Table.Td ta="right" c="dimmed">
                  {limitLabel(category)}
                </Table.Td>
                <Table.Td ta="right">
                  <RemainingBadge category={category} />
                </Table.Td>
              </Table.Tr>,
              ...(expanded
                ? category.children.map((child) => (
                    <Table.Tr key={child.id} style={{ cursor: 'pointer' }} onClick={() => onPick?.(child.id, `${category.name} / ${child.name}`)}>
                      <Table.Td pl={40}>
                        <Text size="sm">{child.name}</Text>
                      </Table.Td>
                      <Table.Td ta="right">{money(child.amount)}</Table.Td>
                      <Table.Td ta="right">{percent(child.share)}</Table.Td>
                      <Table.Td />
                      <Table.Td />
                    </Table.Tr>
                  ))
                : []),
            ];
          })}
        </Table.Tbody>
      </Table>
      <UnstyledButton mt="sm" onClick={() => setOpen(new Set(report.categories.map((category) => category.id)))}>
        <Text size="xs" c="dimmed">
          Раскрыть все
        </Text>
      </UnstyledButton>
    </Panel>
  );
}
