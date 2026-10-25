import { ActionIcon, Badge, Button, Group, Stack, Table, Text, Tooltip } from '@mantine/core';
import { IconDownload, IconRestore, IconTrash } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { salaryApi } from '../api/endpoints';
import type { SalaryProfile } from '../api/types';
import { PageHeader, Panel } from '../components/Cards';
import { ErrorAlert } from '../components/ErrorAlert';
import {
  BACKUP_KIND_LABEL,
  type BackupEntry,
  type LoansSnapshot,
  deleteBackup,
  downloadBackup,
  listBackups,
  onBackupsChange,
  snapshotProfile,
  withBackup,
} from '../lib/backup';
import { confirmAction, notifySaved } from '../lib/confirm';
import { useAction } from '../lib/useAction';

function summary(entry: BackupEntry): string {
  if (entry.kind === 'salary-profile') {
    const profile = entry.data as SalaryProfile;
    return `условий ${profile.terms?.length ?? 0}, отсутствий ${profile.absences?.length ?? 0}, истории ${profile.history?.length ?? 0} мес.`;
  }
  const loans = entry.data as LoansSnapshot;
  return `кредитов ${loans.loans?.length ?? 0}: ${(loans.loans ?? []).map((loan) => loan.name).join(', ')}`;
}

export function BackupsPage() {
  const [entries, setEntries] = useState<BackupEntry[]>(listBackups);
  const restore = useAction<SalaryProfile>();

  useEffect(() => onBackupsChange(() => setEntries(listBackups())), []);

  const restoreProfile = async (entry: BackupEntry) => {
    const ok = await confirmAction({
      title: 'Восстановить профиль из бэкапа?',
      message: (
        <Text size="sm">
          Профиль на бэкенде будет заменён копией от {new Date(entry.createdAt).toLocaleString('ru-RU')}. Текущий профиль
          перед этим тоже скачается бэкапом — откат отката возможен.
        </Text>
      ),
      confirmLabel: 'Восстановить',
    });
    if (!ok) return;
    await restore.run(async () => {
      const { result, backup } = await withBackup('salary-profile', 'Перед восстановлением из бэкапа', snapshotProfile, () =>
        salaryApi.putProfile(entry.data as SalaryProfile),
      );
      notifySaved('Профиль восстановлен', backup);
      return result;
    });
  };

  return (
    <Stack gap="lg">
      <PageHeader
        title="Бэкапы"
        subtitle="Копии, снятые перед каждой записью. Файлы — в «Загрузках», здесь — последние 10 (хранятся в этом браузере)."
      />
      <ErrorAlert error={restore.error} />
      <Panel title={`Копий: ${entries.length}`} subtitle="Профиль зарплаты восстанавливается кнопкой. Кредиты теперь в базе и здесь не копируются — ниже только старые копии времён файла.">
        {entries.length === 0 ? (
          <Text size="sm" c="dimmed">
            Пока пусто: бэкап появится перед первой записью (сохранение профиля или отсутствие).
          </Text>
        ) : (
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Когда</Table.Th>
                <Table.Th>Что</Table.Th>
                <Table.Th>Перед чем</Table.Th>
                <Table.Th>Содержимое</Table.Th>
                <Table.Th w={130} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {entries.map((entry) => (
                <Table.Tr key={entry.id}>
                  <Table.Td>{new Date(entry.createdAt).toLocaleString('ru-RU')}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" radius="sm" color={entry.kind === 'loans' ? 'gray' : 'brand'}>
                      {BACKUP_KIND_LABEL[entry.kind]}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{entry.reason}</Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {summary(entry)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      {entry.kind === 'salary-profile' && (
                        <Tooltip label="Восстановить на бэкенде">
                          <ActionIcon variant="subtle" onClick={() => restoreProfile(entry)} loading={restore.loading} aria-label="Восстановить">
                            <IconRestore size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      <Tooltip label="Скачать ещё раз">
                        <ActionIcon variant="subtle" color="gray" onClick={() => downloadBackup(entry)} aria-label="Скачать">
                          <IconDownload size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Удалить из браузера (файл в «Загрузках» останется)">
                        <ActionIcon variant="subtle" color="gray" onClick={() => deleteBackup(entry.id)} aria-label="Удалить">
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        {entries.length > 0 && (
          <Group mt="md">
            <Button variant="subtle" color="gray" size="xs" onClick={() => entries.forEach((entry) => downloadBackup(entry))}>
              Скачать все
            </Button>
          </Group>
        )}
      </Panel>
    </Stack>
  );
}
