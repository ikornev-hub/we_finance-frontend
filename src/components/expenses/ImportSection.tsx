import { Accordion, Alert, Avatar, Badge, Button, Checkbox, FileInput, Group, Paper, SegmentedControl, Stack, Table, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconFileSpreadsheet, IconListSearch, IconRobot, IconX } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import { expensesApi } from '../../api/endpoints';
import type { AiReport, ExpenseCategory, ImportPreview, ImportResult, PreviewOperation } from '../../api/types';
import { date } from '../../lib/format';
import { useOrSample } from '../../lib/sample';
import { PageHeader, Panel } from '../Cards';
import { ErrorAlert, errorText } from '../ErrorAlert';
import { CategorySelect } from './common';

// Загрузка выписки с проверкой (решение заказчика 2026-10-27): файл разбирается, но в базу
// ничего не пишется, пока пользователь не проверит категории и не нажмёт «Сохранить».

const go = (section: string) => () => (window.location.hash = `#expenses/${section}`);
const rub = (value: number) => `${value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
const UNCATEGORIZED = 'Неопределённые';

interface Choice {
  category_id: string;
  remember: boolean;
}

const BOT_COLOR: Record<AiReport['status'], string> = { ok: 'violet', skipped: 'gray', off: 'gray', error: 'orange' };
const BOT_STATUS: Record<AiReport['status'], string> = { ok: 'разложил', skipped: 'не понадобился', off: 'выключен', error: 'не ответил' };

/** Окно бота над списком: что разложила модель и в чём не уверена (system/expenses.md §2.10). */
function BotWindow({ report }: { report: AiReport }) {
  return (
    <Paper withBorder radius="lg" p="md" style={{ borderColor: `var(--mantine-color-${BOT_COLOR[report.status]}-light-color)` }}>
      <Group align="flex-start" wrap="nowrap" gap="md">
        <Avatar color={BOT_COLOR[report.status]} radius="xl" variant="light">
          <IconRobot size={20} />
        </Avatar>
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Group gap="xs">
            <Text fw={700}>ИИ-помощник</Text>
            <Badge size="sm" variant="light" color={BOT_COLOR[report.status]}>
              {BOT_STATUS[report.status]}
              {report.status === 'ok' ? ` ${report.suggested}` : ''}
            </Badge>
            {report.model && (
              <Text size="xs" c="dimmed">
                модель {report.model}
              </Text>
            )}
          </Group>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {report.message}
          </Text>
          {report.status === 'ok' && report.suggested > 0 && (
            <Text size="xs" c="dimmed">
              Его варианты помечены «ИИ». Согласен — просто «Сохранить»; нет — выбери другую категорию.
            </Text>
          )}
        </Stack>
      </Group>
    </Paper>
  );
}

export function ImportSection() {
  const [bank, setBank] = useState('alfa');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<string | null>(null);
  const [busy, setBusy] = useState<'check' | 'save' | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState<ImportResult | null>(null);
  const categories = useOrSample(() => expensesApi.categories(), [] as ExpenseCategory[], 'categories').data ?? [];

  const reset = () => {
    setPreview(null);
    setChoices({});
    setSelected(new Set());
    setBulk(null);
    setError(null);
  };

  const check = async () => {
    if (!file) return;
    reset();
    setSaved(null);
    setBusy('check');
    try {
      setPreview(await expensesApi.previewImport(bank, file));
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!file || !preview) return;
    setBusy('save');
    try {
      const overrides = Object.entries(choices).map(([bank_operation_id, choice]) => ({ bank_operation_id, ...choice }));
      // подсказки ИИ, которые не тронули, — тоже правки: при сохранении backend модель не зовёт (§2.10)
      for (const operation of preview.operations) {
        if (operation.suggested_by === 'ai' && operation.category_id && !choices[operation.bank_operation_id]) {
          overrides.push({ bank_operation_id: operation.bank_operation_id, category_id: operation.category_id, remember: false });
        }
      }
      const result = await expensesApi.importStatement(bank, file, overrides);
      setSaved(result);
      notifications.show({ color: 'teal', title: 'Выписка сохранена', message: `Новых операций: ${result.new}` });
      reset();
      setFile(null);
    } catch (failure) {
      notifications.show({ color: 'red', title: 'Не сохранилось', message: errorText(failure) });
    } finally {
      setBusy(null);
    }
  };

  // группы — по предложенной категории (строки не прыгают при правке), «Неопределённые» сверху
  const groups = useMemo(() => {
    const map = new Map<string, PreviewOperation[]>();
    for (const operation of preview?.operations ?? []) {
      const key = operation.category ?? 'Без категории';
      map.set(key, [...(map.get(key) ?? []), operation]);
    }
    return [...map.entries()].sort(([a, x], [b, y]) => Number(b === UNCATEGORIZED) - Number(a === UNCATEGORIZED) || y.length - x.length);
  }, [preview]);

  const chosen = (operation: PreviewOperation) => choices[operation.bank_operation_id]?.category_id ?? operation.category_id;
  const choose = (operation: PreviewOperation, categoryId: string | null) =>
    setChoices((prev) => {
      const next = { ...prev };
      if (!categoryId || categoryId === operation.category_id) delete next[operation.bank_operation_id];
      else next[operation.bank_operation_id] = { category_id: categoryId, remember: prev[operation.bank_operation_id]?.remember ?? false };
      return next;
    });
  const remember = (operation: PreviewOperation, value: boolean) =>
    setChoices((prev) => ({ ...prev, [operation.bank_operation_id]: { ...prev[operation.bank_operation_id], remember: value } }));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const applyBulk = () => {
    if (!bulk || !preview) return;
    for (const operation of preview.operations) if (selected.has(operation.bank_operation_id)) choose(operation, bulk);
    setSelected(new Set());
    setBulk(null);
  };

  const left = (preview?.operations ?? []).filter((operation) => {
    const id = chosen(operation);
    return !id || categories.find((category) => category.id === id)?.system_code === 'uncategorized';
  }).length;
  const changes = Object.keys(choices).length;

  return (
    <Stack gap="lg">
      <PageHeader title="Загрузить выписку" subtitle="Раз в месяц: выгрузи выписку в банке, проверь категории и сохрани. Уже загруженные операции не задвоятся." />
      <Panel>
        <Stack gap="md">
          <SegmentedControl
            value={bank}
            onChange={(value) => {
              setBank(value);
              reset();
            }}
            data={[
              { value: 'alfa', label: 'Альфа-Банк (XLSX или PDF)' },
              { value: 'ozon', label: 'Озон Банк (PDF) — скоро', disabled: true },
            ]}
          />
          <FileInput
            label="Файл выписки"
            placeholder="Выбери файл"
            accept=".xlsx,.pdf"
            value={file}
            onChange={(value) => {
              setFile(value);
              reset();
            }}
            leftSection={<IconFileSpreadsheet size={16} />}
            radius="md"
            clearable
          />
          <Group>
            <Button leftSection={<IconListSearch size={16} />} disabled={!file || Boolean(preview)} loading={busy === 'check'} onClick={check}>
              Проверить
            </Button>
            {busy === 'check' && (
              <Text size="sm" c="dimmed">
                Разбираю выписку; то, что не узнали правила, раскладывает ИИ — до минуты-двух.
              </Text>
            )}
          </Group>
          <ErrorAlert error={error} />
          {saved && (
            <Alert color="teal" radius="lg" variant="light" icon={<IconCheck size={18} />} title="Выписка сохранена">
              <Stack gap="xs">
                <Text size="sm">
                  Операций: <b>{saved.total}</b> · новых: <b>{saved.new}</b> · уже были: <b>{saved.duplicates}</b> · без категории: <b>{saved.uncategorized}</b>
                </Text>
                <Group gap="sm">
                  {saved.uncategorized > 0 && (
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

      {preview && (
        <Panel
          title="Проверь, куда разложились операции"
          subtitle={`Выписка ${preview.period_from ? date(preview.period_from) : '?'} – ${preview.period_to ? date(preview.period_to) : '?'}: всего ${preview.total}, новых ${preview.new}, уже загружены ${preview.duplicates} — их не показываем. Пока не нажмёшь «Сохранить», в базе ничего не меняется.`}
        >
          {preview.new === 0 ? (
            <Stack gap="sm">
              <Text size="sm">Новых операций нет — эта выписка уже загружена целиком.</Text>
              <Group>
                <Button variant="default" onClick={reset}>
                  Закрыть
                </Button>
              </Group>
            </Stack>
          ) : (
            <Stack gap="md">
              {preview.ai && <BotWindow report={preview.ai} />}
              {selected.size > 0 && (
                <Group
                  gap="sm"
                  p="sm"
                  style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--mantine-color-body)', borderRadius: 12, border: '1px solid var(--mantine-color-default-border)' }}
                >
                  <Text size="sm" fw={600}>
                    Выбрано: {selected.size}
                  </Text>
                  <CategorySelect categories={categories} value={bulk} onChange={setBulk} width={260} />
                  <Button size="sm" disabled={!bulk} onClick={applyBulk}>
                    Поставить категорию
                  </Button>
                  <Button size="sm" variant="subtle" onClick={() => setSelected(new Set())}>
                    Снять выбор
                  </Button>
                </Group>
              )}

              <Accordion
                multiple
                defaultValue={groups
                  .filter(([name, operations]) => name === UNCATEGORIZED || operations.some((operation) => operation.suggested_by === 'ai'))
                  .map(([name]) => name)}
                variant="separated"
                radius="md"
              >
                {groups.map(([name, operations]) => {
                  const sum = operations.reduce((total, operation) => total + Number(operation.amount), 0);
                  const edited = operations.filter((operation) => choices[operation.bank_operation_id]).length;
                  return (
                    <Accordion.Item key={name} value={name}>
                      <Accordion.Control>
                        <Group justify="space-between" wrap="nowrap" pr="sm">
                          <Group gap="sm">
                            <Text fw={600} c={name === UNCATEGORIZED ? 'orange' : undefined}>
                              {name}
                            </Text>
                            <Badge variant="light" color="gray" radius="sm">
                              {operations.length}
                            </Badge>
                            {edited > 0 && (
                              <Badge variant="light" color="blue" radius="sm">
                                исправлено {edited}
                              </Badge>
                            )}
                          </Group>
                          <Text size="sm" fw={600} c={sum < 0 ? undefined : 'teal'}>
                            {rub(sum)}
                          </Text>
                        </Group>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Table verticalSpacing={6}>
                          <Table.Tbody>
                            {operations.map((operation) => {
                              const choice = choices[operation.bank_operation_id];
                              return (
                                <Table.Tr key={operation.bank_operation_id} bg={choice ? 'var(--mantine-color-blue-light)' : undefined}>
                                  <Table.Td w={32}>
                                    <Checkbox
                                      aria-label="Выбрать операцию"
                                      checked={selected.has(operation.bank_operation_id)}
                                      onChange={() => toggle(operation.bank_operation_id)}
                                    />
                                  </Table.Td>
                                  <Table.Td w={90} visibleFrom="sm">
                                    <Text size="sm">{date(operation.day)}</Text>
                                  </Table.Td>
                                  <Table.Td>
                                    <Text size="sm" fw={500}>
                                      {operation.merchant ?? operation.counterparty ?? ''}
                                    </Text>
                                    <Text size="xs" c="dimmed" style={{ wordBreak: 'break-word' }}>
                                      {operation.description}
                                    </Text>
                                    <Group hiddenFrom="sm" justify="space-between" mt={4} gap="xs">
                                      <Text size="xs" c="dimmed">
                                        {date(operation.day)}
                                      </Text>
                                      <Text size="sm" fw={600} c={Number(operation.amount) > 0 ? 'teal' : undefined}>
                                        {rub(Number(operation.amount))}
                                      </Text>
                                    </Group>
                                    <Group gap={4} mt={4}>
                                      {operation.suggested_by === 'ai' && (
                                        <Badge size="xs" variant="filled" color="violet" leftSection={<IconRobot size={10} />}>
                                          ИИ
                                        </Badge>
                                      )}
                                      <Badge
                                        size="xs"
                                        variant="light"
                                        color={operation.suggested_by === 'ai' ? 'violet' : operation.reason.includes('реши сам') || operation.reason === 'не распознано' ? 'orange' : 'gray'}
                                        style={{ textTransform: 'none', maxWidth: '100%' }}
                                      >
                                        {operation.reason.replace(/^ИИ: /, '')}
                                      </Badge>
                                    </Group>
                                  </Table.Td>
                                  <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }} visibleFrom="sm">
                                    <Text size="sm" fw={600} c={Number(operation.amount) > 0 ? 'teal' : undefined}>
                                      {rub(Number(operation.amount))}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td w={290} visibleFrom="sm">
                                    <Stack gap={4}>
                                      <CategorySelect categories={categories} value={chosen(operation)} onChange={(value) => choose(operation, value)} width={270} />
                                      {choice && (
                                        <Tooltip
                                          label={operation.can_remember ? 'Правило на получателя или магазин: в следующих выписках — сразу сюда' : 'Нет получателя и магазина — запомнить нечего'}
                                        >
                                          <Checkbox
                                            size="xs"
                                            label="запомнить"
                                            disabled={!operation.can_remember}
                                            checked={choice.remember}
                                            onChange={(event) => remember(operation, event.currentTarget.checked)}
                                          />
                                        </Tooltip>
                                      )}
                                    </Stack>
                                  </Table.Td>
                                </Table.Tr>
                              );
                            }).flatMap((row, index) => [
                              row,
                              <Table.Tr key={`${operations[index].bank_operation_id}-m`} hiddenFrom="sm">
                                <Table.Td colSpan={2} pt={0}>
                                  <CategorySelect
                                    categories={categories}
                                    value={chosen(operations[index])}
                                    onChange={(value) => choose(operations[index], value)}
                                    width="100%"
                                  />
                                </Table.Td>
                              </Table.Tr>,
                            ])}
                          </Table.Tbody>
                        </Table>
                      </Accordion.Panel>
                    </Accordion.Item>
                  );
                })}
              </Accordion>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Исправлено: {changes} · останутся без категории: {left}
                </Text>
                <Group gap="sm">
                  <Button variant="default" leftSection={<IconX size={16} />} onClick={reset} disabled={busy === 'save'}>
                    Отмена
                  </Button>
                  <Button leftSection={<IconCheck size={16} />} loading={busy === 'save'} onClick={save}>
                    Сохранить {preview.new} операций
                  </Button>
                </Group>
              </Group>
            </Stack>
          )}
        </Panel>
      )}
    </Stack>
  );
}
