'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Paper, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { IconAlertCircle } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import { resetPasswordSchema, type ResetPasswordValues } from '@/lib/schemas';

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<ResetPasswordValues>({
    initialValues: { password: '', confirm: '' },
    validate: zod4Resolver(resetPasswordSchema, { errorPriority: 'first' }),
  });

  async function handleSubmit(values: ResetPasswordValues) {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) {
        if (error.code === 'same_password') {
          form.setFieldError('password', 'A nova senha deve ser diferente da atual');
        } else if (error.code === 'weak_password') {
          form.setFieldError('password', 'Senha muito fraca');
        } else {
          setError(`Não foi possível redefinir a senha: ${error.message}`);
        }
        setLoading(false);
        return;
      }
      router.replace('/dashboard');
      router.refresh();
    } catch (e) {
      setError(`Erro inesperado: ${e instanceof Error ? e.message : String(e)}`);
      setLoading(false);
    }
  }

  return (
    <Paper withBorder p="xl" radius="xl">
      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack>
          <Title order={3}>Nova senha</Title>
          <Text size="sm" c="dimmed">
            Escolha uma nova senha para a sua conta.
          </Text>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />}>
              {error}
            </Alert>
          )}

          <PasswordInput
            label="Nova senha"
            description="Mínimo de 8 caracteres"
            autoComplete="new-password"
            {...form.getInputProps('password')}
          />
          <PasswordInput
            label="Confirmar nova senha"
            autoComplete="new-password"
            {...form.getInputProps('confirm')}
          />
          <Button type="submit" loading={loading} fullWidth>
            Salvar nova senha
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
