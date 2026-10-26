import { NumberInput, TextInput } from '@mantine/core';

// Поля форм. Деньги — текстом (без float), даты — родной календарь браузера (значение "YYYY-MM-DD").

interface FieldProps<T> {
  label?: string;
  value: T;
  onChange: (value: T) => void;
  width?: number | string;
  description?: string;
}

export function DateField({ label, value, onChange, width, description }: FieldProps<string>) {
  return (
    <TextInput
      type="date"
      max="9999-12-31" // иначе Chrome даёт ввести шестизначный год
      label={label}
      description={description}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      w={width}
      size="sm"
      radius="md"
    />
  );
}

export function MoneyField({ label, value, onChange, width, description }: FieldProps<string>) {
  return (
    <TextInput
      label={label}
      description={description}
      value={value}
      inputMode="decimal"
      placeholder="0.00"
      onChange={(event) => onChange(event.currentTarget.value.replace(',', '.').replace(/\s/g, ''))}
      w={width}
      size="sm"
      radius="md"
      rightSection={<span style={{ fontSize: 12, opacity: 0.6 }}>₽</span>}
    />
  );
}

export function IntField({ label, value, onChange, width, description, min, max }: FieldProps<number> & { min?: number; max?: number }) {
  return (
    <NumberInput
      label={label}
      description={description}
      value={value}
      onChange={(next) => onChange(typeof next === 'number' ? next : Number(next) || 0)}
      allowDecimal={false}
      min={min}
      max={max}
      w={width}
      size="sm"
      radius="md"
    />
  );
}

/** Необязательная дата «на дату» для as_of: пусто — бэкенд возьмёт сегодня. */
export function AsOfField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <TextInput
      type="date"
      label="На дату (as_of)"
      description="Пусто — сегодня"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      w={170}
      size="sm"
      radius="md"
    />
  );
}
