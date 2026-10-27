import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useInterval } from '@mantine/hooks';
import { IconLogout, IconMoon, IconSettings, IconSun } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { serviceApi } from '../api/endpoints';
import { clearToken } from '../lib/session';
import type { HealthResponse, VersionResponse } from '../api/types';
import { type Route, TABS, type TabId, href } from '../navigation';
import { MonthSwitch, useSelectedMonth } from './expenses/common';
import classes from './Shell.module.css';

type Status = { health: HealthResponse | null; version: VersionResponse | null; offline: boolean };

/** Статус бэкенда: опрос /health раз в 15 секунд и /version при старте. */
function useBackendStatus(): Status {
  const [status, setStatus] = useState<Status>({ health: null, version: null, offline: false });

  const check = async () => {
    try {
      const health = await serviceApi.health();
      setStatus((prev) => ({ ...prev, health, offline: false }));
    } catch {
      setStatus((prev) => ({ ...prev, health: null, offline: true }));
    }
  };

  const interval = useInterval(check, 15000);
  useEffect(() => {
    void check();
    serviceApi
      .version()
      .then((version) => setStatus((prev) => ({ ...prev, version })))
      .catch(() => undefined);
    interval.start();
    return interval.stop;
    // Опрос запускается один раз при старте приложения.
  }, []);

  return status;
}

function StatusPill({ status }: { status: Status }) {
  const color = status.offline ? 'red' : !status.health ? 'gray' : status.health.status === 'ok' ? 'teal' : 'yellow';
  const label = status.offline
    ? 'Сервер не отвечает'
    : !status.health
      ? 'Проверяю…'
      : status.health.status === 'ok'
        ? 'Всё работает'
        : 'База данных недоступна';
  return (
    <Tooltip label={status.offline ? 'Сервер не отвечает — проверь, что стенд запущен' : 'Проверяется раз в 15 секунд'}>
      <Group gap={8} className={classes.pill} wrap="nowrap">
        <Box className={classes.dot} bg={`${color}.6`} />
        <Text size="xs" fw={500} visibleFrom="sm">
          {label}
        </Text>
        {status.version && (
          <Badge variant="light" color="gray" size="sm" radius="xl">
            v{status.version.version}
          </Badge>
        )}
      </Group>
    </Tooltip>
  );
}

function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');
  return (
    <Tooltip label={scheme === 'dark' ? 'Светлая тема' : 'Тёмная тема'} position="right">
      <ActionIcon
        variant="subtle"
        color="gray"
        size="lg"
        radius="xl"
        onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}
        aria-label="Переключить тему"
      >
        {scheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}

/** Экраны, которые показывают выбранный месяц: на них переключатель месяца висит в шапке. */
const MONTH_SCREENS = new Set(['home/main', 'home/cinema', 'expenses/budget', 'expenses/month', 'expenses/goals', 'expenses/review']);

function HeaderMonth() {
  const [month, setMonth] = useSelectedMonth();
  return <MonthSwitch month={month} onChange={setMonth} />;
}

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const status = useBackendStatus();
  const withMonth = MONTH_SCREENS.has(`${route.tab.id}/${route.section.id}`);

  return (
    <AppShell header={{ height: 72 }} navbar={{ width: 76, breakpoint: 0 }} padding="lg" className={classes.shell}>
      <AppShell.Header className={classes.header}>
        <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Box className={classes.logo}>WF</Box>
            <Text fw={700} visibleFrom="xs">
              We Finance
            </Text>
          </Group>
          <SegmentedControl
            radius="xl"
            size="sm"
            value={route.tab.hidden ? '' : route.tab.id}
            onChange={(value) => (window.location.hash = href(value as TabId))}
            data={TABS.filter((tab) => !tab.hidden).map((tab) => ({ value: tab.id, label: tab.label }))}
            className={classes.tabs}
          />
          <Group gap="xs" wrap="nowrap">
            {withMonth && <HeaderMonth />}
            <StatusPill status={status} />
            <Tooltip label="Система: состояние сервера">
              <ActionIcon
                variant={route.tab.id === 'system' ? 'light' : 'subtle'}
                color="gray"
                size="lg"
                radius="xl"
                onClick={() => (window.location.hash = href('system'))}
                aria-label="Система"
              >
                <IconSettings size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Выйти">
              <ActionIcon variant="subtle" color="gray" size="lg" radius="xl" onClick={clearToken} aria-label="Выйти">
                <IconLogout size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className={classes.rail}>
        <Stack justify="space-between" h="100%" py="md" align="center">
          <Stack gap={6} align="center">
            {route.tab.sections.filter((section) => !section.hidden).map((section) => {
              const active = section.id === route.section.id;
              return (
                <Tooltip key={section.id} label={section.label} position="right" withArrow>
                  <UnstyledButton
                    className={classes.railButton}
                    data-active={active || undefined}
                    onClick={() => (window.location.hash = href(route.tab.id, section.id))}
                    aria-label={section.label}
                  >
                    {section.icon}
                  </UnstyledButton>
                </Tooltip>
              );
            })}
          </Stack>
          <ThemeToggle />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Box maw={1280} mx="auto">
          {children}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
