import { Group, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import { useState } from 'react';

import type { MonthReport } from '../../api/types';
import classes from './MoneyFlow.module.css';

// Кадр «Куда ушли деньги» (решения заказчика 2026-10-27): поток (диаграмма Санки).
// Сверху — только картинка: доход течёт в группы, группы — в категории; под ней — описание,
// что из чего сложилось. Наведение на строку описания подсвечивает её путь в потоке, и наоборот.
// Всё по факту выписки; сходится с тем, как изменился счёт.

const NEON = '#2ee6d6';
const COLOR: Record<string, string> = {
  mandatory: '#8a94a6',
  managed: NEON,
  unmanaged: '#ff8a5b',
  purchases: '#9b7bff',
  service: '#e6c84a',
  goals: '#5cefe2',
  rest: '#7dff9b',
  income: NEON,
  other: '#5cc8ff',
  savings: '#c9a7ff',
  over: '#ffb347',
};
const rub = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`;
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Child {
  name: string;
  value: number;
}

interface Part {
  key: string;
  name: string;
  value: number;
  color: string;
  children: Child[]; // в потоке: крупнейшие 4 + «ещё N»
  all: Child[]; // в описании: все категории
  note?: string;
}

/** Доход (+ прочие, + из накоплений, + со счёта) → группы трат, отложено, остаток → категории.

Сходится до рубля с тем, как изменился счёт (Решение 2026-10-27): переводы себе и вклады — нейтральны,
в поток попадают одной суммой «отложено и переложено» или источником «из своих накоплений».
*/
function parts(report: MonthReport): { sources: Part[]; groups: Part[]; total: number } {
  const groups: Part[] = report.groups
    .filter((group) => Number(group.amount) > 0)
    .map((group) => {
      const all = group.categories
        .map((category) => ({ name: category.name, value: Number(category.amount) }))
        .filter((child) => child.value > 0)
        .sort((a, b) => b.value - a.value);
      const rest = all.slice(4).reduce((sum, child) => sum + child.value, 0);
      return {
        key: group.code,
        name: group.name,
        value: Number(group.amount),
        color: COLOR[group.code] ?? NEON,
        children: rest > 0 ? [...all.slice(0, 4), { name: `ещё ${all.length - 4}`, value: rest }] : all,
        all,
      };
    });
  const income = Number(report.income);
  const other = Number(report.other_in ?? 0);
  // отложено на вклады и переложено на свои счета — нетто; минус — взято из своих накоплений
  const reserve = Number(report.saved) + Number(report.transfers_out ?? 0) - Number(report.transfers_in ?? 0);
  const sources: Part[] = [
    { key: 'income', name: 'Доход', value: income, color: COLOR.income, children: [], all: [], note: 'зарплата, премии, пособия, кэшбэк' },
  ];
  if (other > 0)
    sources.push({
      key: 'other',
      name: 'Прочие поступления',
      value: other,
      color: COLOR.other,
      children: [],
      all: [],
      note: 'вернули долг, возвраты за покупки',
    });
  if (reserve < 0)
    sources.push({
      key: 'savings',
      name: 'Из своих накоплений',
      value: -reserve,
      color: COLOR.savings,
      children: [],
      all: [],
      note: 'со вкладов, экспресс-счёта и своих карт',
    });
  if (reserve > 0)
    groups.push({
      key: 'goals',
      name: 'Отложено и переложено',
      value: reserve,
      color: COLOR.goals,
      children: [],
      all: [],
      note: 'на вклады, цели и свои счета — не трата',
    });
  const spent = groups.reduce((sum, group) => sum + group.value, 0);
  const came = sources.reduce((sum, source) => sum + source.value, 0);
  const left = came - spent;
  if (left > 0.5) groups.push({ key: 'rest', name: 'Остаток', value: left, color: COLOR.rest, children: [], all: [], note: 'остался на счёте' });
  if (left < -0.5)
    sources.push({ key: 'over', name: 'Со счёта', value: -left, color: COLOR.over, children: [], all: [], note: 'из остатка прошлых месяцев на счёте' });
  return { sources, groups, total: Math.max(came, spent) };
}

// ---------- картинка ----------

const H = 420;
const NODE = 14;
const X = [0, 470, 940];

function ribbon(xa: number, a0: number, a1: number, xb: number, b0: number, b1: number) {
  const m = (xa + xb) / 2;
  return `M${xa},${a0} C${m},${a0} ${m},${b0} ${xb},${b0} L${xb},${b1} C${m},${b1} ${m},${a1} ${xa},${a1} Z`;
}

function centerLine(xa: number, a: number, xb: number, b: number) {
  const m = (xa + xb) / 2;
  return `M${xa},${a} C${m},${a} ${m},${b} ${xb},${b}`;
}

interface Link {
  id: string;
  keys: string[]; // что подсвечивает ленту: группа и источник
  color: string;
  value: number;
  d: string;
  center: string;
}

function Flow({
  sources,
  groups,
  total,
  run,
  hover,
  onHover,
}: {
  sources: Part[];
  groups: Part[];
  total: number;
  run: boolean;
  hover: string | null;
  onHover: (key: string | null) => void;
}) {
  const leaves = groups.reduce((sum, group) => sum + group.children.length, 0);
  const gap = 10;
  const leafGap = 4;
  const k = Math.min((H - gap * (groups.length - 1)) / total, (H - leafGap * Math.max(leaves - 1, 0)) / total);

  // колонки: источники, группы, категории — стопкой сверху вниз
  const stack = (values: number[], space: number) => {
    let y = 0;
    return values.map((value) => {
      const top = y;
      y += value * k + space;
      return [top, top + value * k] as const;
    });
  };
  const src = stack(
    sources.map((s) => s.value),
    gap,
  );
  const grp = stack(
    groups.map((g) => g.value),
    gap,
  );
  const leaf = stack(
    groups.flatMap((group) => group.children.map((child) => child.value)),
    leafGap,
  );

  const links: Link[] = [];
  // источники → группы: группы «наливаются» по очереди из дохода, остаток — из «сверх дохода»
  let s = 0;
  let sUsed = 0;
  groups.forEach((group, g) => {
    let need = group.value;
    let gUsed = 0;
    while (need > 0.5 && s < sources.length) {
      const take = Math.min(need, sources[s].value - sUsed);
      const a0 = src[s][0] + sUsed * k;
      const b0 = grp[g][0] + gUsed * k;
      links.push({
        id: `${sources[s].key}-${group.key}`,
        keys: [group.key, sources[s].key],
        color: sources[s].key === 'income' ? group.color : sources[s].color,
        value: take,
        d: ribbon(X[0] + NODE, a0, a0 + take * k, X[1], b0, b0 + take * k),
        center: centerLine(X[0] + NODE, a0 + (take * k) / 2, X[1], b0 + (take * k) / 2),
      });
      need -= take;
      gUsed += take;
      sUsed += take;
      if (sUsed >= sources[s].value - 0.5) {
        s += 1;
        sUsed = 0;
      }
    }
  });
  // группы → категории
  let l = 0;
  groups.forEach((group, g) => {
    let used = 0;
    for (const child of group.children) {
      const a0 = grp[g][0] + used * k;
      const [b0, b1] = leaf[l];
      links.push({
        id: `${group.key}-${l}`,
        keys: [group.key],
        color: group.color,
        value: child.value,
        d: ribbon(X[1] + NODE, a0, a0 + child.value * k, X[2], b0, b1),
        center: centerLine(X[1] + NODE, a0 + (child.value * k) / 2, X[2], (b0 + b1) / 2),
      });
      used += child.value;
      l += 1;
    }
  });

  const lit = (keys: string[]) => (hover && !keys.includes(hover) ? 0.1 : 1);
  const height = Math.max(H, leaf.at(-1)?.[1] ?? 0, grp.at(-1)?.[1] ?? 0);

  return (
    <svg viewBox={`-4 -4 ${X[2] + NODE + 8} ${height + 8}`} className={classes.flow} onMouseLeave={() => onHover(null)}>
      <defs>
        <clipPath id="flow-reveal">
          <rect x={-4} y={-4} width={X[2] + NODE + 8} height={height + 8} className={`${classes.reveal} ${run ? classes.revealed : ''}`} />
        </clipPath>
      </defs>
      <g clipPath="url(#flow-reveal)">
        {links.map((link) => (
          <path
            key={link.id}
            d={link.d}
            fill={link.color}
            fillOpacity={0.22 * lit(link.keys)}
            stroke={link.color}
            strokeOpacity={0.5 * lit(link.keys)}
            strokeWidth={0.6}
            onMouseEnter={() => onHover(link.keys[0])}
            className={classes.ribbon}
          />
        ))}
        {/* искры: деньги текут по лентам */}
        {run &&
          !reduced() &&
          links.flatMap((link) =>
            Array.from({ length: Math.max(1, Math.round((link.value / total) * 14)) }, (_, i) => (
              <circle
                key={`${link.id}-${i}`}
                r={2.6}
                fill="#fff"
                opacity={lit(link.keys)}
                style={{ filter: `drop-shadow(0 0 4px ${link.color}) drop-shadow(0 0 8px ${link.color})` }}
              >
                <animateMotion dur={`${2.6 + (i % 3) * 0.4}s`} begin={`${1.6 + i * 0.45}s`} repeatCount="indefinite" path={link.center} />
              </circle>
            )),
          )}
        {sources.map((source, i) => (
          <rect
            key={source.key}
            x={X[0]}
            y={src[i][0]}
            width={NODE}
            height={src[i][1] - src[i][0]}
            rx={3}
            fill={source.color}
            opacity={lit([source.key])}
            onMouseEnter={() => onHover(source.key)}
            style={{ filter: `drop-shadow(0 0 6px ${source.color})` }}
          />
        ))}
        {groups.map((group, i) => (
          <rect
            key={group.key}
            x={X[1]}
            y={grp[i][0]}
            width={NODE}
            height={Math.max(grp[i][1] - grp[i][0], 1.5)}
            rx={3}
            fill={group.color}
            opacity={lit([group.key])}
            onMouseEnter={() => onHover(group.key)}
            style={{ filter: `drop-shadow(0 0 6px ${group.color})` }}
          />
        ))}
        {groups
          .flatMap((group) => group.children.map(() => group))
          .map((group, i) => (
            <rect
              key={i}
              x={X[2]}
              y={leaf[i][0]}
              width={NODE}
              height={Math.max(leaf[i][1] - leaf[i][0], 1.5)}
              rx={3}
              fill={group.color}
              opacity={lit([group.key])}
            />
          ))}
      </g>
    </svg>
  );
}

// ---------- описание ----------

function Breakdown({
  sources,
  groups,
  run,
  hover,
  onHover,
}: {
  sources: Part[];
  groups: Part[];
  run: boolean;
  hover: string | null;
  onHover: (key: string | null) => void;
}) {
  const income = sources[0].value;
  const card = (part: Part, index: number) => (
    <UnstyledButton
      key={part.key}
      className={`${classes.card} ${run ? classes.cardIn : ''}`}
      style={{
        borderColor: hover === part.key ? part.color : undefined,
        opacity: hover && hover !== part.key ? 0.4 : 1,
        transitionDelay: `${1.6 + index * 0.08}s`,
      }}
      onMouseEnter={() => onHover(part.key)}
      onMouseLeave={() => onHover(null)}
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Group gap={8} wrap="nowrap">
          <span className={classes.dot} style={{ background: part.color, boxShadow: `0 0 8px ${part.color}` }} />
          <Text fw={800} c={part.color}>
            {part.name}
          </Text>
        </Group>
        <Stack gap={0} align="flex-end">
          <Text fw={800} fz={18}>
            {rub(part.value)}
          </Text>
          {income > 0 && (
            <Text size="xs" c="dimmed">
              {Math.round((part.value / income) * 100)} % дохода
            </Text>
          )}
        </Stack>
      </Group>
      {part.note && (
        <Text size="xs" c="dimmed" mt={4}>
          {part.note}
        </Text>
      )}
      {part.all.length > 0 && (
        <Stack gap={2} mt={8}>
          {part.all.map((child) => (
            <Group key={child.name} justify="space-between" wrap="nowrap">
              <Text size="sm" c="#cfd6dd">
                {child.name}
              </Text>
              <Text size="sm" fw={600}>
                {rub(child.value)}
              </Text>
            </Group>
          ))}
        </Stack>
      )}
    </UnstyledButton>
  );
  return (
    <Stack gap="md">
      <Text className={classes.caption}>Откуда пришло</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {sources.map(card)}
      </SimpleGrid>
      <Text className={classes.caption}>Куда ушло</Text>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {groups.map((group, i) => card(group, i + sources.length))}
      </SimpleGrid>
    </Stack>
  );
}

export function MoneyFlow({ report, run }: { report: MonthReport; run: boolean }) {
  const [hover, setHover] = useState<string | null>(null);
  const { sources, groups, total } = parts(report);
  if (total <= 0) return <Text c="dimmed">За этот месяц выписки нет — потоку не из чего течь.</Text>;
  return (
    <Stack gap={48}>
      <Flow sources={sources} groups={groups} total={total} run={run} hover={hover} onHover={setHover} />
      <Breakdown sources={sources} groups={groups} run={run} hover={hover} onHover={setHover} />
    </Stack>
  );
}
