import { Badge, Group, Progress, SimpleGrid, Stack, Table, Text, UnstyledButton } from '@mantine/core';
import { IconArrowDownRight, IconArrowUpRight, IconChevronDown, IconChevronRight, IconScale, IconWallet } from '@tabler/icons-react';
import { useState } from 'react';

import type { MonthReport } from '../../api/types';
import { money } from '../../lib/format';
import { HeroCard, Panel, StatCard } from '../Cards';
import { percent } from './common';

/** Итоги месяца: доходы − расходы = остаток, располагаемый. */
export function MonthTotals({ report }: { report: MonthReport }) {
  const negative = Number(report.balance) < 0;
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
      <HeroCard label="Остаток месяца" value={money(report.balance)} caption="Доходы − расходы" icon={<IconScale size={18} />} />
      <StatCard label="Доходы" value={money(report.income)} icon={<IconArrowDownRight size={16} />} badge={{ text: 'пришло', color: 'teal' }} />
      <StatCard
        label="Расходы"
        value={money(report.expenses)}
        icon={<IconArrowUpRight size={16} />}
        badge={negative ? { text: 'больше, чем пришло', color: 'red' } : { text: 'ушло', color: 'gray' }}
      />
      <StatCard
        label="Располагаемый"
        value={money(report.disposable)}
        icon={<IconWallet size={16} />}
        hint="доходы − кредит − жильё; от него — доли трат"
      />
    </SimpleGrid>
  );
}

/** Дерево категорий месяца: сумма, доля от располагаемого, цель, отклонение. Клик по строке — её операции. */
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
    <Panel title="Куда ушли деньги" subtitle="Нажми на категорию — раскроются подкатегории; на подкатегорию — её операции">
      {report.warnings.length > 0 && (
        <Stack gap={4} mb="sm">
          {report.warnings.map((warning) => (
            <Text key={warning} size="sm" c="orange">
              {warning}
            </Text>
          ))}
        </Stack>
      )}
      <Table verticalSpacing="xs" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Категория</Table.Th>
            <Table.Th ta="right">Сумма</Table.Th>
            <Table.Th ta="right">Доля</Table.Th>
            <Table.Th ta="right">Цель</Table.Th>
            <Table.Th ta="right">Отклонение</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {report.categories.map((category) => {
            const expanded = open.has(category.id);
            const over = category.deviation !== null && Number(category.deviation) > 0;
            return [
              <Table.Tr key={category.id} style={{ cursor: 'pointer' }} onClick={() => (category.children.length ? toggle(category.id) : onPick?.(category.id, category.name))}>
                <Table.Td>
                  <Group gap={6} wrap="nowrap">
                    {category.children.length > 0 ? (
                      expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />
                    ) : (
                      <span style={{ width: 14 }} />
                    )}
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
                      <Progress value={(Number(category.amount) / max) * 100} size="xs" color={over ? 'red' : 'brand'} />
                    </Stack>
                  </Group>
                </Table.Td>
                <Table.Td ta="right" fw={600}>
                  {money(category.amount)}
                </Table.Td>
                <Table.Td ta="right">{percent(category.share)}</Table.Td>
                <Table.Td ta="right" c="dimmed">
                  {category.target ? `${money(category.target)} (${percent(category.target_share)})` : '—'}
                </Table.Td>
                <Table.Td ta="right">
                  {category.deviation ? (
                    <Badge variant="light" color={over ? 'red' : 'teal'} radius="sm">
                      {over ? '+' : ''}
                      {money(category.deviation)}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </Table.Td>
              </Table.Tr>,
              ...(expanded
                ? category.children.map((child) => (
                    <Table.Tr key={child.id} style={{ cursor: 'pointer' }} onClick={() => onPick?.(child.id, `${category.name} / ${child.name}`)}>
                      <Table.Td pl={40}>
                        <Text size="sm">{child.name}</Text>
                      </Table.Td>
                      <Table.Td ta="right">{money(child.amount)}</Table.Td>
                      <Table.Td />
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
