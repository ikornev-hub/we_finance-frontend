import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Button,
  Drawer,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Text,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconHeartbeat, IconLogout, IconMoon, IconSettings, IconSun } from '@tabler/icons-react';
import type { ReactNode } from 'react';

import { clearToken } from '../lib/session';
import { type Route, type Tab, TABS, href, sectionHref } from '../navigation';
import { MonthSwitch, useSelectedMonth } from './expenses/common';
import classes from './Shell.module.css';

// Шапка (решение заказчика 2026-10-27): левой колонки нет, разделы — выпадающий список вкладки,
// на телефоне разделы в бургере. Шапка: меню слева, месяц по центру, ⚙ справа. Шапка прозрачная, контент едет под ней.

/** Экраны, которые показывают выбранный месяц: на них переключатель месяца висит в шапке. */
const MONTH_SCREENS = new Set(['home/main', 'home/cinema', 'expenses/budget', 'expenses/month', 'expenses/goals', 'expenses/review']);

const MENU_TABS = TABS.filter((tab) => !tab.hidden);
const go = (hash: string) => (window.location.hash = hash);

function HeaderMonth() {
  const [month, setMonth] = useSelectedMonth();
  return <MonthSwitch month={month} onChange={setMonth} />;
}

/** Подсвеченная вкладка шапки: у скрытой (калькулятор) — её родитель. */
function activeTab(route: Route): string {
  return route.tab.parent ?? route.tab.id;
}

function isActive(route: Route, tab: Tab, sectionId: string, link?: string): boolean {
  return link ? route.tab.id === link : route.tab.id === tab.id && route.section.id === sectionId;
}

function useTheme() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('dark');
  return { dark: scheme === 'dark', toggle: () => setColorScheme(scheme === 'dark' ? 'light' : 'dark') };
}

/** Вкладка шапки: клик открывает список разделов (наведения на планшете нет). */
function TabMenu({ tab, route }: { tab: Tab; route: Route }) {
  const active = activeTab(route) === tab.id;
  const sections = tab.sections.filter((section) => !section.hidden);
  return (
    <Menu position="bottom-start" offset={6} radius="md" shadow="lg" withinPortal>
      <Menu.Target>
        <Button
          variant={active ? 'light' : 'subtle'}
          color={active ? 'brand' : 'gray'}
          radius="xl"
          className={classes.tab}
          data-active={active || undefined}
          rightSection={<IconChevronDown size={14} />}
        >
          {tab.label}
        </Button>
      </Menu.Target>
      <Menu.Dropdown miw={220}>
        {sections.map((section) => (
          <Menu.Item
            key={section.id}
            leftSection={section.icon}
            onClick={() => go(sectionHref(tab, section))}
            className={isActive(route, tab, section.id, section.link) ? classes.current : undefined}
          >
            {section.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

/** ⚙: система, тема, выход. */
function SettingsMenu({ route }: { route: Route }) {
  const theme = useTheme();
  return (
    <Menu position="bottom-end" offset={6} radius="md" shadow="lg" withinPortal>
      <Menu.Target>
        <ActionIcon variant={route.tab.id === 'system' ? 'light' : 'subtle'} color="gray" size="lg" radius="xl" aria-label="Настройки">
          <IconSettings size={20} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown miw={220}>
        <Menu.Item leftSection={<IconHeartbeat size={18} />} onClick={() => go(href('system'))}>
          Система
        </Menu.Item>
        <Menu.Item leftSection={theme.dark ? <IconSun size={18} /> : <IconMoon size={18} />} onClick={theme.toggle} closeMenuOnClick={false}>
          {theme.dark ? 'Светлая тема' : 'Тёмная тема'}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item leftSection={<IconLogout size={18} />} color="red" onClick={clearToken}>
          Выйти
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/** Телефон: разделы — на весь экран, вкладки раскрываются списком; настройки — ⚙ в шапке. */
function MobileMenu({ route, opened, close }: { route: Route; opened: boolean; close: () => void }) {
  const open = (hash: string) => {
    go(hash);
    close();
  };
  return (
    <Drawer opened={opened} onClose={close} size="100%" title={<Text fw={700}>We Finance</Text>} hiddenFrom="sm">
      <ScrollArea.Autosize mah="calc(100dvh - 80px)">
        {MENU_TABS.map((tab) => (
          <NavLink key={tab.id} label={tab.label} defaultOpened={activeTab(route) === tab.id} childrenOffset={12} fw={600}>
            {tab.sections
              .filter((section) => !section.hidden)
              .map((section) => (
                <NavLink
                  key={section.id}
                  label={section.label}
                  leftSection={section.icon}
                  active={isActive(route, tab, section.id, section.link)}
                  onClick={() => open(sectionHref(tab, section))}
                />
              ))}
          </NavLink>
        ))}
      </ScrollArea.Autosize>
    </Drawer>
  );
}

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const [menuOpened, menu] = useDisclosure(false);
  const withMonth = MONTH_SCREENS.has(`${route.tab.id}/${route.section.id}`);
  // «Кино» тёмное в любой теме — шапка над ним тоже.
  const stage = route.tab.id === 'home' && route.section.id === 'cinema';

  return (
    <AppShell header={{ height: 64 }} padding="lg" className={classes.shell}>
      <AppShell.Header className={classes.header} data-stage={stage || undefined}>
        {/* Три зоны: меню слева, месяц по центру, ⚙ справа — на любой ширине. */}
        <Box className={classes.bar} px={{ base: 'sm', sm: 'lg' }}>
          <Group gap="xs" wrap="nowrap" className={classes.left}>
            <Burger opened={menuOpened} onClick={menu.toggle} hiddenFrom="sm" size="sm" aria-label="Меню" />
            <Box className={classes.logo} visibleFrom="sm" onClick={() => go(href('home'))}>
              WF
            </Box>
            <Group gap={4} wrap="nowrap" visibleFrom="sm" ml="xs">
              {MENU_TABS.map((tab) => (
                <TabMenu key={tab.id} tab={tab} route={route} />
              ))}
            </Group>
          </Group>
          <Box className={classes.center}>{withMonth && <HeaderMonth />}</Box>
          <Box className={classes.right}>
            <SettingsMenu route={route} />
          </Box>
        </Box>
      </AppShell.Header>

      <MobileMenu route={route} opened={menuOpened} close={menu.close} />

      <AppShell.Main>
        <Box maw={1280} mx="auto">
          {children}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
