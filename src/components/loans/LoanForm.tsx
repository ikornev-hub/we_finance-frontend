import { ActionIcon, Button, Group, Select, SimpleGrid, Stack, Switch, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';

import type { DayCount, LoanIn, PaymentDayChange, Prepayment, PrepaymentMode, RatePeriod } from '../../api/types';
import { Panel } from '../Cards';
import { DateField, IntField, MoneyField } from '../fields';

function replaceAt<T>(items: T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

function Delete({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip label="Удалить">
      <ActionIcon variant="subtle" color="gray" onClick={onClick} aria-label="Удалить">
        <IconTrash size={16} />
      </ActionIcon>
    </Tooltip>
  );
}

export const MODE_OPTIONS = [
  { value: 'reduce_term', label: 'Уменьшить срок' },
  { value: 'reduce_payment', label: 'Уменьшить платёж' },
];

const DAY_COUNT_OPTIONS = [
  { value: 'actual', label: 'Фактические дни года (365/366)' },
  { value: '365', label: 'Всегда 365' },
];

/** Параметры кредита (LoanIn). name — только при создании сохранённого кредита. */
export function LoanForm<T extends LoanIn & { name?: string }>({
  value,
  onChange,
  withName,
}: {
  value: T;
  onChange: (next: T) => void;
  withName?: boolean;
}) {
  const set = (patch: Partial<T>) => onChange({ ...value, ...patch });
  const setRates = (rates: RatePeriod[]) => set({ rates } as Partial<T>);
  const setChanges = (payment_day_changes: PaymentDayChange[]) => set({ payment_day_changes } as Partial<T>);

  return (
    <Stack gap="lg">
      <Panel title="Кредит" subtitle="Сумма, платёж, срок и даты — как в договоре">
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {withName && (
            <TextInput
              label="Название"
              value={value.name ?? ''}
              onChange={(event) => set({ name: event.currentTarget.value } as Partial<T>)}
              radius="md"
            />
          )}
          <MoneyField label="Сумма кредита" value={value.principal} onChange={(principal) => set({ principal } as Partial<T>)} />
          <MoneyField label="Ежемесячный платёж" value={value.payment} onChange={(payment) => set({ payment } as Partial<T>)} />
          <IntField label="Срок, мес." value={value.months} min={1} onChange={(months) => set({ months } as Partial<T>)} />
          <DateField label="Дата выдачи" value={value.issue_date} onChange={(issue_date) => set({ issue_date } as Partial<T>)} />
          <DateField
            label="Первый платёж"
            value={value.first_payment_date}
            onChange={(first_payment_date) => set({ first_payment_date } as Partial<T>)}
          />
          <MoneyField label="Комиссия в месяц" value={value.monthly_fee} onChange={(monthly_fee) => set({ monthly_fee } as Partial<T>)} />
          <Select
            label="Дни в году для процентов"
            data={DAY_COUNT_OPTIONS}
            value={value.day_count}
            allowDeselect={false}
            onChange={(day_count) => day_count && set({ day_count: day_count as DayCount } as Partial<T>)}
            radius="md"
          />
          <Switch
            mt={30}
            label="Переносить платёж с выходного"
            checked={value.weekend_shift}
            onChange={(event) => set({ weekend_shift: event.currentTarget.checked } as Partial<T>)}
          />
        </SimpleGrid>
      </Panel>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Panel title="Ставка" subtitle="Периоды: первый — с даты выдачи, далее по возрастанию">
          <Table verticalSpacing={6} withRowBorders={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>С даты</Table.Th>
                <Table.Th>Ставка, % годовых</Table.Th>
                <Table.Th w={40} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {value.rates.map((rate, index) => (
                <Table.Tr key={index}>
                  <Table.Td>
                    <DateField value={rate.start} onChange={(start) => setRates(replaceAt(value.rates, index, { start }))} />
                  </Table.Td>
                  <Table.Td>
                    <TextInput
                      value={rate.annual_rate}
                      inputMode="decimal"
                      onChange={(event) =>
                        setRates(replaceAt(value.rates, index, { annual_rate: event.currentTarget.value.replace(',', '.') }))
                      }
                      radius="md"
                      rightSection={<span style={{ fontSize: 12, opacity: 0.6 }}>%</span>}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Delete onClick={() => setRates(removeAt(value.rates, index))} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Button
            mt="sm"
            variant="light"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setRates([...value.rates, { start: '', annual_rate: value.rates.at(-1)?.annual_rate ?? '' }])}
          >
            Добавить период
          </Button>
        </Panel>

        <Panel title="Смена дня платежа" subtitle="С какой даты платить в другой день месяца (необязательно)">
          {value.payment_day_changes.length === 0 && (
            <Text size="sm" c="dimmed">
              День платежа не меняется.
            </Text>
          )}
          {value.payment_day_changes.length > 0 && (
            <Table verticalSpacing={6} withRowBorders={false}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>С даты</Table.Th>
                  <Table.Th>День месяца</Table.Th>
                  <Table.Th w={40} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {value.payment_day_changes.map((change, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <DateField
                        value={change.start}
                        onChange={(start) => setChanges(replaceAt(value.payment_day_changes, index, { start }))}
                      />
                    </Table.Td>
                    <Table.Td>
                      <IntField
                        value={change.day}
                        min={1}
                        max={31}
                        width={90}
                        onChange={(day) => setChanges(replaceAt(value.payment_day_changes, index, { day }))}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Delete onClick={() => setChanges(removeAt(value.payment_day_changes, index))} />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          <Button
            mt="sm"
            variant="light"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setChanges([...value.payment_day_changes, { start: '', day: 15 }])}
          >
            Добавить смену дня
          </Button>
        </Panel>
      </SimpleGrid>
    </Stack>
  );
}

/** Одна ЧДП: дата, сумма, режим. */
export function PrepaymentFields({ value, onChange }: { value: Prepayment; onChange: (next: Prepayment) => void }) {
  return (
    <Group align="flex-end" gap="md">
      <DateField label="Дата" value={value.date} onChange={(date) => onChange({ ...value, date })} />
      <MoneyField label="Сумма" value={value.amount} onChange={(amount) => onChange({ ...value, amount })} width={170} />
      <Select
        label="Режим"
        data={MODE_OPTIONS}
        value={value.mode}
        allowDeselect={false}
        onChange={(mode) => mode && onChange({ ...value, mode: mode as PrepaymentMode })}
        radius="md"
        w={200}
      />
    </Group>
  );
}

/** Список ЧДП для калькулятора. */
export function PrepaymentList({ value, onChange }: { value: Prepayment[]; onChange: (next: Prepayment[]) => void }) {
  return (
    <Stack gap="sm">
      {value.length === 0 && (
        <Text size="sm" c="dimmed">
          Без досрочных платежей.
        </Text>
      )}
      {value.map((prepayment, index) => (
        <Group key={index} align="flex-end" gap="xs" wrap="nowrap">
          <PrepaymentFields value={prepayment} onChange={(next) => onChange(value.map((p, i) => (i === index ? next : p)))} />
          <Delete onClick={() => onChange(removeAt(value, index))} />
        </Group>
      ))}
      <div>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => onChange([...value, { date: '', amount: '', mode: 'reduce_term' }])}
        >
          Добавить ЧДП
        </Button>
      </div>
    </Stack>
  );
}
