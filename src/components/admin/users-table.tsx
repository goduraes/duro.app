'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import {
  Badge,
  Group,
  Pagination,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconSearch } from '@tabler/icons-react';
import { setUserActive, setUserRole } from '@/app/(app)/admin/usuarios/actions';
import { TablePagination } from '@/components/table-pagination';
import { readStoredPageSize } from '@/hooks/use-page-size';
import { SortableTh, nextSort, type SortDir } from '@/components/sortable-th';
import type { ActionResult, Role } from '@/lib/types';

export type StatusFilter = 'all' | 'active' | 'inactive';
export type SortKey = 'name' | 'role' | 'created_at' | 'last_sign_in_at' | 'is_active';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

interface Props {
  users: UserRow[];
  currentUserId: string;
  total: number;
  page: number;
  pageSize: number;
  q: string;
  status: StatusFilter;
  sort: SortKey | null;
  dir: SortDir;
}

const DEFAULT_SIZE = 10;

export function UsersTable({ users, currentUserId, total, page, pageSize, q, status, sort, dir }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [actionPending, startAction] = useTransition();
  const [navPending, startNav] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Busca: o estado local acompanha a digitação; a URL só muda depois de uma pausa.
  const [search, setSearch] = useState(q);
  const [debouncedSearch] = useDebouncedValue(search, 400);

  /** Navega mudando só os parâmetros informados (filtro/tamanho voltam para a página 1). */
  function go(next: Partial<{ page: number; size: number; q: string; status: StatusFilter; sort: SortKey | null; dir: SortDir }>) {
    const v = { page, size: pageSize, q, status, sort, dir, ...next };
    const params = new URLSearchParams();
    if (v.page > 1) params.set('page', String(v.page));
    if (v.size !== DEFAULT_SIZE) params.set('size', String(v.size));
    if (v.q) params.set('q', v.q);
    if (v.status !== 'all') params.set('status', v.status);
    if (v.sort) {
      params.set('sort', v.sort);
      params.set('dir', v.dir);
    }
    const qs = params.toString();
    startNav(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  // O tamanho vem da URL (a lista é carregada no servidor): ao abrir, aplica o salvo no navegador.
  useEffect(() => {
    const stored = readStoredPageSize();
    if (stored && stored !== pageSize) go({ size: stored, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const term = debouncedSearch.trim();
    if (term !== q) go({ q: term, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  /** Clique no cabeçalho: crescente → decrescente → sem ordenação (volta ao padrão). */
  function changeSort(key: SortKey) {
    const next = nextSort(sort ? { key: sort, dir } : null, key);
    go({ sort: next?.key ?? null, dir: next?.dir ?? 'asc', page: 1 });
  }

  function run(userId: string, action: () => Promise<ActionResult>, successMessage: string) {
    setBusyId(userId);
    startAction(async () => {
      const result = await action();
      setBusyId(null);
      if (result.ok) notifications.show({ color: 'teal', message: successMessage });
      else notifications.show({ color: 'red', title: 'Não foi possível concluir', message: result.error });
    });
  }

  function toggleActive(user: UserRow, active: boolean) {
    if (active) {
      run(user.id, () => setUserActive(user.id, true), `${user.email} foi reativado.`);
      return;
    }
    modals.openConfirmModal({
      title: 'Desativar usuário',
      children: (
        <Text size="sm">
          <b>{user.email}</b> perderá o acesso imediatamente e não conseguirá entrar novamente até ser reativado. Os dados
          dele são preservados.
        </Text>
      ),
      labels: { confirm: 'Desativar', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: () => run(user.id, () => setUserActive(user.id, false), `${user.email} foi desativado.`),
    });
  }

  function changeRole(user: UserRow, role: Role) {
    if (role === user.role) return;
    run(user.id, () => setUserRole(user.id, role), `Papel de ${user.email} alterado.`);
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);
  const filtered = q !== '' || status !== 'all';

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2} style={{ letterSpacing: '-0.02em' }}>Usuários</Title>
        <Text c="dimmed" size="sm">
          {total} {total === 1 ? 'usuário' : 'usuários'}
          {filtered ? ' encontrados' : ''}
        </Text>
      </Group>

      <Group align="flex-end" gap="sm">
        <TextInput
          label="Buscar"
          placeholder="Nome ou e-mail"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={{ base: '100%', sm: 280 }}
        />
        <div>
          <Text size="sm" fw={500} mb={4}>
            Status
          </Text>
          <SegmentedControl
            value={status}
            onChange={(v) => go({ status: v as StatusFilter, page: 1 })}
            data={[
              { label: 'Todos', value: 'all' },
              { label: 'Ativos', value: 'active' },
              { label: 'Inativos', value: 'inactive' },
            ]}
          />
        </div>
      </Group>

      <Paper withBorder opacity={navPending ? 0.6 : 1}>
        <Table.ScrollContainer minWidth={760}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <SortableTh active={sort === 'name'} dir={dir} onSort={() => changeSort('name')}>
                  Usuário
                </SortableTh>
                <SortableTh w={150} active={sort === 'role'} dir={dir} onSort={() => changeSort('role')}>
                  Papel
                </SortableTh>
                <SortableTh w={150} active={sort === 'created_at'} dir={dir} onSort={() => changeSort('created_at')}>
                  Cadastro
                </SortableTh>
                <SortableTh w={170} active={sort === 'last_sign_in_at'} dir={dir} onSort={() => changeSort('last_sign_in_at')}>
                  Último acesso
                </SortableTh>
                <SortableTh w={130} active={sort === 'is_active'} dir={dir} onSort={() => changeSort('is_active')}>
                  Status
                </SortableTh>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" c="dimmed" py="lg">
                      Nenhum usuário encontrado.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {users.map((u) => {
                const isMe = u.id === currentUserId;
                const busy = actionPending && busyId === u.id;
                return (
                  <Table.Tr key={u.id}>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <div>
                          <Text size="sm" fw={600}>
                            {u.name || '—'}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {u.email}
                          </Text>
                        </div>
                        {isMe && (
                          <Badge size="xs" variant="light">
                            você
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Select
                        size="xs"
                        allowDeselect={false}
                        data={[
                          { value: 'common', label: 'Comum' },
                          { value: 'admin', label: 'Admin' },
                        ]}
                        value={u.role}
                        disabled={isMe || busy}
                        onChange={(v) => v && changeRole(u, v as Role)}
                        aria-label={`Papel de ${u.email}`}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{dayjs(u.created_at).format('DD/MM/YYYY')}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c={u.last_sign_in_at ? undefined : 'dimmed'}>
                        {u.last_sign_in_at ? dayjs(u.last_sign_in_at).format('DD/MM/YYYY HH:mm') : 'Nunca'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Switch
                        checked={u.is_active}
                        disabled={isMe || busy}
                        onChange={(e) => toggleActive(u, e.currentTarget.checked)}
                        label={u.is_active ? 'Ativo' : 'Inativo'}
                        aria-label={`Ativar ou desativar ${u.email}`}
                      />
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>

      <TablePagination
        total={total}
        page={page}
        pageSize={pageSize}
        pageSizes={['10', '25', '50']}
        onPageChange={(p) => go({ page: p })}
        onPageSizeChange={(size) => go({ size, page: 1 })}
        emptyLabel="Nenhum usuário"
      />
    </Stack>
  );
}
