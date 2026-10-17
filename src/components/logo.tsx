import { Group, Text } from '@mantine/core';

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="10" fill="#6d4aff" />
      <path d="M10 9h6.5a7 7 0 0 1 0 14H10z" fill="none" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="23.5" cy="9.5" r="2.2" fill="#9be8df" />
    </svg>
  );
}

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <Group gap={8} wrap="nowrap">
      <LogoMark />
      <Text
        ff="heading"
        fw={800}
        fz={20}
        lh={1}
        c={light ? 'white' : undefined}
        style={{ letterSpacing: '-0.02em' }}
      >
        Duro.app
      </Text>
    </Group>
  );
}
