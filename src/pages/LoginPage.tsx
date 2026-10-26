import { Box, Button, Card, Center, Divider, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconFlask, IconLogin } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { authApi, serviceApi } from '../api/endpoints';
import { ErrorAlert } from '../components/ErrorAlert';
import { setToken } from '../lib/session';
import { useAction } from '../lib/useAction';

/** Вход: логин и пароль → токен. Пользователей заводит владелец сервера командой we-finance. */
export function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const submit = useAction<{ token: string }>();
  const testLogin = useAction<{ token: string }>();
  // Кнопка тестовой учётки — только на стендах dev и test (их называет /version).
  const [testStand, setTestStand] = useState(false);

  useEffect(() => {
    serviceApi
      .version()
      .then((version) => setTestStand(version.env === 'dev' || version.env === 'test'))
      .catch(() => setTestStand(false));
  }, []);

  const enterTest = async () => {
    const result = await testLogin.run(() => authApi.testLogin());
    if (result) setToken(result.token);
  };

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
            {testStand && (
              <>
                <Divider label="стенд для разработки" labelPosition="center" />
                <Button variant="light" color="gray" leftSection={<IconFlask size={16} />} loading={testLogin.loading} onClick={enterTest} fullWidth>
                  Войти в тестовую учётку
                </Button>
                <ErrorAlert error={testLogin.error} />
              </>
            )}
          </Stack>
        </form>
      </Card>
    </Center>
  );
}
