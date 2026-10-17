import type { ReactNode } from 'react';
import { Group, Text, Title } from '@mantine/core';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
      <div>
        <Title order={2} style={{ letterSpacing: '-0.02em' }}>
          {title}
        </Title>
        {description && (
          <Text c="dimmed" size="sm" mt={2}>
            {description}
          </Text>
        )}
      </div>
      {actions}
    </Group>
  );
}
