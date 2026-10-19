import {
  IconBuildingBank,
  IconCalculator,
  IconCalendarStats,
  IconCirclePlus,
  IconDatabaseExport,
  IconHeartbeat,
  IconListDetails,
  IconSparkles,
  IconUserDollar,
  IconUserMinus,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

// Навигация: вкладки сверху, разделы вкладки — иконки в левой колонке. Адрес: #вкладка/раздел[/параметр].

export type TabId = 'salary' | 'loans' | 'calculator' | 'service' | 'backups';

export interface Section {
  id: string;
  label: string;
  icon: ReactNode;
}

export interface Tab {
  id: TabId;
  label: string;
  sections: Section[];
}

const size = 20;

export const TABS: Tab[] = [
  {
    id: 'salary',
    label: 'Зарплата',
    sections: [
      { id: 'profile', label: 'Профиль и расчёт', icon: <IconUserDollar size={size} /> },
      { id: 'year', label: 'Отчёт за год', icon: <IconCalendarStats size={size} /> },
      { id: 'absence', label: 'Отсутствие', icon: <IconUserMinus size={size} /> },
      { id: 'whatif', label: 'Что если', icon: <IconSparkles size={size} /> },
    ],
  },
  {
    id: 'loans',
    label: 'Кредиты',
    sections: [
      { id: 'list', label: 'Мои кредиты', icon: <IconListDetails size={size} /> },
      { id: 'create', label: 'Новый кредит', icon: <IconCirclePlus size={size} /> },
    ],
  },
  {
    id: 'calculator',
    label: 'Калькулятор',
    sections: [{ id: 'main', label: 'Калькулятор кредита', icon: <IconCalculator size={size} /> }],
  },
  {
    id: 'service',
    label: 'Сервис',
    sections: [{ id: 'main', label: 'Состояние и утилиты', icon: <IconHeartbeat size={size} /> }],
  },
  {
    id: 'backups',
    label: 'Бэкапы',
    sections: [{ id: 'main', label: 'Бэкапы', icon: <IconDatabaseExport size={size} /> }],
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
  const tab = TABS.find((candidate) => candidate.id === tabId) ?? TABS[0];
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
