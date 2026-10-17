'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  ColorSwatch,
  Group,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import { useTags } from '@/hooks/use-tags';
import type { Tag } from '@/lib/types';
import { SortableTh, type SortDir } from '@/components/sortable-th';
import { TagForm } from './tag-form';

export function TagsView() {
  const queryClient = useQueryClient();
  const tags = useTags();
  const [editing, setEditing] = useState<Tag | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().from('tags').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notifications.show({ color: 'teal', message: 'Tag excluída.' });
    },
    onError: (error: Error) => notifications.show({ color: 'red', title: 'Erro ao excluir', message: error.message }),
  });

  function confirmDelete(tag: Tag) {
    modals.openConfirmModal({
      title: 'Excluir tag',
      children: (
        <Text size="sm">
          Excluir a tag <b>{tag.name}</b>? As transações continuam existindo, apenas sem essa tag.
        </Text>
      ),
      labels: { confirm: 'Excluir', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove.mutate(tag.id),
    });
  }

  function openForm(tag: Tag | null) {
    setEditing(tag);
    setFormOpen(true);
  }

  // null = ordem padrão (A→Z), sem seta no cabeçalho
  const [dir, setDir] = useState<SortDir | null>(null);
  const rows = [...(tags.data ?? [])].sort((a, b) =>
    dir !== 'desc'
      ? a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
      : b.name.localeCompare(a.name, 'pt-BR', { sensitivity: 'base' }),
  );

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2} style={{ letterSpacing: '-0.02em' }}>Tags</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => openForm(null)}>
          Nova tag
        </Button>
      </Group>

      {tags.error && (
        <Alert color="red" title="Não foi possível carregar as tags">
          {tags.error.message}
        </Alert>
      )}

      <Paper withBorder>
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={60}>Cor</Table.Th>
              <SortableTh active={dir !== null} dir={dir ?? 'asc'} onSort={() => setDir((d) => (d === null ? 'asc' : d === 'asc' ? 'desc' : null))}>
                Nome
              </SortableTh>
              <Table.Th>Prévia</Table.Th>
              <Table.Th w={90} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {tags.isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <Table.Tr key={i}>
                  <Table.Td colSpan={4}>
                    <Skeleton h={20} />
                  </Table.Td>
                </Table.Tr>
              ))}

            {!tags.isLoading && rows.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text ta="center" c="dimmed" py="lg">
                    Nenhuma tag criada ainda.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}

            {rows.map((tag) => (
              <Table.Tr key={tag.id}>
                <Table.Td>
                  <ColorSwatch color={tag.color} size={18} />
                </Table.Td>
                <Table.Td>{tag.name}</Table.Td>
                <Table.Td>
                  <Badge color={tag.color} variant="light">
                    {tag.name}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    <ActionIcon variant="subtle" aria-label="Editar" onClick={() => openForm(tag)}>
                      <IconPencil size={16} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" aria-label="Excluir" onClick={() => confirmDelete(tag)}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <Modal opened={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Editar tag' : 'Nova tag'}>
        <TagForm tag={editing} onDone={() => setFormOpen(false)} />
      </Modal>
    </Stack>
  );
}
