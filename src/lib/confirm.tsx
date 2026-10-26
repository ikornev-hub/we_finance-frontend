import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import type { ReactNode } from 'react';

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
}

/** Окно «Точно?»: true — подтвердили, false — отменили или закрыли. */
export function confirmAction({ title, message, confirmLabel, danger }: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    modals.openConfirmModal({
      title: <Text fw={600}>{title}</Text>,
      children: <div>{message}</div>,
      labels: { confirm: confirmLabel, cancel: 'Отмена' },
      confirmProps: { color: danger ? 'red' : undefined },
      radius: 'lg',
      centered: true,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
      onClose: () => resolve(false), // после onConfirm уже ничего не меняет
    });
  });
}

/** Запись прошла: короткое уведомление. */
export function notifyDone(title: string, message: string): void {
  notifications.show({ title, message, color: 'teal', autoClose: 6000 });
}

