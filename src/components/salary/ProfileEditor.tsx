import { ActionIcon, Button, Collapse, Group, Select, Stack, Table, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconChevronUp, IconPlus, IconTrash } from '@tabler/icons-react';

import type { Absence, AbsenceKind, HistoryMonth, SalaryProfile, SalaryTerms } from '../../api/types';
import { ABSENCE_KIND } from '../../lib/format';
import { Panel } from '../Cards';
import { DateField, IntField, MoneyField } from '../fields';

function replaceAt<T>(items: T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

const KIND_OPTIONS = Object.entries(ABSENCE_KIND).map(([value, label]) => ({ value, label }));

function DeleteButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Tooltip label={label}>
      <ActionIcon variant="subtle" color="gray" onClick={onClick} aria-label={label}>
        <IconTrash size={16} />
      </ActionIcon>
    </Tooltip>
  );
}

/** Редактор профиля: условия, отсутствия, история до начала учёта, начало стажа. */
export function ProfileEditor({ value, onChange }: { value: SalaryProfile; onChange: (next: SalaryProfile) => void }) {
  const [historyOpen, history] = useDisclosure(false);
  const set = (patch: Partial<SalaryProfile>) => onChange({ ...value, ...patch });

  const setTerms = (terms: SalaryTerms[]) => set({ terms });
  const setAbsences = (absences: Absence[]) => set({ absences });
  const setHistory = (items: HistoryMonth[]) => set({ history: items });

  const lastTerms = value.terms[value.terms.length - 1];
  const lastHistory = value.history[value.history.length - 1];

  return (
    <Stack gap="lg">
      <Panel title="Условия" subtitle="С даты начинают действовать оклад и компенсация питания за рабочий день. Даты строго по возрастанию.">
        <Table verticalSpacing={6} withRowBorders={false}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>С даты</Table.Th>
              <Table.Th>Оклад</Table.Th>
              <Table.Th>Питание в день</Table.Th>
              <Table.Th w={40} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {value.terms.map((terms, index) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <DateField value={terms.start} onChange={(start) => setTerms(replaceAt(value.terms, index, { start }))} />
                </Table.Td>
                <Table.Td>
                  <MoneyField value={terms.salary} onChange={(salary) => setTerms(replaceAt(value.terms, index, { salary }))} />
                </Table.Td>
                <Table.Td>
                  <MoneyField
                    value={terms.meal_per_day}
                    onChange={(meal_per_day) => setTerms(replaceAt(value.terms, index, { meal_per_day }))}
                  />
                </Table.Td>
                <Table.Td>
                  <DeleteButton label="Удалить условия" onClick={() => setTerms(removeAt(value.terms, index))} />
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
          onClick={() =>
            setTerms([...value.terms, lastTerms ? { ...lastTerms, start: '' } : { start: '', salary: '', meal_per_day: '0.00' }])
          }
        >
          Добавить условия
        </Button>
      </Panel>

      <Panel title="Отсутствия" subtitle="Отпуск, больничный, без оплаты — даты с–по включительно, не пересекаются.">
        {value.absences.length === 0 && (
          <Text size="sm" c="dimmed">
            Отсутствий нет.
          </Text>
        )}
        {value.absences.length > 0 && (
          <Table verticalSpacing={6} withRowBorders={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Вид</Table.Th>
                <Table.Th>С</Table.Th>
                <Table.Th>По</Table.Th>
                <Table.Th w={40} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {value.absences.map((absence, index) => (
                <Table.Tr key={index}>
                  <Table.Td>
                    <Select
                      data={KIND_OPTIONS}
                      value={absence.kind}
                      allowDeselect={false}
                      onChange={(kind) => kind && setAbsences(replaceAt(value.absences, index, { kind: kind as AbsenceKind }))}
                      size="sm"
                      radius="md"
                      w={150}
                    />
                  </Table.Td>
                  <Table.Td>
                    <DateField value={absence.start} onChange={(start) => setAbsences(replaceAt(value.absences, index, { start }))} />
                  </Table.Td>
                  <Table.Td>
                    <DateField value={absence.end} onChange={(end) => setAbsences(replaceAt(value.absences, index, { end }))} />
                  </Table.Td>
                  <Table.Td>
                    <DeleteButton label="Удалить отсутствие" onClick={() => setAbsences(removeAt(value.absences, index))} />
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
          onClick={() => setAbsences([...value.absences, { kind: 'vacation', start: '', end: '' }])}
        >
          Добавить отсутствие
        </Button>
      </Panel>

      <Panel
        title={`История до начала учёта — ${value.history.length} мес.`}
        subtitle="Выплаты за прошлые месяцы: нужны для отпускных (12 мес.) и больничного (2 года)."
        actions={
          <Button
            variant="subtle"
            size="xs"
            onClick={history.toggle}
            rightSection={historyOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          >
            {historyOpen ? 'Свернуть' : 'Показать'}
          </Button>
        }
      >
        <Collapse in={historyOpen}>
          <Table verticalSpacing={4} withRowBorders={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Год</Table.Th>
                <Table.Th>Месяц</Table.Th>
                <Table.Th>Оклад</Table.Th>
                <Table.Th>Отпускные</Table.Th>
                <Table.Th>Искл. дней</Table.Th>
                <Table.Th w={40} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {value.history.map((month, index) => (
                <Table.Tr key={index}>
                  <Table.Td>
                    <IntField value={month.year} width={90} min={2000} onChange={(year) => setHistory(replaceAt(value.history, index, { year }))} />
                  </Table.Td>
                  <Table.Td>
                    <IntField value={month.month} width={70} min={1} max={12} onChange={(m) => setHistory(replaceAt(value.history, index, { month: m }))} />
                  </Table.Td>
                  <Table.Td>
                    <MoneyField value={month.salary} width={140} onChange={(salary) => setHistory(replaceAt(value.history, index, { salary }))} />
                  </Table.Td>
                  <Table.Td>
                    <MoneyField
                      value={month.vacation_pay ?? '0'}
                      width={130}
                      onChange={(vacation_pay) => setHistory(replaceAt(value.history, index, { vacation_pay }))}
                    />
                  </Table.Td>
                  <Table.Td>
                    <IntField
                      value={month.excluded_days ?? 0}
                      width={80}
                      min={0}
                      max={31}
                      onChange={(excluded_days) => setHistory(replaceAt(value.history, index, { excluded_days }))}
                    />
                  </Table.Td>
                  <Table.Td>
                    <DeleteButton label="Удалить месяц" onClick={() => setHistory(removeAt(value.history, index))} />
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
            onClick={() => {
              const next = lastHistory
                ? lastHistory.month === 12
                  ? { ...lastHistory, year: lastHistory.year + 1, month: 1 }
                  : { ...lastHistory, month: lastHistory.month + 1 }
                : { year: 2025, month: 1, salary: '', vacation_pay: '0', excluded_days: 0 };
              setHistory([...value.history, next]);
            }}
          >
            Добавить месяц
          </Button>
        </Collapse>
      </Panel>

      <Panel title="Страховой стаж" subtitle="Начало стажа — от него зависит процент больничного (до 5 лет — 60%).">
        <Group>
          <DateField label="Начало стажа" value={value.stage_start} onChange={(stage_start) => set({ stage_start })} />
        </Group>
      </Panel>
    </Stack>
  );
}
