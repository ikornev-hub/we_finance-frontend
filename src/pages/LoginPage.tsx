import { Box, Button, Card, Center, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconLogin } from '@tabler/icons-react';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { authApi } from '../api/endpoints';
import { ErrorAlert } from '../components/ErrorAlert';
import { setToken } from '../lib/session';
import { useAction } from '../lib/useAction';

/** Вход: логин и пароль → токен. Пользователей заводит владелец сервера командой we-finance. */
export function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const submit = useAction<{ token: string }>();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await submit.run(() => authApi.login(login.trim(), password));
    if (result) setToken(result.token);
  };

  return (
    <Center mih="100vh" p="md">
      <Card withBorder radius="lg" padding="xl" w="100%" maw={380}>
        <form onSubmit={onSubmit}>
          <Stack gap="md">
            <Box>
              <Title order={3}>We Finance</Title>
              <Text size="sm" c="dimmed">
                Войди, чтобы увидеть свои доходы и кредиты.
              </Text>
            </Box>
            <TextInput label="Логин" value={login} onChange={(e) => setLogin(e.currentTarget.value)} autoComplete="username" required autoFocus radius="md" />
            <PasswordInput label="Пароль" value={password} onChange={(e) => setPassword(e.currentTarget.value)} autoComplete="current-password" required radius="md" />
            <ErrorAlert error={submit.error} />
            <Button type="submit" leftSection={<IconLogin size={16} />} loading={submit.loading} fullWidth>
              Войти
            </Button>
          </Stack>
        </form>
      </Card>
    </Center>
  );
}
