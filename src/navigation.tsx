import {
  IconBuildingBank,
  IconArchive,
  IconCategory,
  IconCreditCard,
  IconFileUpload,
  IconListCheck,
  IconReportMoney,
  IconChartLine,
  IconChartPie,
  IconPigMoney,
  IconCalculator,
  IconChartBar,
  IconCirclePlus,
  IconHeartbeat,
  IconListDetails,
  IconMovie,
  IconUserEdit,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

// Навигация: вкладки в шапке, разделы вкладки — её выпадающий список (на телефоне — бургер). Адрес: #вкладка/раздел[/параметр].

export type TabId = 'home' | 'expenses' | 'goals' | 'income' | 'loans' | 'accounts' | 'calculator' | 'system';

export interface Section {
  id: string;
  label: string;
  icon: ReactNode;
  /** Не показывать в меню: на раздел ведёт кнопка со страницы. */
  hidden?: boolean;
  /** Пункт меню ведёт на другую вкладку (калькулятор — из «Кредитов»). */
  link?: TabId;
}

export interface Tab {
  id: TabId;
  label: string;
  sections: Section[];
  /** Не показывать в шапке: вход — из меню другой вкладки или настроек. */
  hidden?: boolean;
  /** Чья вкладка подсвечивается в шапке, когда открыта эта. */
  parent?: TabId;
}

const size = 20;

export const TABS: Tab[] = [
  {
    id: 'home',
    label: 'Главная',
    sections: [
      // Первый раздел — стартовая страница приложения (решение заказчика 2026-10-27: «Кино»).
      { id: 'cinema', label: 'Кино', icon: <IconMovie size={size} /> },
    ],
  },
  {
    // Расходы — одна страница; остальное — её подстраницы, в меню их нет (решение заказчика 2026-10-27).
    id: 'expenses',
    label: 'Расходы',
    sections: [
      { id: 'month', label: 'Расходы', icon: <IconReportMoney size={size} /> },
      { id: 'budget', label: 'Бюджет и границы', icon: <IconChartPie size={size} />, hidden: true },
      { id: 'analysis', label: 'Анализ', icon: <IconChartLine size={size} />, hidden: true },
      { id: 'review', label: 'Без категории', icon: <IconListCheck size={size} />, hidden: true },
      { id: 'import', label: 'Загрузить выписку', icon: <IconFileUpload size={size} />, hidden: true },
      { id: 'categories', label: 'Категории', icon: <IconCategory size={size} />, hidden: true },
    ],
  },
  {
    id: 'goals',
    label: 'Цели',
    sections: [{ id: 'main', label: 'Цели', icon: <IconPigMoney size={size} /> }],
  },
  {
    id: 'income',
    label: 'Доходы',
    sections: [
      { id: 'overview', label: 'Отчёт', icon: <IconChartBar size={size} /> },
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
      { id: 'calculator', label: 'Калькулятор', icon: <IconCalculator size={size} />, link: 'calculator' },
    ],
  },
  {
    id: 'accounts',
    label: 'Счета',
    sections: [{ id: 'main', label: 'Свои счета', icon: <IconCreditCard size={size} /> }],
  },
  {
    id: 'calculator',
    label: 'Калькулятор',
    hidden: true,
    parent: 'loans',
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
  const tab = TABS.find((candidate) => candidate.id === tabId) ?? TABS[0];
  const section = tab.sections.find((candidate) => candidate.id === sectionId) ?? tab.sections[0];
  const param = rest.length ? decodeURIComponent(rest.join('/')) : undefined;
  return { tab, section, param };
}

export function href(tab: TabId, section?: string): string {
  return section ? `#${tab}/${section}` : `#${tab}`;
}

/** Куда ведёт пункт меню. */
export function sectionHref(tab: Tab, section: Section): string {
  return section.link ? href(section.link) : href(tab.id, section.id);
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
