'use client';

import { Button, ColorInput, Group, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { createClient } from '@/lib/supabase/client';
import { tagSchema, type TagValues } from '@/lib/schemas';
import type { Tag } from '@/lib/types';

const SWATCHES = [
  '#4c6ef5', '#228be6', '#15aabf', '#12b886', '#40c057', '#82c91e',
  '#fab005', '#fd7e14', '#fa5252', '#e64980', '#be4bdb', '#868e96',
];

export function TagForm({ tag, onDone }: { tag: Tag | null; onDone: () => void }) {
  const queryClient = useQueryClient();

  const form = useForm<TagValues>({
    initialValues: { name: tag?.name ?? '', color: tag?.color ?? SWATCHES[0] },
    validate: zod4Resolver(tagSchema, { errorPriority: 'first' }),
  });

  const save = useMutation({
    mutationFn: async (values: TagValues) => {
      const supabase = createClient();
      const payload = { name: values.name.trim(), color: values.color.toLowerCase() };
      const { error } = tag
        ? await supabase.from('tags').update(payload).eq('id', tag.id)
        : await supabase.from('tags').insert(payload);
      if (error) {
        throw new Error(error.code === '23505' ? 'Já existe uma tag com esse nome.' : error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notifications.show({ color: 'teal', message: tag ? 'Tag atualizada.' : 'Tag criada.' });
      onDone();
    },
    onError: (error: Error) => notifications.show({ color: 'red', title: 'Erro ao salvar', message: error.message }),
  });

  return (
    <form onSubmit={form.onSubmit((v) => save.mutate(v))} noValidate>
      <Stack>
        <TextInput label="Nome" placeholder="Ex.: Mercado" data-autofocus {...form.getInputProps('name')} />
        <ColorInput label="Cor" format="hex" swatches={SWATCHES} swatchesPerRow={6} {...form.getInputProps('color')} />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onDone}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.isPending}>
            Salvar
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
