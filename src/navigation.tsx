import {
  IconBuildingBank,
  IconArchive,
  IconCalculator,
  IconChartBar,
  IconCirclePlus,
  IconHeartbeat,
  IconHome,
  IconListDetails,
  IconSparkles,
  IconUserEdit,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

// Навигация: вкладки сверху, разделы вкладки — иконки в левой колонке. Адрес: #вкладка/раздел[/параметр].

export type TabId = 'home' | 'income' | 'loans' | 'calculator' | 'system';

export interface Section {
  id: string;
  label: string;
  icon: ReactNode;
  /** Не показывать в колонке иконок: на раздел ведёт кнопка со страницы. */
  hidden?: boolean;
}

export interface Tab {
  id: TabId;
  label: string;
  sections: Section[];
  /** Не показывать в верхних вкладках: вход — по шестерёнке в шапке. */
  hidden?: boolean;
}

const size = 20;

export const TABS: Tab[] = [
  {
    id: 'home',
    label: 'Главная',
    // Скрыта до решения, что на ней (заказчик, 2026-10-26).
    hidden: true,
    sections: [{ id: 'main', label: 'Этот месяц', icon: <IconHome size={size} /> }],
  },
  {
    id: 'income',
    label: 'Доходы',
    sections: [
      { id: 'overview', label: 'Отчёт', icon: <IconChartBar size={size} /> },
      { id: 'whatif', label: 'Что если', icon: <IconSparkles size={size} /> },
      { id: 'data', label: 'Мои данные', icon: <IconUserEdit size={size} />, hidden: true },
    ],
  },
  {
    id: 'loans',
    label: 'Кредиты',
    sections: [
      { id: 'list', label: 'Мои кредиты', icon: <IconListDetails size={size} /> },
      { id: 'archive', label: 'Архив', icon: <IconArchive size={size} /> },
      { id: 'create', label: 'Новый кредит', icon: <IconCirclePlus size={size} /> },
    ],
  },
  {
    id: 'calculator',
    label: 'Калькулятор',
    sections: [{ id: 'main', label: 'Калькулятор кредита', icon: <IconCalculator size={size} /> }],
  },
  {
    id: 'system',
    label: 'Система',
    hidden: true,
    sections: [
      { id: 'status', label: 'Состояние и утилиты', icon: <IconHeartbeat size={size} /> },
    ],
  },
];

export const BANK_ICON = <IconBuildingBank size={size} />;

export interface Route {
  tab: Tab;
  section: Section;
  param?: string;
}

function parse(hash: string): Route {
  const [tabId, sectionId, ...rest] = hash.replace(/^#\/?/, '').split('/');
  const tab = TABS.find((candidate) => candidate.id === tabId) ?? TABS.find((candidate) => !candidate.hidden) ?? TABS[0];
  const section = tab.sections.find((candidate) => candidate.id === sectionId) ?? tab.sections[0];
  const param = rest.length ? decodeURIComponent(rest.join('/')) : undefined;
  return { tab, section, param };
}

export function href(tab: TabId, section?: string): string {
  return section ? `#${tab}/${section}` : `#${tab}`;
}

/** Текущий маршрут из адреса; работают «назад/вперёд» браузера и ссылки на раздел. */
export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const update = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return route;
}
