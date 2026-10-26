import { Badge } from '@mantine/core';

import type { PaymentStatus } from '../api/types';

/** Одни слова и цвета для платежей по кредиту, ЧДП и выплат зарплаты (решение 2026-10-26). */
export const PAYMENT_STATUS: Record<PaymentStatus, { text: string; color: string }> = {
  done: { text: 'Проведён', color: 'gray' },
  today: { text: 'Сегодня', color: 'brand' },
  planned: { text: 'Запланирован', color: 'blue' },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { text, color } = PAYMENT_STATUS[status];
  return (
    <Badge variant={status === 'today' ? 'filled' : 'light'} color={color} radius="sm">
      {text}
    </Badge>
  );
}
