import { Button, Group, Stack, Text } from '@mantine/core';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { expensesApi, loansApi } from '../api/endpoints';
import type { BalanceView, LoanDetailOut, MonthReport, SavingsGoal } from '../api/types';
import { ErrorAlert } from '../components/ErrorAlert';
import { MonthSwitch, currentMonth, monthTitle, useSelectedMonth } from '../components/expenses/common';
import { date } from '../lib/format';
import { useOrSample } from '../lib/sample';
import { MoneyFlow } from '../components/cinema/MoneyFlow';
import classes from './CinemaPage.module.css';

// Пилот «Кино» (решение заказчика 2026-10-27, референс — промо «Хоум кредит таргет» Студии Лебедева):
// тьма как сцена, живое созвездие, бирюзовый неон для денег, оранжевый — для действий,
// контурная типографика, скролл = смена кадров. Анимации короткие; «уменьшить движение» — без них.

const NEON = '#2ee6d6';
const RED = '#ff4d5e';
const TO_MONTH = ['январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню', 'июлю', 'августу', 'сентябрю', 'октябрю', 'ноябрю', 'декабрю'];
const toMonth = (month: string) => `${TO_MONTH[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
const rub = (value: number) => `${Math.round(value).toLocaleString('ru-RU')} ₽`;
const go = (hash: string) => () => (window.location.hash = hash);
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function useLoad<T>(fn: () => Promise<T>, key: string): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    fn()
      .then((value) => alive && setData(value))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [key]);
  return data;
}

/** Блок «в кадре»: true, когда виден хотя бы на 20 %. Ref — колбэк: элемент может появиться позже. */
function useInView<T extends Element>(): [(node: T | null) => void, boolean] {
  const [node, setNode] = useState<T | null>(null);
  const [seen, setSeen] = useState(reduced());
  useEffect(() => {
    if (!node || seen) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setSeen(true), { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, seen]);
  return [setNode, seen];
}

/** Число «досчитывается» от 0 за ~1,2 с, когда попало в кадр. */
function CountUp({ value, run, style }: { value: number; run: boolean; style?: CSSProperties }) {
  const [shown, setShown] = useState(reduced() ? value : 0);
  useEffect(() => {
    if (!run || reduced()) {
      if (reduced()) setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / 1200, 1);
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, run]);
  return <span style={style}>{rub(shown)}</span>;
}

/** Кадр: проявляется и выезжает снизу, когда до него доскроллили. */
function Scene({ label, title, children }: { label: string; title?: string; children: (visible: boolean) => ReactNode }) {
  const [ref, visible] = useInView<HTMLElement>();
  return (
    <section ref={ref} className={`${classes.scene} ${visible ? classes.visible : ''}`}>
      <Text className={classes.label}>{label}</Text>
      {title && <h2 className={classes.title}>{title}</h2>}
      {children(visible)}
    </section>
  );
}

// ---------- живой фон: созвездие ----------

/** Точки дышат и плывут; месяц в плюсе — бирюзовые и густые, в минусе — краснеют и редеют. */
function Starfield({ mood }: { mood: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const context = canvas.getContext('2d')!;
    let frame = 0;
    const resize = () => {
      canvas.width = window.innerWidth * devicePixelRatio;
      canvas.height = window.innerHeight * devicePixelRatio;
    };
    resize();
    window.addEventListener('resize', resize);
    // плотность — от площади экрана: на широком мониторе тоже «звёздное небо», а не пара точек
    const area = (window.innerWidth * window.innerHeight) / 6000;
    const count = Math.round(area * (0.45 + 0.55 * Math.max(0, Math.min(1, mood))));
    const color = mood >= 0 ? NEON : RED;
    // скопления, как у Лебедева: точки тянутся к нескольким центрам
    const centers = Array.from({ length: 5 }, () => ({ x: Math.random(), y: Math.random() }));
    const stars = Array.from({ length: count }, (_, index) => {
      const center = centers[index % centers.length];
      const loose = Math.random() < 0.45;
      return {
        x: loose ? Math.random() : center.x + (Math.random() - 0.5) * 0.25,
        y: loose ? Math.random() : center.y + (Math.random() - 0.5) * 0.25,
        r: 0.6 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
        speed: 0.00002 + Math.random() * 0.00005,
      };
    });
    const draw = (now: number) => {
      const { width, height } = canvas;
      context.clearRect(0, 0, width, height);
      // сетка тусклых точек — «экран», на котором всё происходит
      context.fillStyle = 'rgba(255,255,255,0.05)';
      const step = 22 * devicePixelRatio;
      for (let x = step / 2; x < width; x += step) for (let y = step / 2; y < height; y += step) context.fillRect(x, y, devicePixelRatio, devicePixelRatio);
      for (const star of stars) {
        const drift = reduced() ? 0 : now * star.speed;
        const x = ((star.x + drift) % 1) * width;
        const y = star.y * height;
        const glow = reduced() ? 0.7 : 0.45 + 0.55 * Math.sin(now / 900 + star.phase) ** 2;
        context.globalAlpha = glow;
        context.shadowBlur = 8 * devicePixelRatio;
        context.shadowColor = color;
        context.fillStyle = color;
        context.beginPath();
        context.arc(x, y, star.r * devicePixelRatio, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      context.shadowBlur = 0;
      if (!reduced()) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [mood]);
  return <canvas ref={ref} className={classes.stars} aria-hidden />;
}

// ---------- полосы трат ----------

function NeonBar({ label, spent, limit, run, strong }: { label: string; spent: number; limit: number | null; run: boolean; strong?: boolean }) {
  const share = limit ? Math.min(spent / limit, 1) : 0;
  const over = limit !== null && spent > limit;
  return (
    <div className={classes.bar}>
      <Group justify="space-between">
        <Text fw={strong ? 800 : 500} tt={strong ? 'uppercase' : undefined} size={strong ? 'sm' : 'sm'} pl={strong ? 0 : 'md'}>
          {label}
        </Text>
        <Text fw={700} c={over ? RED : undefined}>
          {rub(spent)}
          {limit !== null && <span className={classes.dim}> / {rub(limit)}</span>}
        </Text>
      </Group>
      {limit !== null && (
        <div className={classes.track}>
          <div
            className={classes.fill}
            style={{ width: run ? `${share * 100}%` : 0, background: over ? RED : NEON, boxShadow: `0 0 12px ${over ? RED : NEON}` }}
          />
        </div>
      )}
    </div>
  );
}

// ---------- остаток: линия рисуется ----------

function BalanceLine({ balance, run }: { balance: BalanceView; run: boolean }) {
  const expected = balance.expected.map((point) => Number(point.balance));
  const actual = balance.actual.map((point) => Number(point.balance));
  const all = [...expected, ...actual, 0];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const w = 1000;
  const h = 260;
  const x = (i: number) => (i / Math.max(expected.length - 1, 1)) * w;
  const y = (v: number) => h - ((v - min) / (max - min || 1)) * h;
  const path = (values: number[]) => values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = balance.actual.at(-1);
  const expectedAtLast = last ? Number(balance.expected.find((p) => p.day === last.day)?.balance ?? 0) : 0;
  const diff = last ? Number(last.balance) - expectedAtLast : 0;
  return (
    <Stack gap="md">
      <svg viewBox={`0 0 ${w} ${h}`} className={classes.line} preserveAspectRatio="none">
        <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.15)" />
        <path d={path(expected)} className={`${classes.draw} ${run ? classes.drawn : ''}`} stroke="rgba(46,230,214,0.45)" fill="none" strokeWidth={2} />
        <path
          d={path(actual)}
          className={`${classes.draw} ${run ? classes.drawn : ''}`}
          stroke="#f26b3a"
          fill="none"
          strokeWidth={3}
          style={{ filter: 'drop-shadow(0 0 6px #f26b3a)' }}
        />
      </svg>
      <Group gap="xl">
        <Text size="sm">
          <span style={{ color: '#f26b3a' }}>━</span> факт по выписке
        </Text>
        <Text size="sm">
          <span style={{ color: NEON, opacity: 0.6 }}>━</span> ожидание по плану
        </Text>
      </Group>
      {last && (
        <Text fz={22} fw={700}>
          На {date(last.day)} на счёте {rub(Number(last.balance))} —{' '}
          <span style={{ color: diff < 0 ? RED : NEON }}>{diff < 0 ? `на ${rub(-diff)} хуже плана` : `на ${rub(diff)} лучше плана`}</span>
        </Text>
      )}
    </Stack>
  );
}

// ---------- кредит: кольцо ----------

function Ring({ share, run }: { share: number; run: boolean }) {
  const r = 90;
  const length = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 220 220" width={220} height={220}>
      <circle cx={110} cy={110} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={14} fill="none" />
      <circle
        cx={110}
        cy={110}
        r={r}
        stroke={NEON}
        strokeWidth={14}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={run ? length * (1 - share) : length}
        transform="rotate(-90 110 110)"
        style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)', filter: `drop-shadow(0 0 8px ${NEON})` }}
      />
      <text x={110} y={104} textAnchor="middle" fill="#fff" fontSize={40} fontWeight={800}>
        {Math.round(share * 100)}%
      </text>
      <text x={110} y={132} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize={13}>
        долга осталось
      </text>
    </svg>
  );
}

// ---------- страница ----------

export function CinemaPage() {
  const [month, setMonth] = useSelectedMonth();
  const report = useOrSample(() => expensesApi.month(month), null as unknown as MonthReport, `cinema/${month}`);
  const balance = useLoad(() => expensesApi.balance(month), `cb/${month}`);
  const goals = useLoad(() => expensesApi.goals(month), `cg/${month}`) ?? ([] as SavingsGoal[]);
  const loans = useLoad<LoanDetailOut[]>(async () => Promise.all((await loansApi.list()).map((loan) => loansApi.detail(loan.id))), 'cl');
  const [heroRef, heroIn] = useInView<HTMLDivElement>();

  const data = report.data;
  const mood = useMemo(() => {
    if (!data) return 0.5;
    const disposable = Number(data.forecast.disposable);
    const left = Number(data.forecast.can_spend);
    return disposable <= 0 ? -1 : Math.max(-1, Math.min(1, left / disposable));
  }, [data]);

  if (report.error) return <ErrorAlert error={report.error} />;

  return (
    <div className={classes.page}>
      <div className={classes.backdrop} aria-hidden />
      <Starfield mood={mood} />
      <div className={classes.content}>
        <Group justify="flex-end">
          <MonthSwitch month={month} onChange={setMonth} />
        </Group>

        {!data ? (
          <Text c="dimmed">Загружаю…</Text>
        ) : (
          <>
            <div ref={heroRef} className={`${classes.hero} ${heroIn ? classes.visible : ''}`}>
              <h1 className={classes.outline}>{monthTitle(month)}</h1>
              <Text className={classes.label}>Располагаемый бюджет</Text>
              <CountUp
                value={Number(data.forecast.disposable)}
                run={heroIn}
                style={{ fontSize: 'clamp(48px, 9vw, 112px)', fontWeight: 900, color: NEON, textShadow: `0 0 24px ${NEON}` }}
              />
              <Text fz={20} c="dimmed">
                {Number(data.forecast.savings) > 0 && <>в цели {rub(Number(data.forecast.savings))} · </>}
                потрачено {rub(Number(data.forecast.spent))} · осталось{' '}
                <span style={{ color: Number(data.forecast.can_spend) < 0 ? RED : NEON, fontWeight: 700 }}>{rub(Number(data.forecast.can_spend))}</span>
              </Text>
              {month === currentMonth() && (
                <Group mt="lg">
                  <Button size="md" onClick={go('#expenses/import')}>
                    Загрузить выписку
                  </Button>
                  <Button size="md" variant="outline" color="gray" onClick={go('#expenses/budget')}>
                    Бюджет
                  </Button>
                </Group>
              )}
              <Text className={classes.scroll}>листай ↓</Text>
            </div>

            <Scene label="Кадр 1" title="Куда ушли деньги">
              {(visible) => <MoneyFlow report={data} run={visible} />}
            </Scene>

            <Scene label="Кадр 2" title="Траты против границ">
              {(visible) => (
                <Stack gap="lg">
                  {data.groups
                    .filter((group) => ['managed', 'unmanaged', 'purchases'].includes(group.code) && group.categories.length)
                    .map((group) => {
                      const limit = group.target !== null ? Number(group.target) : null;
                      return (
                        <Stack key={group.code} gap={10}>
                          <NeonBar label={group.name} spent={Number(group.amount)} limit={limit} run={visible} strong />
                          {group.categories
                            .filter((category) => Number(category.amount) > 0 || category.target !== null)
                            .map((category) => (
                              <NeonBar
                                key={category.id}
                                label={category.name}
                                spent={Number(category.amount)}
                                limit={category.target === null ? null : Number(category.target)}
                                run={visible}
                              />
                            ))}
                        </Stack>
                      );
                    })}
                </Stack>
              )}
            </Scene>

            {balance && balance.expected.length > 0 && (
              <Scene label="Кадр 3" title="Остаток на счёте">
                {(visible) => <BalanceLine balance={balance} run={visible} />}
              </Scene>
            )}

            {(loans ?? []).map((loan) => {
              const debt = Number(loan.actual.balance);
              const principal = Number(loan.start.balance);
              const goal = goals.find((item) => item.loan_id === loan.id);
              return (
                <Scene key={loan.id} label="Кадр 4" title={loan.name}>
                  {(visible) => (
                    <Group align="center" gap={48} wrap="wrap">
                      <Ring share={debt / principal} run={visible} />
                      <Stack gap={6}>
                        <Text className={classes.label}>осталось долга</Text>
                        <CountUp value={debt} run={visible} style={{ fontSize: 56, fontWeight: 900 }} />
                        <Text c="dimmed">
                          из {rub(principal)} · по графику закроешь {date(loan.actual.close_date)}
                        </Text>
                        {goal?.closes_on && (
                          <Text fz={20} fw={700} c={NEON}>
                            с целью — {date(goal.closes_on)}
                          </Text>
                        )}
                        <Button mt="sm" w="fit-content" onClick={go(`#loans/list/${loan.id}`)}>
                          Открыть кредит
                        </Button>
                      </Stack>
                    </Group>
                  )}
                </Scene>
              );
            })}

            {goals.some((goal) => !goal.loan_id) && (
              <Scene label="Кадр 5" title="Цели">
                {(visible) => (
                  <Stack gap="xl">
                    {goals
                      .filter((goal) => !goal.loan_id)
                      .map((goal) => {
                        const share = Math.min(Number(goal.saved) / Number(goal.target_amount), 1);
                        return (
                          <div key={goal.id}>
                            <Group justify="space-between" align="flex-end">
                              <Text fz={28} fw={800}>
                                {goal.name}
                              </Text>
                              <Text fz={20}>
                                <CountUp value={Number(goal.saved)} run={visible} /> <span className={classes.dim}>/ {rub(Number(goal.target_amount))}</span>
                              </Text>
                            </Group>
                            <div className={classes.track} style={{ height: 12 }}>
                              <div
                                className={classes.fill}
                                style={{ width: visible ? `${share * 100}%` : 0, background: NEON, boxShadow: `0 0 14px ${NEON}` }}
                              />
                            </div>
                            {goal.eta && (
                              <Text size="sm" c="dimmed" mt={6}>
                                {goal.start_date && goal.start_date.slice(0, 7) > month ? `старт ${date(goal.start_date)} · ` : ''}соберёшь к{' '}
                                {toMonth(goal.eta)}
                              </Text>
                            )}
                          </div>
                        );
                      })}
                  </Stack>
                )}
              </Scene>
            )}
          </>
        )}
      </div>
    </div>
  );
}
