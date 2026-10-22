'use client';

import dayjs from 'dayjs';
import { Button, Group, Input, NumberInput, SegmentedControl, Stack, Text, TextInput } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { MoneyInput } from '@/components/money-input';
import { formatMonthLabel } from '@/components/period-filter';
import { TagSelect } from '@/components/tag-select';
import { createClient } from '@/lib/supabase/client';
import { formatCents, fromCents, toCents } from '@/lib/money';
import { recurringSchema, type RecurringValues } from '@/lib/schemas';
import type { Recurring, Tag } from '@/lib/types';

type Mode = RecurringValues['mode'];

type FormValues = Omit<RecurringValues, 'amount' | 'day_of_month' | 'installments'> & {
  amount: number | '';
  day_of_month: number | '';
  installments: number | '' | null;
};

interface Props {
  recurring: Recurring | null;
  tags: Tag[];
  onDone: () => void;
}

const DEFAULT_INSTALLMENTS = 12;
const FMT = 'YYYY-MM-DD';

/** Como uma recorrência salva está configurada: parcelada (com total) ou por mês (com ou sem mês de fim). */
function modeOf(r: Recurring | null): Mode {
  return r?.end_date && r.total_cents ? 'installments' : 'until';
}

function monthsBetween(startDate: string, endDate: string) {
  return dayjs(endDate).diff(dayjs(startDate).startOf('month'), 'month') + 1;
}

export function RecurringForm({ recurring, tags, onDone }: Props) {
  const queryClient = useQueryClient();
  const initialMode = modeOf(recurring);
  const initialCount = recurring?.end_date ? monthsBetween(recurring.start_date, recurring.end_date) : null;

  const form = useForm<FormValues>({
    initialValues: {
      type: recurring?.type ?? 'expense',
      description: recurring?.description ?? '',
      // Parcelada: o campo mostra o total. Nos outros modos, o valor de cada mês.
      amount: recurring
        ? fromCents(
            initialMode === 'installments'
              ? (recurring.total_cents ?? recurring.amount_cents * (initialCount ?? 1))
              : recurring.amount_cents,
          )
        : 0,
      day_of_month: recurring?.day_of_month ?? dayjs().date(),
      start_date: recurring?.start_date ?? dayjs().startOf('month').format(FMT),
      mode: initialMode,
      end_date: initialMode === 'until' ? (recurring?.end_date ?? null) : null,
      installments: initialMode === 'installments' ? initialCount : null,
      tag_ids: recurring?.tags.map((t) => t.id) ?? [],
    },
    validate: zod4Resolver(recurringSchema, { errorPriority: 'first' }),
  });

  function changeMode(mode: Mode) {
    form.setValues({
      mode,
      installments: mode === 'installments' ? DEFAULT_INSTALLMENTS : null,
      end_date: null,
    });
    form.clearFieldError('end_date');
    form.clearFieldError('installments');
  }

  const save = useMutation({
    mutationFn: async (values: RecurringValues) => {
      const start = dayjs(values.start_date).startOf('month');
      const entered = toCents(values.amount);

      let amountCents = entered; // valor de cada mês
      let totalCents: number | null = null;
      let endDate: string | null = null;

      if (values.mode === 'installments' && values.installments) {
        // Parcelada: divide o total (a última parcela leva a diferença de centavos, no banco).
        amountCents = Math.floor(entered / values.installments);
        totalCents = entered;
        endDate = start.add(values.installments - 1, 'month').endOf('month').format(FMT);
      } else if (values.mode === 'until' && values.end_date) {
        endDate = dayjs(values.end_date).endOf('month').format(FMT);
      }

      const { error } = await createClient().rpc('save_recurring_transaction', {
        p_id: recurring?.id ?? null,
        p_description: values.description.trim(),
        p_amount_cents: amountCents,
        p_type: values.type,
        p_start_date: start.format(FMT),
        p_end_date: endDate,
        p_day_of_month: values.day_of_month,
        p_total_cents: totalCents,
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

  const { mode } = form.values;
  const day = Number(form.values.day_of_month) || null;
  const amount = Number(form.values.amount) || 0;
  const n = Number(form.values.installments) || 0;

  // Resumo do que será lançado, calculado como o banco faz.
  let summary: string;
  if (mode === 'installments') {
    if (n >= 2 && amount) {
      const total = toCents(amount);
      const base = Math.floor(total / n);
      const last = total - base * (n - 1);
      summary =
        last === base
          ? `${n}x de ${formatCents(base)}`
          : `${n - 1}x de ${formatCents(base)} e a última de ${formatCents(last)}`;
    } else {
      summary = 'Informe o valor total e a quantidade de parcelas';
    }
  } else if (form.values.end_date) {
    const months = Math.max(monthsBetween(form.values.start_date, form.values.end_date), 0);
    summary = `${amount ? formatCents(toCents(amount)) : 'O valor'} por mês, durante ${months} ${months === 1 ? 'mês' : 'meses'}`;
  } else {
    // sem mês de fim, a recorrência não termina
    summary = `${amount ? formatCents(toCents(amount)) : 'O valor'} por mês, sem prazo para terminar`;
  }
  const dayText = day
    ? `Lançada todo dia ${day}${day > 28 ? ' (no último dia dos meses mais curtos)' : ''}`
    : 'Lançada todo mês';

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

        <Input.Wrapper label="Duração">
          <SegmentedControl
            fullWidth
            value={mode}
            onChange={(v) => changeMode(v as Mode)}
            data={[
              { label: 'Até um mês', value: 'until' },
              { label: 'Parcelas', value: 'installments' },
            ]}
          />
        </Input.Wrapper>

        <MoneyInput label={mode === 'installments' ? 'Valor total' : 'Valor mensal'} {...form.getInputProps('amount')} />

        <Group grow align="flex-start">
          <MonthPickerInput
            label="Mês de início"
            valueFormatter={({ date }) => (typeof date === 'string' ? formatMonthLabel(date, true) : '')}
            {...form.getInputProps('start_date')}
          />
          {mode === 'until' && (
            <MonthPickerInput
              label="Mês de fim"
              placeholder="Sem data final"
              description="Em branco, não tem fim"
              inputWrapperOrder={['label', 'input', 'description', 'error']}
              clearable
              valueFormatter={({ date }) => (typeof date === 'string' ? formatMonthLabel(date, true) : '')}
              minDate={form.values.start_date || undefined}
              {...form.getInputProps('end_date')}
            />
          )}
          {mode === 'installments' && (
            <NumberInput
              label="Parcelas"
              description="O total é dividido entre elas"
              inputWrapperOrder={['label', 'input', 'description', 'error']}
              min={2}
              max={120}
              allowDecimal={false}
              allowNegative={false}
              {...form.getInputProps('installments')}
            />
          )}
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
          {summary}. {dayText}.
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
