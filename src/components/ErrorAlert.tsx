import { Alert, List, Text } from '@mantine/core';
import { IconAlertTriangle, IconPlugConnectedX } from '@tabler/icons-react';

import { ApiError } from '../api/client';

/** Ошибка запроса по-человечески: код, текст и список «поле → что не так». */
export function ErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;
  if (error instanceof ApiError) {
    const { offline } = error;
    const title = offline
      ? 'Нет связи с бэкендом'
      : error.status === 404
        ? 'Не найдено (404)'
        : error.status === 422
          ? 'Данные не подходят (422)'
          : `Ошибка ${error.status}`;
    return (
      <Alert
        color={offline ? 'gray' : 'red'}
        radius="lg"
        title={title}
        icon={offline ? <IconPlugConnectedX size={18} /> : <IconAlertTriangle size={18} />}
      >
        <Text size="sm">{error.message}</Text>
        {error.problems.length > 0 && (
          <List size="sm" mt="xs" spacing={4}>
            {error.problems.map((problem, index) => (
              <List.Item key={index}>
                <Text span fw={600} size="sm">
                  {problem.where}
                </Text>
                : {problem.message}
              </List.Item>
            ))}
          </List>
        )}
      </Alert>
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    <Alert color="red" radius="lg" title="Ошибка" icon={<IconAlertTriangle size={18} />}>
      <Text size="sm">{message}</Text>
    </Alert>
  );
}
