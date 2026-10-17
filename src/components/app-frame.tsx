'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ActionIcon,
  AppShell,
  Avatar,
  Box,
  Burger,
  Group,
  Menu,
  NavLink,
  Text,
  UnstyledButton,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  IconChartPie,
  IconEye,
  IconEyeOff,
  IconLogout,
  IconMoon,
  IconReceipt2,
  IconShieldLock,
  IconSun,
  IconTags,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';
import { Wordmark } from '@/components/logo';
import { usePrivacy } from '@/components/privacy';
import { createClient } from '@/lib/supabase/client';
import type { Role } from '@/lib/types';

interface Props {
  user: { name: string; email: string; role: Role };
  children: ReactNode;
}

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: IconChartPie },
  { href: '/transacoes', label: 'Transações', icon: IconReceipt2 },
  { href: '/tags', label: 'Tags', icon: IconTags },
];

export function AppFrame({ user, children }: Props) {
  const [opened, { toggle, close }] = useDisclosure();
  const pathname = usePathname();
  // No celular, com o menu aberto, a página de trás não rola.
  const isMobile = useMediaQuery('(max-width: 47.99em)');
  const lockScroll = opened && !!isMobile;
  useEffect(() => {
    if (!lockScroll) return;
    const { body, documentElement: html } = document;
    const prev = { body: body.style.overflow, html: html.style.overflow };
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prev.body;
      html.style.overflow = prev.html;
    };
  }, [lockScroll]);
  const router = useRouter();
  const { toggleColorScheme } = useMantineColorScheme();
  const { hidden, toggle: togglePrivacy } = usePrivacy();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  const isAdmin = user.role === 'admin';
  const adminLinks = [{ href: '/admin/usuarios', label: 'Usuários', icon: IconUsers }];
  const inAdminArea = pathname.startsWith('/admin');

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding={{ base: 'md', sm: 'xl' }}
    >
      <AppShell.Header className="duro-header">
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Menu" />
            <Link href="/dashboard" aria-label="Ir para o dashboard" onClick={close} style={{ color: 'inherit', textDecoration: 'none' }}>
              <Wordmark />
            </Link>
          </Group>

          <Group gap="sm" align="center">
            <ActionIcon
              variant="default"
              size={38}
              className="duro-icon-btn"
              aria-label={hidden ? 'Mostrar valores' : 'Ocultar valores'}
              aria-pressed={hidden}
              title={hidden ? 'Mostrar valores' : 'Ocultar valores'}
              onClick={togglePrivacy}
            >
              {hidden ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            </ActionIcon>

            <Menu position="bottom-end" width={220}>
              <Menu.Target>
                <ActionIcon variant="transparent" size={38} radius="xl" className="duro-avatar-btn" aria-label="Conta">
                  <Avatar color="brand" variant="filled" radius="xl" size={34}>
                    {user.name.slice(0, 1).toUpperCase()}
                  </Avatar>
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>
                  <Text size="sm" fw={600} truncate>
                    {user.name}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {user.email}
                  </Text>
                </Menu.Label>
                <Menu.Divider />
                <Menu.Item component={Link} href="/perfil" leftSection={<IconUser size={16} />}>
                  Perfil
                </Menu.Item>
                <Menu.Item leftSection={<IconLogout size={16} />} onClick={signOut}>
                  Sair
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" className="duro-navbar">
        <AppShell.Section grow>
        {links.map(({ href, label, icon: Icon }) => (
          <NavLink
            key={href}
            component={Link}
            href={href}
            label={label}
            leftSection={<Icon size={18} />}
            active={pathname === href || pathname.startsWith(`${href}/`)}
            variant="light"
            onClick={close}
          />
        ))}

        {isAdmin && (
          <NavLink
            label="Admin"
            leftSection={<IconShieldLock size={18} />}
            defaultOpened={inAdminArea}
            childrenOffset={28}
          >
            {adminLinks.map(({ href, label, icon: Icon }) => (
              <NavLink
                key={href}
                component={Link}
                href={href}
                label={label}
                leftSection={<Icon size={16} />}
                active={pathname === href || pathname.startsWith(`${href}/`)}
                onClick={close}
              />
            ))}
          </NavLink>
        )}
        </AppShell.Section>

        <AppShell.Section>
          <UnstyledButton className="duro-theme-btn" onClick={toggleColorScheme} aria-label="Alternar tema">
            {/* Os dois ficam no HTML e o CSS esconde um: evita erro de hidratação com o tema "auto". Mostra para qual tema o clique troca. */}
            <Box component="span" darkHidden className="duro-theme-btn-inner">
              <IconMoon size={18} />
              <span>Tema escuro</span>
            </Box>
            <Box component="span" lightHidden className="duro-theme-btn-inner">
              <IconSun size={18} />
              <span>Tema claro</span>
            </Box>
          </UnstyledButton>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Box maw={1240} mx="auto">
          {children}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
