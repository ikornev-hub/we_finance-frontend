import { Alert, Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconBeach,
  IconChevronLeft,
  IconChevronRight,
  IconDeviceFloppy,
  IconInfoCircle,
  IconRefresh,
  IconSparkles,
  IconUserEdit,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { ApiError } from '../api/client';
import { salaryApi } from '../api/endpoints';
import type { Absence, AbsenceKind, SalaryProfile, SalaryTerms, WhatIfOut, YearReportOut } from '../api/types';
import { PageHeader, Panel } from '../components/Cards';
import { ErrorAlert } from '../components/ErrorAlert';
import { DateField, IntField, MoneyField } from '../components/fields';
import { YearOverview } from '../components/income/YearOverview';
import { ProfileEditor } from '../components/salary/ProfileEditor';
import { WhatIfView } from '../components/salary/ReportView';
import { confirmAction, notifyDone } from '../lib/confirm';
import { EXAMPLE_PROFILE, EXAMPLE_WHAT_IF, clone } from '../lib/examples';
import { ABSENCE_KIND, date, signedMoney, todayIso } from '../lib/format';
import { useAction } from '../lib/useAction';

export type IncomeSection = 'overview' | 'whatif' | 'data';

const THIS_YEAR = new Date().getFullYear();

const go = (section: IncomeSection) => () => (window.location.hash = `#income/${section}`);

export function IncomePage({ section }: { section: IncomeSection }) {
  switch (section) {
    case 'data':
      return <DataSection />;
    case 'whatif':
      return <WhatIfSection />;
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

function ReportError({ error }: { error: unknown }) {
  if (!error) return null;
  return isNoProfile(error) ? <NoDataNotice /> : <ErrorAlert error={error} />;
}

function YearSwitch({ year, onChange }: { year: number; onChange: (year: number) => void }) {
  return (
    <Group gap={4}>
      <Button variant="default" size="sm" px={8} onClick={() => onChange(year - 1)} aria-label="Предыдущий год">
        <IconChevronLeft size={16} />
      </Button>
      <Button variant="default" size="sm" miw={72}>
        {year}
      </Button>
      <Button variant="default" size="sm" px={8} onClick={() => onChange(year + 1)} aria-label="Следующий год">
        <IconChevronRight size={16} />
      </Button>
    </Group>
  );
}

// ---------- главная: отчёт ----------

function OverviewSection() {
  const [year, setYear] = useState(THIS_YEAR);
  const report = useAction<YearReportOut>();
  const { run } = report;
  const [absenceOpen, absenceModal] = useDisclosure(false);

  useEffect(() => {
    void run(() => salaryApi.year(year));
  }, [run, year]);

  const afterAbsence = async (before: string | null) => {
    absenceModal.close();
    const updated = await run(() => salaryApi.year(year));
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

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <PageHeader title="Доходы" subtitle="Сколько и когда приходит: зарплата, отпускные, больничные — за вычетом НДФЛ." />
        <Group gap="sm">
          <YearSwitch year={year} onChange={setYear} />
          <Button variant="default" leftSection={<IconBeach size={16} />} onClick={absenceModal.open} disabled={!report.data}>
            Отпуск или больничный
          </Button>
          <Button variant="default" leftSection={<IconSparkles size={16} />} onClick={go('whatif')}>
            Что если
          </Button>
          <Button leftSection={<IconRefresh size={16} />} onClick={go('data')}>
            Актуализировать данные
          </Button>
        </Group>
      </Group>
      <ReportError error={report.error} />
      {report.data && <YearOverview report={report.data} />}
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

// ---------- что если ----------

function WhatIfSection() {
  const [year, setYear] = useState(THIS_YEAR);
  const [terms, setTerms] = useState<SalaryTerms>(clone(EXAMPLE_WHAT_IF));
  const result = useAction<WhatIfOut>();

  return (
    <Stack gap="lg">
      <Group>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={go('overview')}>
          К отчёту
        </Button>
      </Group>
      <PageHeader title="Что если" subtitle="Новые условия с даты — сколько станет на руки. Ничего не сохраняет." />
      <Panel>
        <Group align="flex-end" gap="md">
          <IntField label="Год" value={year} min={2000} max={2100} width={110} onChange={setYear} />
          <DateField label="Новые условия с" value={terms.start} onChange={(start) => setTerms({ ...terms, start })} />
          <MoneyField label="Оклад" value={terms.salary} width={170} onChange={(salary) => setTerms({ ...terms, salary })} />
          <MoneyField
            label="Питание в день"
            value={terms.meal_per_day}
            width={150}
            onChange={(meal_per_day) => setTerms({ ...terms, meal_per_day })}
          />
          <Button leftSection={<IconSparkles size={16} />} loading={result.loading} onClick={() => result.run(() => salaryApi.whatIf(year, terms))}>
            Посчитать
          </Button>
        </Group>
        {result.error !== null && (
          <Stack mt="md">
            <ReportError error={result.error} />
          </Stack>
        )}
      </Panel>
      {result.data && <WhatIfView result={result.data} />}
    </Stack>
  );
}
