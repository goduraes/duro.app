'use client';

import dayjs from 'dayjs';
import { Button, Group, SegmentedControl, Stack, Text, TextInput, Input } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { TagSelect } from '@/components/tag-select';
import { MoneyInput } from '@/components/money-input';
import { createClient } from '@/lib/supabase/client';
import { fromCents, toCents } from '@/lib/money';
import { transactionSchema, type TransactionValues } from '@/lib/schemas';
import type { Tag, Transaction } from '@/lib/types';

type FormValues = Omit<TransactionValues, 'amount'> & { amount: number | '' };

interface Props {
  transaction: Transaction | null;
  tags: Tag[];
  onDone: () => void;
}

export function TransactionForm({ transaction, tags, onDone }: Props) {
  const queryClient = useQueryClient();
  // Ocorrência de uma recorrência: a alteração vale só para este mês.
  const occurrenceMonth = transaction?.recurring_id ? dayjs(transaction.occurred_on).startOf('month') : null;

  const form = useForm<FormValues>({
    initialValues: {
      type: transaction?.type ?? 'expense',
      description: transaction?.description ?? '',
      amount: transaction ? fromCents(transaction.amount_cents) : 0,
      occurred_on: transaction?.occurred_on ?? dayjs().format('YYYY-MM-DD'),
      tag_ids: transaction?.tags.map((t) => t.id) ?? [],
    },
    validate: zod4Resolver(transactionSchema, { errorPriority: 'first' }),
  });

  const save = useMutation({
    mutationFn: async (values: TransactionValues) => {
      if (transaction?.recurring_id) {
        const { error } = await createClient().rpc('save_recurring_override', {
          p_recurring_id: transaction.recurring_id,
          p_ref_month: transaction.recurring_ref,
          p_description: values.description.trim(),
          p_amount_cents: toCents(values.amount),
          p_type: values.type,
          p_occurred_on: values.occurred_on,
          p_tag_ids: values.tag_ids,
        });
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await createClient().rpc('save_transaction', {
        p_id: transaction?.id ?? null,
        p_description: values.description.trim(),
        p_amount_cents: toCents(values.amount),
        p_type: values.type,
        p_occurred_on: values.occurred_on,
        p_tag_ids: values.tag_ids,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      notifications.show({ color: 'teal', message: transaction ? 'Transação atualizada.' : 'Transação criada.' });
      onDone();
    },
    onError: (error: Error) => notifications.show({ color: 'red', title: 'Erro ao salvar', message: error.message }),
  });

  return (
    <form onSubmit={form.onSubmit((values) => save.mutate(values as TransactionValues))} noValidate>
      <Stack>
        <Input.Wrapper label="Tipo">
          <SegmentedControl
            fullWidth
            color={form.values.type === 'income' ? 'green' : 'red'}
            className="duro-tx-type"
            data-type={form.values.type}
            data={[
              { label: 'Despesa', value: 'expense' },
              { label: 'Receita', value: 'income' },
            ]}
            {...form.getInputProps('type')}
          />
        </Input.Wrapper>

        <TextInput label="Descrição" placeholder="Ex.: Supermercado" data-autofocus {...form.getInputProps('description')} />

        <Group grow align="flex-start">
          <MoneyInput label="Valor" {...form.getInputProps('amount')} />
          <DateInput
            label="Data"
            valueFormat="DD/MM/YYYY"
            minDate={occurrenceMonth?.format('YYYY-MM-DD')}
            maxDate={occurrenceMonth?.endOf('month').format('YYYY-MM-DD')}
            {...form.getInputProps('occurred_on')}
          />
        </Group>

        <TagSelect tags={tags} value={form.values.tag_ids} onChange={(v) => form.setFieldValue('tag_ids', v)} error={form.errors.tag_ids} />

        {occurrenceMonth && (
          <Text size="xs" c="dimmed">
            Altera só {occurrenceMonth.format('MMMM [de] YYYY')}. Para mudar todos os meses, edite na aba Recorrência.
          </Text>
        )}

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
