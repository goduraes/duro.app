'use client';

import { useEffect, useState, type ReactNode } from 'react';
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
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  IconChartPie,
  IconEye,
  IconEyeOff,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLogout,
  IconMoon,
  IconReceipt2,
  IconShieldLock,
  IconSun,
  IconTags,
  IconTargetArrow,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';
import { Wordmark } from '@/components/logo';
import { usePrivacy } from '@/components/privacy';
import { createClient } from '@/lib/supabase/client';
import type { Role } from '@/lib/types';

interface Props {
  user: { name: string; email: string; role: Role };
  /** Menu lateral recolhido (vem do cookie, lido no servidor). */
  initialCollapsed: boolean;
  children: ReactNode;
}

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: IconChartPie },
  { href: '/transacoes', label: 'Transações', icon: IconReceipt2 },
  { href: '/orcamento', label: 'Orçamento', icon: IconTargetArrow },
  { href: '/tags', label: 'Tags', icon: IconTags },
];

export function AppFrame({ user, initialCollapsed, children }: Props) {
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
  // Menu lateral recolhido (só no desktop): fica apenas com os ícones. A escolha fica num cookie, que o
  // servidor lê para já entregar a página no estado certo (guardar só no localStorage faria o menu
  // abrir e depois fechar a cada recarga).
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  // Grupo "Admin" (dropdown do menu): controlado, para abrir ao expandir o menu pelo ícone.
  const [adminOpened, setAdminOpened] = useState(pathname.startsWith('/admin'));
  function expandSidebar() {
    document.cookie = 'duro-sidebar-collapsed=0; path=/; max-age=31536000; samesite=lax';
    setCollapsed(false);
  }
  function toggleCollapsed() {
    setCollapsed((c) => {
      document.cookie = `duro-sidebar-collapsed=${c ? '0' : '1'}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  }

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
      // No celular o menu é uma gaveta e sempre aparece completo; a largura reduzida vale só no desktop.
      navbar={{ width: { base: 250, sm: collapsed ? 72 : 250 }, breakpoint: 'sm', collapsed: { mobile: !opened } }}
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
                <Menu.Item
                  closeMenuOnClick={false}
                  onClick={toggleColorScheme}
                  leftSection={
                    // Os dois ficam no HTML e o CSS esconde um: evita erro de hidratação com o tema "auto".
                    <>
                      <Box component="span" darkHidden>
                        <IconMoon size={16} style={{ display: 'block' }} />
                      </Box>
                      <Box component="span" lightHidden>
                        <IconSun size={16} style={{ display: 'block' }} />
                      </Box>
                    </>
                  }
                >
                  {/* Mostra para qual tema o clique troca. */}
                  <Box component="span" darkHidden>
                    Tema escuro
                  </Box>
                  <Box component="span" lightHidden>
                    Tema claro
                  </Box>
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
        {/* Recolhido: os dois menus ficam no HTML e o CSS mostra o certo (ícones no desktop, completo no celular). */}
        <AppShell.Section grow>
          {collapsed && (
            <Stack align="center" gap={6} visibleFrom="sm">
              {links.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Tooltip key={href} label={label} position="right" withArrow>
                    <ActionIcon
                      component={Link}
                      href={href}
                      size={40}
                      radius="md"
                      variant={active ? 'light' : 'subtle'}
                      color={active ? undefined : 'gray'}
                      aria-label={label}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon size={20} />
                    </ActionIcon>
                  </Tooltip>
                );
              })}

              {isAdmin && (
                <Tooltip label="Admin" position="right" withArrow>
                  <ActionIcon
                    size={40}
                    radius="md"
                    variant={inAdminArea ? 'light' : 'subtle'}
                    color={inAdminArea ? undefined : 'gray'}
                    aria-label="Admin (expande o menu)"
                    onClick={() => {
                      // Item com submenu: expande o menu e já deixa o dropdown aberto.
                      expandSidebar();
                      setAdminOpened(true);
                    }}
                  >
                    <IconShieldLock size={20} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Stack>
          )}

          <Box hiddenFrom={collapsed ? 'sm' : undefined}>
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
                opened={adminOpened}
                onChange={setAdminOpened}
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
          </Box>
        </AppShell.Section>

        {/* Recolher/expandir: só no desktop (no celular o menu é uma gaveta). */}
        <AppShell.Section visibleFrom="sm">
          {collapsed ? (
            <Stack align="center">
              <Tooltip label="Expandir menu" position="right" withArrow>
                <ActionIcon
                  variant="default"
                  size={40}
                  radius="md"
                  className="duro-icon-btn"
                  aria-label="Expandir menu"
                  onClick={toggleCollapsed}
                >
                  <IconLayoutSidebarLeftExpand size={20} />
                </ActionIcon>
              </Tooltip>
            </Stack>
          ) : (
            <UnstyledButton className="duro-theme-btn" onClick={toggleCollapsed} aria-label="Recolher menu">
              <Box component="span" className="duro-theme-btn-inner">
                <IconLayoutSidebarLeftCollapse size={18} />
                <span>Recolher menu</span>
              </Box>
            </UnstyledButton>
          )}
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
