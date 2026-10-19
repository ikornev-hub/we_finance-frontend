import { Button, Group, Stack } from '@mantine/core';
import { IconCalculator, IconTable } from '@tabler/icons-react';
import { useState } from 'react';

import { calculatorApi } from '../api/endpoints';
import type { CalculationOut, LoanIn, Prepayment, ScheduleRowOut } from '../api/types';
import { PageHeader, Panel } from '../components/Cards';
import { ErrorAlert } from '../components/ErrorAlert';
import { AsOfField } from '../components/fields';
import { LoanForm, PrepaymentList } from '../components/loans/LoanForm';
import { CalculationView, ScheduleTable } from '../components/loans/LoanViews';
import { EXAMPLE_LOAN, EXAMPLE_PREPAYMENT, clone } from '../lib/examples';
import { useAction } from '../lib/useAction';

function exampleLoan(): LoanIn {
  const { name: _name, ...loan } = clone(EXAMPLE_LOAN);
  return loan;
}

let loanDraft: LoanIn = exampleLoan();
let prepaymentsDraft: Prepayment[] = [clone(EXAMPLE_PREPAYMENT)];

/** Калькулятор кредита: считает по присланным параметрам, ничего не сохраняет. */
export function CalculatorPage() {
  const [loan, setLoanState] = useState<LoanIn>(loanDraft);
  const [prepayments, setPrepaymentsState] = useState<Prepayment[]>(prepaymentsDraft);
  const [asOf, setAsOf] = useState('');
  const schedule = useAction<ScheduleRowOut[]>();
  const full = useAction<CalculationOut>();

  const setLoan = (next: LoanIn) => {
    loanDraft = next;
    setLoanState(next);
  };
  const setPrepayments = (next: Prepayment[]) => {
    prepaymentsDraft = next;
    setPrepaymentsState(next);
  };

  return (
    <Stack gap="lg">
      <PageHeader title="Калькулятор кредита" subtitle="График по параметрам и полный расчёт с ЧДП. Ничего не сохраняет — можно жать смело." />
      <LoanForm value={loan} onChange={setLoan} />
      <Panel title="Досрочные платежи" subtitle="Только для полного расчёта">
        <PrepaymentList value={prepayments} onChange={setPrepayments} />
      </Panel>
      <Panel>
        <Stack gap="md">
          <Group align="flex-end" gap="sm">
            <Button variant="default" onClick={() => { setLoan(exampleLoan()); setPrepayments([clone(EXAMPLE_PREPAYMENT)]); }}>
              Учебный пример
            </Button>
            <Button
              variant="default"
              leftSection={<IconTable size={16} />}
              loading={schedule.loading}
              onClick={() => {
                full.reset();
                void schedule.run(() => calculatorApi.schedule(loan));
              }}
            >
              График без ЧДП
            </Button>
            <AsOfField value={asOf} onChange={setAsOf} />
            <Button
              leftSection={<IconCalculator size={16} />}
              loading={full.loading}
              onClick={() => {
                schedule.reset();
                void full.run(() => calculatorApi.calculate({ loan, prepayments, as_of: asOf || null }));
              }}
            >
              Полный расчёт с ЧДП
            </Button>
          </Group>
          <ErrorAlert error={schedule.error} />
          <ErrorAlert error={full.error} />
        </Stack>
      </Panel>
      {schedule.data && (
        <Panel title={`График платежей — ${schedule.data.length}`}>
          <ScheduleTable rows={schedule.data} />
        </Panel>
      )}
      {full.data && <CalculationView calculation={full.data} />}
    </Stack>
  );
}
