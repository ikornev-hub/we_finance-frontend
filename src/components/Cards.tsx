import { Badge, Card, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import type { ReactNode } from 'react';

import classes from './Cards.module.css';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  badge?: { text: string; color: string };
  icon?: ReactNode;
}

/** Карточка KPI: подпись, крупная цифра, бейдж. */
export function StatCard({ label, value, hint, badge, icon }: StatCardProps) {
  return (
    <Card className={classes.card} padding="lg" radius="lg" withBorder>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Text size="sm" c="dimmed">
          {label}
        </Text>
        {icon && (
          <ThemeIcon variant="light" color="gray" radius="xl" size="md">
            {icon}
          </ThemeIcon>
        )}
      </Group>
      <Text className={classes.value} mt="sm">
        {value}
      </Text>
      {(badge || hint) && (
        <Group gap={6} mt="xs">
          {badge && (
            <Badge variant="light" color={badge.color} radius="sm" size="sm">
              {badge.text}
            </Badge>
          )}
          {hint && (
            <Text size="xs" c="dimmed">
              {hint}
            </Text>
          )}
        </Group>
      )}
    </Card>
  );
}

/** Яркая карточка с главной цифрой экрана. */
export function HeroCard({ label, value, caption, icon }: StatCardProps & { caption?: string }) {
  return (
    <Card className={classes.hero} padding="lg" radius="lg">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Text size="sm" className={classes.heroLabel}>
          {label}
        </Text>
        {icon && <div className={classes.heroIcon}>{icon}</div>}
      </Group>
      <Text className={classes.heroValue} mt="sm">
        {value}
      </Text>
      {caption && (
        <Text size="xs" className={classes.heroLabel} mt="xs">
          {caption}
        </Text>
      )}
    </Card>
  );
}

/** Белая (или тёмная) панель с заголовком — блок экрана. */
export function Panel({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className={classes.card} padding="lg" radius="lg" withBorder>
      {(title || actions) && (
        <Group justify="space-between" align="flex-start" mb="md" gap="sm">
          <Stack gap={2}>
            {title && (
              <Text fw={600} size="md">
                {title}
              </Text>
            )}
            {subtitle && (
              <Text size="xs" c="dimmed">
                {subtitle}
              </Text>
            )}
          </Stack>
          {actions}
        </Group>
      )}
      {children}
    </Card>
  );
}

/** Заголовок раздела, как «Good morning, …» в референсе. */
export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Stack gap={4} mb="lg">
      <Title order={2} fw={600}>
        {title}
      </Title>
      <Text c="dimmed" size="sm">
        {subtitle}
      </Text>
    </Stack>
  );
}
