import { Alert, Button, Group, Select, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCalculator,
  IconCloudDownload,
  IconDeviceFloppy,
  IconFileText,
  IconInfoCircle,
  IconPlus,
  IconSparkles,
  IconUserDollar,
} from '@tabler/icons-react';
import { useState } from 'react';

import { ApiError } from '../api/client';
import { salaryApi } from '../api/endpoints';
import type { Absence, AbsenceKind, SalaryProfile, SalaryTerms, WhatIfOut, YearReportOut } from '../api/types';
import { PageHeader, Panel } from '../components/Cards';
import { ErrorAlert } from '../components/ErrorAlert';
import { AsOfField, DateField, IntField, MoneyField } from '../components/fields';
import { ProfileEditor } from '../components/salary/ProfileEditor';
import { ReportView, WhatIfView } from '../components/salary/ReportView';
import { snapshotProfile, withBackup } from '../lib/backup';
import { confirmAction, notifySaved } from '../lib/confirm';
import { EXAMPLE_ABSENCE, EXAMPLE_PROFILE, EXAMPLE_WHAT_IF, EXAMPLE_YEAR, clone } from '../lib/examples';
import { ABSENCE_KIND, date } from '../lib/format';
import { useAction } from '../lib/useAction';

export type SalarySection = 'profile' | 'year' | 'absence' | 'whatif';

// Состояние форм живёт выше страниц, чтобы не терялось при переключении разделов.
let profileDraft: SalaryProfile = clone(EXAMPLE_PROFILE);

export function SalaryPage({ section }: { section: SalarySection }) {
  switch (section) {
    case 'year':
      return <YearSection />;
    case 'absence':
      return <AbsenceSection />;
    case 'whatif':
      return <WhatIfSection />;
    default:
      return <ProfileSection />;
  }
}

/** 404 от бэкенда = профиль ещё не сохраняли. Для человека это не ошибка, а «первый запуск». */
function isNoProfile(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** Подсказка вместо ошибки: профиля нет — вот что сделать. */
function NoProfileNotice({ onProfilePage }: { onProfilePage?: boolean }) {
  return (
    <Alert color="blue" radius="lg" variant="light" icon={<IconInfoCircle size={18} />} title="Профиль ещё не сохранён">
      <Stack gap="xs">
        <Text size="sm">
          {onProfilePage
            ? 'На бэкенде пока нет твоего профиля — загружать нечего. Заполни форму ниже (сейчас в ней учебный пример) и нажми «Сохранить на бэкенде».'
            : 'Этот раздел считает по сохранённому профилю, а его пока нет. Сначала заполни и сохрани профиль.'}
        </Text>
        {!onProfilePage && (
          <div>
            <Button size="xs" variant="light" color="blue" leftSection={<IconUserDollar size={14} />} onClick={() => (window.location.hash = '#salary/profile')}>
              Заполнить профиль
            </Button>
          </div>
        )}
      </Stack>
    </Alert>
  );
}

/** Ошибка или подсказка «профиля нет» — в зависимости от ответа. */
function ProfileError({ error }: { error: unknown }) {
  if (!error) return null;
  return isNoProfile(error) ? <NoProfileNotice /> : <ErrorAlert error={error} />;
}

function SaveWarning() {
  return (
    <Alert color="brand" radius="lg" icon={<IconInfoCircle size={18} />} variant="light">
      <Text size="sm">
        Запись идёт в файл из <b>SALARY_DATA_PATH</b> бэкенда. Перед каждой записью текущий профиль скачивается
        бэкапом в «Загрузки» и сохраняется во вкладке «Бэкапы».
      </Text>
    </Alert>
  );
}

// ---------- профиль: редактор, загрузка, сохранение, расчёт без сохранения ----------

function ProfileSection() {
  const [profile, setProfileState] = useState<SalaryProfile>(profileDraft);
  const [year, setYear] = useState(EXAMPLE_YEAR);
  const [asOf, setAsOf] = useState('');
  const load = useAction<SalaryProfile | null>();
  const [noProfile, setNoProfile] = useState(false);
  const save = useAction<SalaryProfile>();
  const calc = useAction<YearReportOut>();

  const setProfile = (next: SalaryProfile) => {
    profileDraft = next;
    setProfileState(next);
  };

  const loadSaved = async () => {
    // null — профиля на бэкенде нет: это не ошибка, покажем подсказку.
    const saved = await load.run(() => salaryApi.getProfile().catch((error) => (isNoProfile(error) ? null : Promise.reject(error))));
    setNoProfile(saved === null);
    if (saved) {
      setProfile({ ...saved, absences: saved.absences ?? [], history: saved.history ?? [] });
      notifications.show({ title: 'Профиль загружен', message: 'Это сохранённый на бэкенде профиль.', color: 'teal' });
    }
  };

  const saveProfile = async () => {
    const ok = await confirmAction({
      title: 'Сохранить профиль на бэкенде?',
      message: (
        <Text size="sm">
          Профиль на бэкенде будет <b>заменён целиком</b> тем, что сейчас в форме. Текущий сохранённый профиль сначала
          скачается бэкапом.
        </Text>
      ),
      confirmLabel: 'Сохранить',
    });
    if (!ok) return;
    const saved = await save.run(async () => {
      const { result, backup } = await withBackup('salary-profile', 'Перед сохранением профиля (PUT)', snapshotProfile, () =>
        salaryApi.putProfile(profile),
      );
      notifySaved('Профиль сохранён', backup);
      return result;
    });
    if (saved) setProfile(saved);
  };

  return (
    <Stack gap="lg">
      <PageHeader
        title="Профиль зарплаты"
        subtitle="Условия, отсутствия и история. Можно посчитать год прямо из формы или сохранить профиль на бэкенде."
      />

      <Panel title="Действия">
        <Stack gap="md">
          <Group gap="sm">
            <Button variant="default" leftSection={<IconFileText size={16} />} onClick={() => setProfile(clone(EXAMPLE_PROFILE))}>
              Учебный пример
            </Button>
            <Button
              variant="default"
              leftSection={<IconCloudDownload size={16} />}
              loading={load.loading}
              onClick={loadSaved}
            >
              Загрузить сохранённый
            </Button>
            <Button leftSection={<IconDeviceFloppy size={16} />} loading={save.loading} onClick={saveProfile}>
              Сохранить на бэкенде
            </Button>
          </Group>
          {noProfile && <NoProfileNotice onProfilePage />}
          <ErrorAlert error={load.error} />
          <ErrorAlert error={save.error} />
          <SaveWarning />
          <Group align="flex-end" gap="md">
            <IntField label="Год" value={year} min={2000} max={2100} width={110} onChange={setYear} />
            <AsOfField value={asOf} onChange={setAsOf} />
            <Button
              leftSection={<IconCalculator size={16} />}
              loading={calc.loading}
              onClick={() => calc.run(() => salaryApi.calculate({ profile, year }, asOf || undefined))}
            >
              Посчитать без сохранения
            </Button>
          </Group>
          <ErrorAlert error={calc.error} />
        </Stack>
      </Panel>

      {calc.data && <ReportView report={calc.data} />}

      <ProfileEditor value={profile} onChange={setProfile} />
    </Stack>
  );
}

// ---------- отчёт за год по сохранённому профилю ----------

function YearSection() {
  const [year, setYear] = useState(EXAMPLE_YEAR);
  const [asOf, setAsOf] = useState('');
  const report = useAction<YearReportOut>();

  return (
    <Stack gap="lg">
      <PageHeader title="Отчёт за год" subtitle="Все выплаты года по сохранённому профилю: аванс, остаток, отпускные, больничный, НДФЛ." />
      <Panel>
        <Group align="flex-end" gap="md">
          <IntField label="Год" value={year} min={2000} max={2100} width={110} onChange={setYear} />
          <AsOfField value={asOf} onChange={setAsOf} />
          <Button leftSection={<IconCalculator size={16} />} loading={report.loading} onClick={() => report.run(() => salaryApi.year(year, asOf || undefined))}>
            Показать
          </Button>
        </Group>
        {report.error !== null && (
          <Stack mt="md">
            <ProfileError error={report.error} />
          </Stack>
        )}
      </Panel>
      {report.data && <ReportView report={report.data} />}
    </Stack>
  );
}

// ---------- добавить отсутствие ----------

const KIND_OPTIONS = Object.entries(ABSENCE_KIND).map(([value, label]) => ({ value, label }));

function AbsenceSection() {
  const [absence, setAbsence] = useState<Absence>(clone(EXAMPLE_ABSENCE));
  const add = useAction<SalaryProfile>();

  const submit = async () => {
    const ok = await confirmAction({
      title: 'Добавить отсутствие?',
      message: (
        <Text size="sm">
          {ABSENCE_KIND[absence.kind]} {date(absence.start)}–{date(absence.end)} добавится в сохранённый профиль. Удалить его
          через API нельзя — только заменить профиль целиком. Сначала скачается бэкап профиля.
        </Text>
      ),
      confirmLabel: 'Добавить',
    });
    if (!ok) return;
    await add.run(async () => {
      const { result, backup } = await withBackup('salary-profile', 'Перед добавлением отсутствия', snapshotProfile, () =>
        salaryApi.addAbsence(absence),
      );
      notifySaved('Отсутствие добавлено', backup);
      return result;
    });
  };

  return (
    <Stack gap="lg">
      <PageHeader title="Отсутствие" subtitle="Отпуск, больничный или день без оплаты — в сохранённый профиль. Пересечения бэкенд не примет (422)." />
      <Panel>
        <Stack gap="md">
          <Group align="flex-end" gap="md">
            <Select
              label="Вид"
              data={KIND_OPTIONS}
              value={absence.kind}
              allowDeselect={false}
              onChange={(kind) => kind && setAbsence({ ...absence, kind: kind as AbsenceKind })}
              radius="md"
              w={170}
            />
            <DateField label="С" value={absence.start} onChange={(start) => setAbsence({ ...absence, start })} />
            <DateField label="По" value={absence.end} onChange={(end) => setAbsence({ ...absence, end })} />
            <Button leftSection={<IconPlus size={16} />} loading={add.loading} onClick={submit}>
              Добавить
            </Button>
          </Group>
          <SaveWarning />
          <ProfileError error={add.error} />
        </Stack>
      </Panel>
      {add.data && (
        <Panel title="Отсутствия в профиле теперь" subtitle={`Всего: ${add.data.absences.length}`}>
          <Stack gap={4}>
            {add.data.absences.map((item, index) => (
              <Text size="sm" key={index}>
                {ABSENCE_KIND[item.kind]}: {date(item.start)} – {date(item.end)}
              </Text>
            ))}
          </Stack>
        </Panel>
      )}
    </Stack>
  );
}

// ---------- что если ----------

function WhatIfSection() {
  const [year, setYear] = useState(EXAMPLE_YEAR);
  const [terms, setTerms] = useState<SalaryTerms>(clone(EXAMPLE_WHAT_IF));
  const result = useAction<WhatIfOut>();

  return (
    <Stack gap="lg">
      <PageHeader
        title="Что если"
        subtitle="Новые условия с даты — сколько станет на руки. Считается по сохранённому профилю и ничего не сохраняет."
      />
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
            <ProfileError error={result.error} />
          </Stack>
        )}
      </Panel>
      {result.data && <WhatIfView result={result.data} />}
    </Stack>
  );
}
