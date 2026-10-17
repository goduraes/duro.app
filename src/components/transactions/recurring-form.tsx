'use client';

import dayjs from 'dayjs';
import { Button, Group, Input, NumberInput, SegmentedControl, Stack, Text, TextInput } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { TagSelect } from '@/components/tag-select';
import { createClient } from '@/lib/supabase/client';
import { fromCents, toCents } from '@/lib/money';
import { recurringSchema, type RecurringValues } from '@/lib/schemas';
import type { Recurring, Tag } from '@/lib/types';

type FormValues = Omit<RecurringValues, 'amount' | 'day_of_month'> & {
  amount: number | '';
  day_of_month: number | '';
};

interface Props {
  recurring: Recurring | null;
  tags: Tag[];
  onDone: () => void;
}

export function RecurringForm({ recurring, tags, onDone }: Props) {
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    initialValues: {
      type: recurring?.type ?? 'expense',
      description: recurring?.description ?? '',
      amount: recurring ? fromCents(recurring.amount_cents) : '',
      day_of_month: recurring?.day_of_month ?? dayjs().date(),
      start_date: recurring?.start_date ?? dayjs().startOf('month').format('YYYY-MM-DD'),
      end_date: recurring?.end_date ?? null,
      tag_ids: recurring?.tags.map((t) => t.id) ?? [],
    },
    validate: zod4Resolver(recurringSchema, { errorPriority: 'first' }),
  });

  const save = useMutation({
    mutationFn: async (values: RecurringValues) => {
      const supabase = createClient();
      const { error } = await supabase.rpc('save_recurring_transaction', {
        p_id: recurring?.id ?? null,
        p_description: values.description.trim(),
        p_amount_cents: toCents(values.amount),
        p_type: values.type,
        // O intervalo é por mês: do 1º dia do mês inicial ao último dia do mês final.
        p_start_date: dayjs(values.start_date).startOf('month').format('YYYY-MM-DD'),
        p_end_date: values.end_date ? dayjs(values.end_date).endOf('month').format('YYYY-MM-DD') : null,
        p_day_of_month: values.day_of_month,
        p_tag_ids: values.tag_ids,
      });
      if (error) throw new Error(error.message);

    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      notifications.show({ color: 'teal', message: recurring ? 'Recorrência atualizada.' : 'Recorrência criada.' });
      onDone();
    },
    onError: (error: Error) => notifications.show({ color: 'red', title: 'Erro ao salvar', message: error.message }),
  });

  const day = Number(form.values.day_of_month) || null;
  const dayLabel =
    (day ? `Lançada todo dia ${day}` : 'Lançada todo mês') +
    (day && day > 28 ? ' (no último dia dos meses mais curtos)' : '') +
    (form.values.end_date ? ' até o mês final.' : ', sem prazo para terminar.');

  return (
    <form onSubmit={form.onSubmit((values) => save.mutate(values as RecurringValues))} noValidate>
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

        <TextInput label="Descrição" placeholder="Ex.: Aluguel" data-autofocus {...form.getInputProps('description')} />

        <NumberInput
          label="Valor"
          prefix="R$ "
          decimalScale={2}
          fixedDecimalScale
          decimalSeparator=","
          thousandSeparator="."
          min={0}
          allowNegative={false}
          {...form.getInputProps('amount')}
        />

        <Group grow align="flex-start">
          <MonthPickerInput label="Mês de início" valueFormat="MMMM [de] YYYY" {...form.getInputProps('start_date')} />
          <MonthPickerInput
            label="Mês de fim"
            placeholder="Sem data final"
            valueFormat="MMMM [de] YYYY"
            clearable
            minDate={form.values.start_date || undefined}
            {...form.getInputProps('end_date')}
          />
        </Group>

        <NumberInput
          label="Dia do lançamento"
          description="Dia do mês em que a transação é lançada"
          min={1}
          max={31}
          allowDecimal={false}
          allowNegative={false}
          {...form.getInputProps('day_of_month')}
        />
        <Text size="xs" c="dimmed" mt={-8}>
          {dayLabel}
        </Text>

        <TagSelect tags={tags} value={form.values.tag_ids} onChange={(v) => form.setFieldValue('tag_ids', v)} error={form.errors.tag_ids} />

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
