import { Badge, Button, Group, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { IconDatabase, IconHeartbeat, IconMathFunction, IconRefresh, IconTag } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { serviceApi } from '../api/endpoints';
import type { HealthResponse, MoneyRoundResponse, VersionResponse } from '../api/types';
import { PageHeader, Panel, StatCard } from '../components/Cards';
import { ErrorAlert } from '../components/ErrorAlert';
import { money } from '../lib/format';
import { useAction } from '../lib/useAction';

export function ServicePage() {
  const health = useAction<HealthResponse>();
  const version = useAction<VersionResponse>();
  const round = useAction<MoneyRoundResponse>();
  const [amount, setAmount] = useState('422.245');
  const healthRun = health.run;
  const versionRun = version.run;

  const refresh = () => {
    void healthRun(() => serviceApi.health());
    void versionRun(() => serviceApi.version());
  };

  useEffect(() => {
    void healthRun(() => serviceApi.health());
    void versionRun(() => serviceApi.version());
  }, [healthRun, versionRun]);

  const ok = health.data?.status === 'ok';

  return (
    <Stack gap="lg">
      <PageHeader title="Сервис" subtitle="Состояние бэкенда, версия и округление денег — служебные эндпоинты." />
      <Group>
        <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={refresh} loading={health.loading || version.loading}>
          Обновить
        </Button>
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <StatCard
          label="API (/health)"
          value={health.data ? (ok ? 'Работает' : 'С проблемами') : health.error ? 'Недоступен' : '…'}
          icon={<IconHeartbeat size={16} />}
          badge={health.data ? { text: health.data.status, color: ok ? 'teal' : 'yellow' } : undefined}
        />
        <StatCard
          label="База данных"
          value={health.data ? (health.data.db === 'ok' ? 'Подключена' : 'Недоступна') : '—'}
          icon={<IconDatabase size={16} />}
          hint={health.data?.db === 'ok' ? undefined : 'Зарплате и кредитам база не нужна: они в JSON-файлах'}
        />
        <StatCard
          label="Версия (/version)"
          value={version.data?.version ?? '—'}
          icon={<IconTag size={16} />}
          badge={version.data ? { text: `env: ${version.data.env}`, color: 'gray' } : undefined}
        />
      </SimpleGrid>
      <ErrorAlert error={health.error} />
      <ErrorAlert error={version.error} />

      <Panel title="Округление суммы" subtitle="GET /api/v1/money/round — до копеек, половина вверх (ROUND_HALF_UP)">
        <Group align="flex-end" gap="md">
          <TextInput label="Сумма" value={amount} onChange={(event) => setAmount(event.currentTarget.value)} radius="md" w={200} />
          <Button leftSection={<IconMathFunction size={16} />} loading={round.loading} onClick={() => round.run(() => serviceApi.round(amount))}>
            Округлить
          </Button>
          {round.data && (
            <Group gap="xs" pb={4}>
              <Text size="xl" fw={700}>
                {money(round.data.amount)}
              </Text>
              <Badge variant="light">{round.data.amount}</Badge>
            </Group>
          )}
        </Group>
        <Stack mt="md">
          <ErrorAlert error={round.error} />
        </Stack>
      </Panel>
    </Stack>
  );
}
