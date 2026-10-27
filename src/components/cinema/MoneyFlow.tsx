import { SegmentedControl, Stack, Text, Tooltip } from '@mantine/core';
import { useState } from 'react';

import type { MonthReport } from '../../api/types';
import classes from './MoneyFlow.module.css';

// Кадр «Куда ушли деньги» (решение заказчика 2026-10-27): два варианта на выбор.
// «Поток» — доход течёт неоновой рекой в группы, группы — в категории (диаграмма Санки).
// «Купюра» — доход одной купюрой режется на куски по группам.
// Всё по факту выписки; цели и остаток — тоже. Траты больше дохода — красный «сверх дохода».

const NEON = '#2ee6d6';
const RED = '#ff4d5e';
const COLOR: Record<string, string> = {
  mandatory: '#8a94a6',
  managed: NEON,
  unmanaged: '#ff8a5b',
  purchases: '#9b7bff',
  service: '#e6c84a',
  goals: '#5cefe2',
  rest: '#7dff9b',
  income: NEON,
  over: RED,
};
const rub = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`;
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Part {
  key: string;
  name: string;
  value: number;
  color: string;
  children: { name: string; value: number }[];
}

/** Доход → группы (+ цели и остаток) → категории; перерасход — второй источник. */
function parts(report: MonthReport): { sources: Part[]; groups: Part[]; total: number } {
  const groups: Part[] = report.groups
    .filter((group) => Number(group.amount) > 0)
    .map((group) => {
      const children = group.categories
        .map((category) => ({ name: category.name, value: Number(category.amount) }))
        .filter((child) => child.value > 0)
        .sort((a, b) => b.value - a.value);
      const top = children.slice(0, 4);
      const rest = children.slice(4).reduce((sum, child) => sum + child.value, 0);
      return {
        key: group.code,
        name: group.name,
        value: Number(group.amount),
        color: COLOR[group.code] ?? NEON,
        children: rest > 0 ? [...top, { name: `ещё ${children.length - 4}`, value: rest }] : top,
      };
    });
  const income = Number(report.income);
  const saved = Number(report.saved);
  if (saved > 0) groups.push({ key: 'goals', name: 'Цели', value: saved, color: COLOR.goals, children: [] });
  const spent = groups.reduce((sum, group) => sum + group.value, 0);
  const left = income - spent;
  if (left > 0) groups.push({ key: 'rest', name: 'Остаток', value: left, color: COLOR.rest, children: [] });
  const sources: Part[] = [{ key: 'income', name: 'Доход', value: income, color: COLOR.income, children: [] }];
  if (left < 0) sources.push({ key: 'over', name: 'Сверх дохода', value: -left, color: COLOR.over, children: [] });
  return { sources, groups, total: Math.max(income, spent) };
}

// ---------- поток ----------

const W = 1000;
const H = 460;
const NODE = 14;
const X = [0, 420, 780];

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
  group: string;
  color: string;
  value: number;
  d: string;
  center: string;
}

function Flow({ report, run }: { report: MonthReport; run: boolean }) {
  const [hover, setHover] = useState<string | null>(null);
  const { sources, groups, total } = parts(report);
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
  const leafValues = groups.flatMap((group) => group.children.map((child) => child.value));
  const leaf = stack(leafValues, leafGap);

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
        group: group.key,
        color: sources[s].key === 'over' ? RED : group.color,
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
        group: group.key,
        color: group.color,
        value: child.value,
        d: ribbon(X[1] + NODE, a0, a0 + child.value * k, X[2], b0, b1),
        center: centerLine(X[1] + NODE, a0 + (child.value * k) / 2, X[2], (b0 + b1) / 2),
      });
      used += child.value;
      l += 1;
    }
  });

  const dim = (key: string) => (hover && hover !== key ? 0.12 : 1);
  // подписи не наезжают: каждая не ближе LINE к предыдущей, лишнее сдвигается вниз
  const LINE = 19;
  const spread = (centers: number[]) => {
    const out: number[] = [];
    centers.forEach((y, i) => out.push(i ? Math.max(y, out[i - 1] + LINE) : y));
    return out;
  };
  const grpY = spread(grp.map(([a, b]) => (a + b) / 2));
  const leafY = spread(leaf.map(([a, b]) => (a + b) / 2));
  const label = (x: number, y: number, name: string, value: number, color: string, anchor: 'start' | 'end' = 'start') => (
    <text x={x} y={y} dy="0.35em" textAnchor={anchor} className={classes.label}>
      <tspan fill={color} fontWeight={700}>
        {name}
      </tspan>
      <tspan dx={8} fill="#fff">
        {rub(value)}
      </tspan>
    </text>
  );

  return (
    <svg viewBox={`-10 -10 ${W + 250} ${Math.max(H, ...leafY, ...grpY) + 30}`} className={classes.flow} onMouseLeave={() => setHover(null)}>
      <defs>
        <clipPath id="flow-reveal">
          <rect x={-10} y={-10} width={W + 240} height={H + 20} className={`${classes.reveal} ${run ? classes.revealed : ''}`} />
        </clipPath>
        <filter id="flow-glow" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <g clipPath="url(#flow-reveal)">
        {links.map((link) => (
          <path
            key={link.id}
            d={link.d}
            fill={link.color}
            fillOpacity={0.22 * dim(link.group)}
            stroke={link.color}
            strokeOpacity={0.5 * dim(link.group)}
            strokeWidth={0.6}
            onMouseEnter={() => setHover(link.group)}
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
                opacity={dim(link.group)}
                style={{ filter: `drop-shadow(0 0 4px ${link.color}) drop-shadow(0 0 8px ${link.color})` }}
              >
                <animateMotion dur={`${2.6 + (i % 3) * 0.4}s`} begin={`${1.6 + i * 0.45}s`} repeatCount="indefinite" path={link.center} />
              </circle>
            )),
          )}
        {sources.map((source, i) => (
          <g key={source.key}>
            <rect
              x={X[0]}
              y={src[i][0]}
              width={NODE}
              height={src[i][1] - src[i][0]}
              rx={3}
              fill={source.color}
              style={{ filter: `drop-shadow(0 0 6px ${source.color})` }}
            />
          </g>
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
            opacity={dim(group.key)}
            onMouseEnter={() => setHover(group.key)}
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
              opacity={dim(group.key)}
            />
          ))}
      </g>
      {/* подписи — после заливки, поверх лент */}
      <g className={`${classes.labels} ${run ? classes.labelsIn : ''}`}>
        {sources.map((source, i) => (
          <text key={source.key} x={X[0] + NODE + 10} y={(src[i][0] + src[i][1]) / 2} dy="0.35em" className={classes.big}>
            <tspan fill={source.color}>{source.name}</tspan>
            <tspan x={X[0] + NODE + 10} dy="1.3em" fill="#fff" fontWeight={800}>
              {rub(source.value)}
            </tspan>
          </text>
        ))}
        {groups.map((group, i) => (
          <g key={group.key} opacity={dim(group.key)}>
            {label(group.children.length ? X[1] - 8 : X[1] + NODE + 10, grpY[i], group.name, group.value, group.color, group.children.length ? 'end' : 'start')}
          </g>
        ))}
        {groups
          .flatMap((group) => group.children.map((child) => ({ group, child })))
          .map(({ group, child }, i) => (
            <g key={i} opacity={dim(group.key)}>
              {label(X[2] + NODE + 10, leafY[i], child.name, child.value, '#cfd6dd')}
            </g>
          ))}
      </g>
    </svg>
  );
}

// ---------- купюра ----------

function Banknote({ report, run }: { report: MonthReport; run: boolean }) {
  const { sources, groups, total } = parts(report);
  const income = sources[0].value;
  const over = sources[1]?.value ?? 0;
  const pieces = groups;
  return (
    <Stack gap="xl">
      <div className={classes.noteWrap}>
        {/* контур дохода: всё, что за ним, — сверх дохода */}
        <div className={classes.incomeEdge} style={{ width: `${(income / total) * 100}%` }}>
          <span>доход {rub(income)}</span>
        </div>
        {over > 0 && (
          <div className={classes.overZone} style={{ left: `${(income / total) * 100}%` }}>
            <span>сверх дохода {rub(over)}</span>
          </div>
        )}
        <div className={classes.note}>
          {pieces.map((part, i) => {
            const width = (part.value / total) * 100;
            const offset = i - (pieces.length - 1) / 2;
            return (
              <Tooltip key={part.key} label={`${part.name}: ${rub(part.value)}`}>
                <div
                  className={classes.piece}
                  style={{
                    width: `${width}%`,
                    background: `linear-gradient(135deg, ${part.color}33, ${part.color}11), repeating-linear-gradient(45deg, ${part.color}22 0 2px, transparent 2px 9px)`,
                    borderColor: part.color,
                    boxShadow: run ? `0 0 18px ${part.color}55` : 'none',
                    transform: run && !reduced() ? `translate(${offset * 14}px, ${(i % 2 ? 1 : -1) * 22}px) rotate(${(i % 2 ? 1 : -1) * 1.5}deg)` : 'none',
                    transitionDelay: `${0.4 + i * 0.12}s`,
                  }}
                >
                  {width > 7 && (
                    <div className={classes.pieceText} style={{ opacity: run ? 1 : 0, transitionDelay: `${1 + i * 0.12}s` }}>
                      <Text fw={800} c={part.color} size="sm">
                        {part.name}
                      </Text>
                      <Text fw={800} fz={20}>
                        {rub(part.value)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {Math.round((part.value / income) * 100)} % дохода
                      </Text>
                    </div>
                  )}
                </div>
              </Tooltip>
            );
          })}
        </div>
      </div>
      {over > 0 && (
        <Text c={RED} fw={700}>
          Потрачено и отложено на {rub(over)} больше дохода — кусок за контуром купюры
        </Text>
      )}
      <Text size="xs" c="dimmed">
        Узкие куски — наведи, чтобы увидеть сумму
      </Text>
    </Stack>
  );
}

// ---------- переключатель ----------

const KEY = 'wf.cinema.flow';

export function MoneyFlow({ report, run }: { report: MonthReport; run: boolean }) {
  const [view, setView] = useState<string>(() => {
    try {
      return localStorage.getItem(KEY) ?? 'flow';
    } catch {
      return 'flow';
    }
  });
  const change = (value: string) => {
    setView(value);
    try {
      localStorage.setItem(KEY, value);
    } catch {
      // без памяти — не беда
    }
  };
  return (
    <Stack gap="lg">
      <SegmentedControl
        value={view}
        onChange={change}
        data={[
          { value: 'flow', label: 'Поток' },
          { value: 'note', label: 'Купюра' },
        ]}
        w="fit-content"
        radius="xl"
      />
      {view === 'flow' ? <Flow key="flow" report={report} run={run} /> : <Banknote key="note" report={report} run={run} />}
    </Stack>
  );
}
