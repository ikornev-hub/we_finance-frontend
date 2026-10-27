import { Alert, Button, Group, Menu, Modal, Select, Stack, Switch, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconBeach,
  IconChevronDown,
  IconDeviceFloppy,
  IconInfoCircle,
  IconRefresh,
  IconSparkles,
  IconUserEdit,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import { expensesApi, salaryApi } from '../api/endpoints';
import { SampleNotice, useSelectedYear } from '../components/expenses/common';
import { SAMPLE_INCOME_CHECK } from '../lib/expenseSamples';
import { useOrSample } from '../lib/sample';
import type { Absence, AbsenceKind, SalaryProfile, SalaryTerms, WhatIfOut, YearReportOut } from '../api/types';
import { PageHeader, Panel } from '../components/Cards';
import { ErrorAlert } from '../components/ErrorAlert';
import { DateField, MoneyField } from '../components/fields';
import { YearOverview } from '../components/income/YearOverview';
import { ProfileEditor } from '../components/salary/ProfileEditor';
import { confirmAction, notifyDone } from '../lib/confirm';
import { EXAMPLE_PROFILE, EXAMPLE_WHAT_IF, clone } from '../lib/examples';
import { ABSENCE_KIND, date, signedMoney, todayIso } from '../lib/format';
import { useAction } from '../lib/useAction';

export type IncomeSection = 'overview' | 'data';

const go = (section: IncomeSection) => () => (window.location.hash = `#income/${section}`);

export function IncomePage({ section }: { section: IncomeSection }) {
  switch (section) {
    case 'data':
      return <DataSection />;
    default:
      return <OverviewSection />;
  }
}

/** 404 от бэкенда = данных о доходах ещё нет. Для человека это не ошибка, а первый запуск. */
function isNoProfile(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

function NoDataNotice() {
  return (
    <Alert color="blue" radius="lg" variant="light" icon={<IconInfoCircle size={18} />} title="Данных о доходах пока нет">
      <Stack gap="xs">
        <Text size="sm">Чтобы посчитать доходы, заполни условия работы: оклад, питание, отпуска.</Text>
        <div>
          <Button size="xs" variant="light" color="blue" leftSection={<IconUserEdit size={14} />} onClick={go('data')}>
            Заполнить данные
          </Button>
        </div>
      </Stack>
    </Alert>
  );
}

/** «Нет условий на 2025-01-09» от бэкенда → дата, с которой не хватает условий работы. */
function missingTermsDate(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null;
  const text = [error.message, ...error.problems.map((problem) => problem.message)].join(' ');
  return /Нет условий на (\d{4}-\d{2}-\d{2})/.exec(text)?.[1] ?? null;
}

function NoTermsNotice({ day }: { day: string }) {
  return (
    <Alert color="orange" radius="lg" variant="light" icon={<IconInfoCircle size={18} />} title={`Нет условий работы на ${date(day)}`}>
      <Stack gap="xs">
        <Text size="sm">
          Отчёт за {day.slice(0, 4)} год считается по каждому рабочему дню, а условия (оклад, питание) в «Моих данных» начинаются позже. Добавь
          условия, которые действовали с {date(day)} или раньше.
        </Text>
        <div>
          <Button size="xs" variant="light" color="orange" leftSection={<IconUserEdit size={14} />} onClick={go('data')}>
            Добавить условия
          </Button>
        </div>
      </Stack>
    </Alert>
  );
}

function ReportError({ error }: { error: unknown }) {
  if (!error) return null;
  if (isNoProfile(error)) return <NoDataNotice />;
  const day = missingTermsDate(error);
  return day ? <NoTermsNotice day={day} /> : <ErrorAlert error={error} />;
}

// ---------- главная: отчёт ----------

/** 1-е число следующего месяца: «2026-11-01». */
function nextMonthStart(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
}

function OverviewSection() {
  const [year] = useSelectedYear();
  const report = useAction<YearReportOut>();
  const { run, reset } = report;
  const [absenceOpen, absenceModal] = useDisclosure(false);
  const checks = useOrSample(() => expensesApi.incomeCheck(year), SAMPLE_INCOME_CHECK, String(year));
  const [whatIfOn, setWhatIfOn] = useState(false);
  const [terms, setTerms] = useState<SalaryTerms>(clone(EXAMPLE_WHAT_IF));
  const whatIf = useAction<WhatIfOut>();
  const resetWhatIf = whatIf.reset;

  useEffect(() => {
    reset(); // другой год: старый отчёт не показываем, даже если новый не загрузится (#9)
    resetWhatIf();
    void run(() => salaryApi.year(year));
  }, [run, reset, resetWhatIf, year]);

  // «Что если» стартует с текущих условий с 1-го числа следующего месяца; пример — только без профиля (#16).
  useEffect(() => {
    salaryApi
      .getProfile()
      .then((profile) => {
        const current = [...profile.terms].sort((a, b) => a.start.localeCompare(b.start)).at(-1);
        if (current) setTerms({ start: nextMonthStart(), salary: current.salary, meal_per_day: current.meal_per_day });
      })
      .catch(() => undefined);
  }, []);

  const afterAbsence = async (before: string | null) => {
    absenceModal.close();
    const updated = await run(() => salaryApi.year(year));
    resetWhatIf();
    if (updated && before !== null) {
      const change = (Math.round(Number(updated.net) * 100) - Math.round(Number(before) * 100)) / 100;
      notifications.show({
        title: 'Отсутствие добавлено',
        message: `На руки за ${year}: ${signedMoney(change.toFixed(2))}`,
        color: 'teal',
        autoClose: 8000,
      });
    }
  };

  const toggleWhatIf = (on: boolean) => {
    setWhatIfOn(on);
    if (!on) resetWhatIf();
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <PageHeader title={`Доходы ${year}`} subtitle="Сколько и когда приходит: зарплата, отпускные, больничные — за вычетом НДФЛ." />
        <Group gap="md">
          <Switch
            label="Что если"
            checked={whatIfOn}
            onChange={(event) => toggleWhatIf(event.currentTarget.checked)}
            disabled={!report.data}
            thumbIcon={<IconSparkles size={10} />}
          />
          <Menu position="bottom-end" radius="md" shadow="lg">
            <Menu.Target>
              <Button leftSection={<IconUserEdit size={16} />} rightSection={<IconChevronDown size={14} />}>
                Мои данные
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconBeach size={16} />} onClick={absenceModal.open} disabled={!report.data}>
                Отпуск, больничный, день без оплаты
              </Menu.Item>
              <Menu.Item leftSection={<IconRefresh size={16} />} onClick={go('data')}>
                Условия работы и выплаты до учёта
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
      {whatIfOn && (
        <Panel>
          <Group align="flex-end" gap="md">
            <DateField label="Новые условия с" value={terms.start} onChange={(start) => setTerms({ ...terms, start })} />
            <MoneyField label="Оклад" value={terms.salary} width={170} onChange={(salary) => setTerms({ ...terms, salary })} />
            <MoneyField
              label="Питание в день"
              value={terms.meal_per_day}
              width={150}
              onChange={(meal_per_day) => setTerms({ ...terms, meal_per_day })}
            />
            <Button leftSection={<IconSparkles size={16} />} loading={whatIf.loading} onClick={() => whatIf.run(() => salaryApi.whatIf(year, terms))}>
              Посчитать
            </Button>
          </Group>
          <Text size="xs" c="dimmed" mt="xs">
            Новые условия с даты — сколько станет на руки за {year}. Ничего не сохраняет: результат — колонками «Станет» и «Разница».
          </Text>
          {whatIf.error !== null && (
            <Stack mt="md">
              <ReportError error={whatIf.error} />
            </Stack>
          )}
        </Panel>
      )}
      <ReportError error={report.error} />
      {checks.sample && report.data && <SampleNotice what="Сверка выплат с выпиской" />}
      {report.data && <YearOverview report={report.data} checks={checks.data ?? undefined} whatIf={whatIfOn ? whatIf.data : null} />}
      <Modal opened={absenceOpen} onClose={absenceModal.close} title="Отпуск, больничный или день без оплаты" radius="lg" centered>
        <AbsenceForm netBefore={report.data?.net ?? null} onDone={afterAbsence} />
      </Modal>
    </Stack>
  );
}

const KIND_OPTIONS = Object.entries(ABSENCE_KIND).map(([value, label]) => ({ value, label }));

/** Добавить отсутствие в данные и пересчитать отчёт. Удалить потом можно в «Моих данных». */
function AbsenceForm({ netBefore, onDone }: { netBefore: string | null; onDone: (netBefore: string | null) => void }) {
  const today = todayIso();
  const [absence, setAbsence] = useState<Absence>({ kind: 'vacation', start: today, end: today });
  const add = useAction<SalaryProfile>();

  const submit = async () => {
    const saved = await add.run(() => salaryApi.addAbsence(absence));
    if (saved) onDone(netBefore);
  };

  return (
    <Stack gap="md">
      <Select
        label="Что"
        data={KIND_OPTIONS}
        value={absence.kind}
        allowDeselect={false}
        onChange={(kind) => kind && setAbsence({ ...absence, kind: kind as AbsenceKind })}
        radius="md"
      />
      <Group grow>
        <DateField label="С" value={absence.start} onChange={(start) => setAbsence({ ...absence, start })} />
        <DateField label="По (включительно)" value={absence.end} onChange={(end) => setAbsence({ ...absence, end })} />
      </Group>
      <Text size="xs" c="dimmed">
        {ABSENCE_KIND[absence.kind]} {date(absence.start)} – {date(absence.end)}. Отчёт пересчитается сразу; убрать запись можно в
        «Моих данных».
      </Text>
      <ErrorAlert error={add.error} />
      <Group justify="flex-end">
        <Button leftSection={<IconBeach size={16} />} loading={add.loading} onClick={submit}>
          Добавить
        </Button>
      </Group>
    </Stack>
  );
}

// ---------- настройки: мои данные ----------

function DataSection() {
  const [profile, setProfile] = useState<SalaryProfile | null>(null);
  const [isNew, setIsNew] = useState(false);
  const load = useAction<SalaryProfile | null>();
  const save = useAction<SalaryProfile>();
  const { run } = load;

  useEffect(() => {
    void run(async () => {
      try {
        const saved = await salaryApi.getProfile();
        const ready = { ...saved, absences: saved.absences ?? [], history: saved.history ?? [] };
        setProfile(ready);
        return ready;
      } catch (error) {
        if (!isNoProfile(error)) throw error;
        setIsNew(true);
        setProfile(clone(EXAMPLE_PROFILE));
        return null;
      }
    });
  }, [run]);

  const saveProfile = async () => {
    if (!profile) return;
    const ok = await confirmAction({
      title: 'Сохранить данные о доходах?',
      message: <Text size="sm">Данные заменятся целиком тем, что сейчас в форме, и отчёт пересчитается.</Text>,
      confirmLabel: 'Сохранить',
    });
    if (!ok) return;
    const saved = await save.run(() => salaryApi.putProfile(profile));
    if (saved) notifyDone('Данные сохранены', 'Отчёт пересчитан по новым данным.');
    if (saved) window.location.hash = '#income/overview';
  };

  return (
    <Stack gap="lg">
      <Group>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={go('overview')}>
          К отчёту
        </Button>
      </Group>
      <PageHeader
        title="Мои данные"
        subtitle="Условия работы, отпуска и больничные, выплаты до начала учёта. Из них считается отчёт о доходах."
      />
      {isNew && (
        <Alert color="blue" radius="lg" variant="light" icon={<IconInfoCircle size={18} />} title="Это первое заполнение">
          <Text size="sm">В форме — пример. Замени его своими данными и сохрани.</Text>
        </Alert>
      )}
      <ErrorAlert error={load.error} />
      {profile && <ProfileEditor value={profile} onChange={setProfile} />}
      {profile && (
        <Panel>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Данные хранятся в базе; копии базы делает сервер.
            </Text>
            <Group gap="sm">
              <Button variant="default" onClick={go('overview')}>
                Отмена
              </Button>
              <Button leftSection={<IconDeviceFloppy size={16} />} loading={save.loading} onClick={saveProfile}>
                Сохранить
              </Button>
            </Group>
          </Group>
          <Stack mt={save.error ? 'md' : 0}>
            <ErrorAlert error={save.error} />
          </Stack>
        </Panel>
      )}
    </Stack>
  );
}
