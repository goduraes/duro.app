import type { ReactNode } from 'react';
import { Box, Stack, Text, Title } from '@mantine/core';
import { IconChartPie, IconTags, IconShieldCheck } from '@tabler/icons-react';
import { Wordmark } from '@/components/logo';

const perks = [
  { icon: IconChartPie, text: 'Veja para onde o dinheiro vai, com gráficos claros.' },
  { icon: IconTags, text: 'Organize cada lançamento com tags do seu jeito.' },
  { icon: IconShieldCheck, text: 'Seus dados ficam só com você.' },
];

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <Box style={{ display: 'flex', minHeight: '100dvh' }}>
      <Box
        className="duro-auth-panel"
        visibleFrom="md"
        p={56}
        style={{ flex: '0 0 46%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
      >
        <Wordmark light />
        <Stack gap="xl" maw={440}>
          <Title order={1} fz={46} lh={1.05} c="white" style={{ letterSpacing: '-0.03em' }}>
            Para você deixar de ficar duro.
          </Title>
          <Stack gap="md">
            {perks.map(({ icon: Icon, text }) => (
              <Box key={text} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Box
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    background: 'rgba(255,255,255,.16)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={19} />
                </Box>
                <Text c="rgba(255,255,255,.88)">{text}</Text>
              </Box>
            ))}
          </Stack>
        </Stack>
        <Text size="xs" c="rgba(255,255,255,.6)">
          Controle financeiro pessoal
        </Text>
      </Box>

      <Box style={{ flex: 1, display: 'grid', placeItems: 'center' }} p="lg">
        <Box w="100%" maw={400}>
          <Box hiddenFrom="md" mb="xl">
            <Wordmark />
          </Box>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
