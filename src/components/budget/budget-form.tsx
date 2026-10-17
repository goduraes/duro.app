'use client';

import { Button, Group, Input, NumberInput, SegmentedControl, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { TagSelect } from '@/components/tag-select';
import { createClient } from '@/lib/supabase/client';
import { formatCents, fromCents, toCents } from '@/lib/money';
import { budgetSchema, type BudgetValues } from '@/lib/schemas';
import type { BudgetRow, Tag } from '@/lib/types';

type FormValues = Omit<BudgetValues, 'amount' | 'percent' | 'tag_id'> & {
  tag_id: string;
  amount: number | '' | null;
  percent: number | '' | null;
};

interface Props {
  budget: BudgetRow | null;
  /** Tags que ainda não têm orçamento (mais a do próprio orçamento, ao editar). */
  tags: Tag[];
  /** Receitas do mês mostrado na tela, para a prévia do valor em porcentagem. */
  incomeCents: number;
  monthLabel: string;
  onDone: () => void;
}

export function BudgetForm({ budget, tags, incomeCents, monthLabel, onDone }: Props) {
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    initialValues: {
      tag_id: budget?.tag_id ?? '',
      kind: budget?.kind ?? 'fixed',
      amount: budget?.kind === 'fixed' && budget.amount_cents ? fromCents(budget.amount_cents) : budget ? null : '',
      percent: budget?.kind === 'percent' ? budget.percent : null,
    },
    validate: zod4Resolver(budgetSchema, { errorPriority: 'first' }),
  });

  function changeKind(kind: 'fixed' | 'percent') {
    form.setValues({ kind, amount: kind === 'fixed' ? '' : null, percent: kind === 'percent' ? '' : null });
    form.clearFieldError('amount');
    form.clearFieldError('percent');
  }

  const save = useMutation({
    mutationFn: async (values: BudgetValues) => {
      const payload = {
        tag_id: values.tag_id,
        kind: values.kind,
        amount_cents: values.kind === 'fixed' && values.amount !== null ? toCents(values.amount) : null,
        percent: values.kind === 'percent' ? values.percent : null,
      };
      const table = createClient().from('budgets');
      const { error } = budget ? await table.update(payload).eq('id', budget.id) : await table.insert(payload);
      if (error) {
        if (error.code === '23505') throw new Error('Já existe um orçamento para essa tag.');
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', 'budgets'] });
      notifications.show({ color: 'teal', message: budget ? 'Orçamento atualizado.' : 'Orçamento criado.' });
      onDone();
    },
    onError: (error: Error) => notifications.show({ color: 'red', title: 'Erro ao salvar', message: error.message }),
  });

  const percent = Number(form.values.percent) || 0;

  return (
    <form onSubmit={form.onSubmit((values) => save.mutate(values as BudgetValues))} noValidate>
      <Stack>
        <TagSelect
          tags={tags}
          value={form.values.tag_id ? [form.values.tag_id] : []}
          onChange={(v) => form.setFieldValue('tag_id', v[0] ?? '')}
          error={form.errors.tag_id}
        />

        <Input.Wrapper label="Tipo do limite">
          <SegmentedControl
            fullWidth
            value={form.values.kind}
            onChange={(v) => changeKind(v as 'fixed' | 'percent')}
            data={[
              { label: 'Valor fixo', value: 'fixed' },
              { label: '% das receitas', value: 'percent' },
            ]}
          />
        </Input.Wrapper>

        {form.values.kind === 'fixed' ? (
          <NumberInput
            label="Limite mensal"
            prefix="R$ "
            decimalScale={2}
            fixedDecimalScale
            decimalSeparator=","
            thousandSeparator="."
            min={0}
            allowNegative={false}
            {...form.getInputProps('amount')}
          />
        ) : (
          <>
            <NumberInput
              label="Porcentagem das receitas"
              suffix="%"
              decimalScale={2}
              decimalSeparator=","
              min={0}
              max={100}
              allowNegative={false}
              {...form.getInputProps('percent')}
            />
            <Text size="xs" c="dimmed" mt={-8}>
              {percent > 0
                ? `Em ${monthLabel}: ${formatCents(Math.round((incomeCents * percent) / 100))} (${percent.toLocaleString('pt-BR')}% de ${formatCents(incomeCents)} de receitas). O limite muda a cada mês, conforme as receitas.`
                : 'O limite é recalculado a cada mês, conforme as receitas daquele mês.'}
            </Text>
          </>
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
