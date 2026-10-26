import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconCalculator,
  IconPigMoney,
  IconPlus,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { expensesApi } from "../../api/endpoints";
import type { SavingsGoal, SavingsGoalIn } from "../../api/types";
import { confirmAction } from "../../lib/confirm";
import { money, todayIso } from "../../lib/format";
import { useOrSample } from "../../lib/sample";
import { PageHeader, Panel } from "../Cards";
import { ErrorAlert, errorText } from "../ErrorAlert";
import { DateField, MoneyField } from "../fields";
import {
  MonthSwitch,
  currentMonth,
  monthTitle,
  shiftMonth,
  useSelectedMonth,
} from "./common";

/** «2027-08» → «август 2027». */
function etaTitle(eta: string | null): string {
  return eta ? monthTitle(eta).toLowerCase() : "не достигается";
}

const EMPTY: SavingsGoalIn = {
  name: "",
  target_amount: "",
  deadline: null,
  monthly_amount: null,
  initial_amount: "0",
};

/** Цели накоплений: подушка, квартира, свадьба. «Сначала себе»: план откладывается до трат. */
export function GoalsSection() {
  const [month, setMonth] = useSelectedMonth();
  const goals = useOrSample(
    () => expensesApi.goals(month),
    [] as SavingsGoal[],
    `goals/${month}`,
  );
  const [editing, setEditing] = useState<{
    id: string | null;
    goal: SavingsGoalIn;
  } | null>(null);
  const [saving, setSaving] = useState<SavingsGoal | null>(null);

  const list = goals.data ?? [];
  const plan = list.reduce((sum, goal) => sum + Number(goal.plan), 0);
  const real = list.reduce((sum, goal) => sum + Number(goal.contribution), 0);
  const short = plan - real > 0.5;

  const act = async (call: () => Promise<unknown>, title: string) => {
    try {
      await call();
      notifications.show({ color: "teal", title, message: "" });
      goals.reload();
      return true;
    } catch (error) {
      notifications.show({
        color: "red",
        title: "Не сохранилось",
        message: errorText(error),
      });
      return false;
    }
  };

  const remove = async (goal: SavingsGoal) => {
    const ok = await confirmAction({
      title: `Удалить цель «${goal.name}»?`,
      message: (
        <Text size="sm">
          Ручные взносы удалятся, накопительные счета отвяжутся. Операции в
          выписке останутся.
        </Text>
      ),
      confirmLabel: "Удалить",
      danger: true,
    });
    if (ok) await act(() => expensesApi.deleteGoal(goal.id), "Цель удалена");
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <PageHeader
          title="Цели"
          subtitle="Подушка, квартира, свадьба. «Сначала себе»: план откладывается раньше трат, траты — из того, что осталось."
        />
        <Group gap="sm">
          <MonthSwitch month={month} onChange={setMonth} />
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setEditing({ id: null, goal: { ...EMPTY } })}
          >
            Новая цель
          </Button>
        </Group>
      </Group>
      <ErrorAlert error={goals.error} />

      {list.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Panel
            title={`Отложить в ${monthTitle(month).toLowerCase()}`}
            subtitle="Сумма планов всех целей"
          >
            <Text size="xl" fw={700}>
              {money(plan.toFixed(2))}
            </Text>
          </Panel>
          <Panel
            title="Реально получается"
            subtitle="Доход − обязательные − границы трат"
          >
            <Text size="xl" fw={700} c={short ? "orange" : "teal"}>
              {money(real.toFixed(2))}
            </Text>
          </Panel>
        </SimpleGrid>
      )}
      {short && (
        <Alert
          color="orange"
          radius="lg"
          variant="light"
          icon={<IconAlertTriangle size={18} />}
          title={`Не хватает ${money((plan - real).toFixed(2))} в месяц`}
        >
          <Text size="sm">
            Границы трат не оставляют места для всех планов — цели получают
            деньги пропорционально и сдвигаются. Ужать границы можно в
            «Категориях».
          </Text>
        </Alert>
      )}
      {list.length === 0 && !goals.loading && (
        <Alert
          color="blue"
          radius="lg"
          variant="light"
          icon={<IconPigMoney size={18} />}
          title="Целей пока нет"
        >
          <Text size="sm">
            Начни с подушки: «Новая цель» → «Посчитать по моим тратам».
          </Text>
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
        {list.map((goal) => {
          const progress = Math.min(
            (Number(goal.saved) / Number(goal.target_amount)) * 100,
            100,
          );
          // Не достигается при таком взносе — тревога и для цели без срока.
          const late =
            !goal.eta ||
            Boolean(goal.deadline && goal.eta > goal.deadline.slice(0, 7));
          return (
            <Panel
              key={goal.id}
              title={goal.name}
              subtitle={
                goal.deadline
                  ? `к ${monthTitle(goal.deadline.slice(0, 7)).toLowerCase()}`
                  : `по ${money(goal.monthly_amount)} в месяц`
              }
            >
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={600}>
                    {money(goal.saved)}
                  </Text>
                  <Text size="sm" c="dimmed">
                    из {money(goal.target_amount)}
                  </Text>
                </Group>
                <Progress
                  value={progress}
                  size="lg"
                  color={progress >= 100 ? "teal" : "brand"}
                />
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    план в месяц
                  </Text>
                  <Text size="sm">{money(goal.plan)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    реально откладывается
                  </Text>
                  <Text
                    size="sm"
                    c={
                      Number(goal.contribution) < Number(goal.plan)
                        ? "orange"
                        : undefined
                    }
                  >
                    {money(goal.contribution)}
                  </Text>
                </Group>
                <Badge
                  variant="light"
                  color={progress >= 100 ? "teal" : late ? "red" : "teal"}
                  radius="sm"
                >
                  {progress >= 100
                    ? "достигнута"
                    : !goal.eta
                      ? "при таком взносе не достигается"
                      : goal.deadline
                        ? `${late ? "не успеваешь" : "успеваешь"}: ${etaTitle(goal.eta)}`
                        : `достигнешь: ${etaTitle(goal.eta)}`}
                </Badge>
                <Text size="xs" c="dimmed">
                  {goal.account_tails.length
                    ? `Накопительный счёт ${goal.account_tails.map((tail) => `…${tail}`).join(", ")} — переводы на него засчитываются сами`
                    : "Счёта нет — откладывай кнопкой «Отложил» или привяжи счёт в «Своих счетах»"}
                </Text>
                <Group gap="xs" mt="xs">
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => setSaving(goal)}
                  >
                    Отложил
                  </Button>
                  <Button
                    size="xs"
                    variant="default"
                    onClick={() =>
                      setEditing({
                        id: goal.id,
                        goal: {
                          name: goal.name,
                          target_amount: goal.target_amount,
                          deadline: goal.deadline,
                          monthly_amount: goal.monthly_amount,
                          initial_amount: goal.initial_amount,
                        },
                      })
                    }
                  >
                    Изменить
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => remove(goal)}
                  >
                    Удалить
                  </Button>
                </Group>
              </Stack>
            </Panel>
          );
        })}
      </SimpleGrid>

      {editing && (
        <GoalForm
          initial={editing.goal}
          title={editing.id ? "Изменить цель" : "Новая цель"}
          onClose={() => setEditing(null)}
          onSave={async (goal) => {
            const ok = await act(
              () =>
                editing.id
                  ? expensesApi.updateGoal(editing.id, goal)
                  : expensesApi.createGoal(goal),
              "Цель сохранена",
            );
            if (ok) setEditing(null);
          }}
        />
      )}
      {saving && (
        <ContributionForm
          goal={saving}
          onClose={() => setSaving(null)}
          onSave={async (day, amount, comment) => {
            const ok = await act(
              () =>
                expensesApi.addContribution(saving.id, {
                  day,
                  amount,
                  comment,
                }),
              `«${saving.name}»: ${money(amount)}`,
            );
            if (ok) setSaving(null);
          }}
        />
      )}
    </Stack>
  );
}

/** Подушка = 6 × сумма медиан обязательных и управляемых категорий (без «Покупок»).

Медиана по каждой категории, а не по группе: месяцы с ЧДП или разовой покупкой не раздувают сумму.
Берутся только месяцы, целиком покрытые выпиской.
*/
async function cushion(): Promise<{
  total: number;
  monthly: number;
  parts: { name: string; median: number }[];
  months: number;
} | null> {
  const current = currentMonth();
  const analysis = await expensesApi.analysis(
    shiftMonth(current, -6),
    shiftMonth(current, -1),
  );
  const parts = analysis.stats
    .filter(
      (stat) =>
        stat.kind === "category" &&
        (stat.group_code === "mandatory" || stat.group_code === "managed") &&
        stat.name !== "Покупки",
    )
    .map((stat) => ({ name: stat.name, median: Number(stat.median) }))
    .filter((part) => part.median > 0)
    .sort((a, b) => b.median - a.median);
  const monthly = parts.reduce((sum, part) => sum + part.median, 0);
  if (monthly <= 0) return null;
  return {
    total: Math.ceil((monthly * 6) / 10000) * 10000,
    monthly,
    parts,
    months: analysis.months.length,
  };
}

const rub = (value: number) => `${Math.round(value).toLocaleString("ru-RU")} ₽`;

/** Месяцев от текущего до месяца срока включительно — как считает план на backend. */
function monthsUntil(deadline: string): number {
  const [year, month] = currentMonth().split("-").map(Number);
  const [dy, dm] = deadline.split("-").map(Number);
  return Math.max((dy - year) * 12 + dm - month + 1, 1);
}

function GoalForm({
  initial,
  title,
  onClose,
  onSave,
}: {
  initial: SavingsGoalIn;
  title: string;
  onClose: () => void;
  onSave: (goal: SavingsGoalIn) => void;
}) {
  const [goal, setGoal] = useState<SavingsGoalIn>(initial);
  const [mode, setMode] = useState<"deadline" | "monthly">(
    initial.monthly_amount && !initial.deadline ? "monthly" : "deadline",
  );
  const [suggestion, setSuggestion] = useState<
    Awaited<ReturnType<typeof cushion>> | "empty" | null
  >(null);
  const [free, setFree] = useState<number | null>(null);
  const valid =
    goal.name.trim() &&
    Number(goal.target_amount) > 0 &&
    (mode === "deadline"
      ? Boolean(goal.deadline)
      : Number(goal.monthly_amount) > 0);

  // Свободно в следующем месяце: после обязательных, трат по границам и уже заведённых целей.
  const next = shiftMonth(currentMonth(), 1);
  useEffect(() => {
    expensesApi
      .month(next)
      .then((report) => setFree(Number(report.forecast.unallocated)))
      .catch(() => setFree(null));
  }, [next]);

  // Расчёт по тому, что ввёл пользователь: к сроку → взнос в месяц, взносом → месяц достижения.
  const left =
    Number(goal.target_amount || 0) - Number(goal.initial_amount || 0);
  let calc: { monthly: number; months: number } | null = null;
  if (left > 0 && mode === "deadline" && goal.deadline) {
    const months = monthsUntil(goal.deadline);
    calc = { monthly: Math.ceil(left / months), months };
  } else if (
    left > 0 &&
    mode === "monthly" &&
    Number(goal.monthly_amount) > 0
  ) {
    const monthly = Number(goal.monthly_amount);
    calc = { monthly, months: Math.ceil(left / monthly) };
  }
  const finish = calc
    ? monthTitle(shiftMonth(currentMonth(), calc.months - 1)).toLowerCase()
    : "";

  return (
    <Modal opened onClose={onClose} title={title} radius="lg" centered>
      <Stack gap="sm">
        <TextInput
          label="Название"
          placeholder="Подушка, квартира, свадьба…"
          value={goal.name}
          onChange={(event) =>
            setGoal({ ...goal, name: event.currentTarget.value })
          }
          radius="md"
        />
        <MoneyField
          label="Сколько нужно"
          value={goal.target_amount}
          onChange={(target_amount) => setGoal({ ...goal, target_amount })}
          width={200}
        />
        <MoneyField
          label="Уже отложено"
          description="До начала учёта в приложении"
          value={goal.initial_amount ?? "0"}
          onChange={(initial_amount) =>
            setGoal({ ...goal, initial_amount: initial_amount || "0" })
          }
          width={200}
        />
        <SegmentedControl
          value={mode}
          onChange={(value) => setMode(value as "deadline" | "monthly")}
          data={[
            { value: "deadline", label: "К сроку" },
            { value: "monthly", label: "Взнос в месяц" },
          ]}
        />
        {mode === "deadline" ? (
          <DateField
            label="Срок"
            value={goal.deadline ?? ""}
            onChange={(deadline) =>
              setGoal({ ...goal, deadline: deadline || null })
            }
            width={200}
          />
        ) : (
          <MoneyField
            label="Откладывать в месяц"
            value={goal.monthly_amount ?? ""}
            onChange={(monthly_amount) =>
              setGoal({ ...goal, monthly_amount: monthly_amount || null })
            }
            width={200}
          />
        )}

        {calc && (
          <Alert
            color={free !== null && calc.monthly > free ? "orange" : "teal"}
            radius="md"
            variant="light"
            title="Расчёт"
          >
            <Stack gap={4}>
              <Text size="sm">
                {mode === "deadline"
                  ? `Откладывать ${rub(calc.monthly)} в месяц — ${calc.months} мес., последний взнос в ${finish}.`
                  : `Соберёшь за ${calc.months} мес. — к ${finish}.`}
              </Text>
              {free !== null && (
                <Text size="sm" c={calc.monthly > free ? "orange" : "dimmed"}>
                  {free <= 0
                    ? `Свободных денег в ${monthTitle(next).toLowerCase()} нет: всё уходит на обязательные, траты по границам и другие цели.`
                    : calc.monthly > free
                      ? `Свободно в ${monthTitle(next).toLowerCase()} ≈ ${rub(free)} — не хватает ${rub(calc.monthly - free)}; цели поделят свободное пропорционально и сдвинутся.`
                      : `Свободно в ${monthTitle(next).toLowerCase()} ≈ ${rub(free)} — влезает, останется ${rub(free - calc.monthly)}.`}
                </Text>
              )}
            </Stack>
          </Alert>
        )}
        {left <= 0 && Number(goal.target_amount) > 0 && (
          <Text size="sm" c="teal">
            Уже отложено не меньше нужного — цель достигнута.
          </Text>
        )}

        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconCalculator size={14} />}
          w="fit-content"
          onClick={async () =>
            setSuggestion((await cushion().catch(() => null)) ?? "empty")
          }
        >
          Сколько нужно на подушку по моим тратам?
        </Button>
        {suggestion === "empty" && (
          <Text size="xs" c="dimmed">
            Мало данных: нужна выписка хотя бы за пару полных месяцев.
          </Text>
        )}
        {suggestion && suggestion !== "empty" && (
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              На жизнь в месяц ≈ {rub(suggestion.monthly)} (медианы:{" "}
              {suggestion.parts
                .map((part) => `${part.name} ${rub(part.median)}`)
                .join(", ")}
              ). Подушка на 6 месяцев ≈ {rub(suggestion.total)}.
            </Text>
            <Button
              size="xs"
              variant="light"
              w="fit-content"
              onClick={() =>
                setGoal({
                  ...goal,
                  target_amount: suggestion.total.toFixed(2),
                  name: goal.name || "Подушка",
                })
              }
            >
              Подставить {rub(suggestion.total)}
            </Button>
          </Stack>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={!valid}
            onClick={() =>
              onSave({
                name: goal.name.trim(),
                target_amount: Number(goal.target_amount).toFixed(2),
                deadline: mode === "deadline" ? goal.deadline : null,
                monthly_amount:
                  mode === "monthly"
                    ? Number(goal.monthly_amount).toFixed(2)
                    : null,
                initial_amount: Number(goal.initial_amount || 0).toFixed(2),
              })
            }
          >
            Сохранить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function ContributionForm({
  goal,
  onClose,
  onSave,
}: {
  goal: SavingsGoal;
  onClose: () => void;
  onSave: (day: string, amount: string, comment: string | null) => void;
}) {
  const [day, setDay] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const value = Number(amount);
  return (
    <Modal
      opened
      onClose={onClose}
      title={`«${goal.name}»: отложил или снял`}
      radius="lg"
      centered
    >
      <Stack gap="sm">
        <Text size="xs" c="dimmed">
          Для наличных и других банков. Переводы на привязанный накопительный
          счёт засчитываются сами — их сюда не вноси.
        </Text>
        <SegmentedControl
          value={direction}
          onChange={(next) => setDirection(next as "in" | "out")}
          data={[
            { value: "in", label: "Отложил" },
            { value: "out", label: "Снял" },
          ]}
        />
        <MoneyField
          label="Сумма"
          value={amount}
          onChange={setAmount}
          width={200}
        />
        <DateField label="Когда" value={day} onChange={setDay} width={200} />
        <TextInput
          label="Комментарий"
          value={comment}
          onChange={(event) => setComment(event.currentTarget.value)}
          radius="md"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button
            disabled={!(value > 0) || !day}
            onClick={() =>
              onSave(
                day,
                ((direction === "in" ? 1 : -1) * value).toFixed(2),
                comment.trim() || null,
              )
            }
          >
            Сохранить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
