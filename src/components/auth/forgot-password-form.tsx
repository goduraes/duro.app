'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Alert, Anchor, Button, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/schemas';

export function ForgotPasswordForm({ invalidLink }: { invalidLink: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<ForgotPasswordValues>({
    initialValues: { email: '' },
    validate: zod4Resolver(forgotPasswordSchema, { errorPriority: 'first' }),
  });

  async function handleSubmit(values: ForgotPasswordValues) {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
      });
      if (error) {
        if ((error.code ?? '').includes('rate_limit') || /rate limit/i.test(error.message)) {
          setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
        } else {
          setError(`Não foi possível enviar o e-mail: ${error.message}`);
        }
        setLoading(false);
        return;
      }
      // Mensagem neutra: não revela se o e-mail está cadastrado.
      setSentTo(values.email);
      setLoading(false);
    } catch (e) {
      setError(`Erro inesperado: ${e instanceof Error ? e.message : String(e)}`);
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <Paper withBorder p="xl" radius="xl">
        <Stack>
          <Alert color="teal" icon={<IconCheck size={18} />} title="Verifique seu e-mail">
            Se <strong>{sentTo}</strong> estiver cadastrado, enviamos um link para redefinir a senha.
          </Alert>
          <Anchor component={Link} href="/login" ta="center" size="sm">
            Voltar para o login
          </Anchor>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="xl" radius="xl">
      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack>
          <Title order={3}>Esqueci minha senha</Title>
          <Text size="sm" c="dimmed">
            Informe seu e-mail e enviaremos um link para criar uma nova senha.
          </Text>

          {invalidLink && (
            <Alert color="orange" icon={<IconAlertCircle size={18} />}>
              O link é inválido ou expirou. Solicite um novo.
            </Alert>
          )}
          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />}>
              {error}
            </Alert>
          )}

          <TextInput
            label="E-mail"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            {...form.getInputProps('email')}
          />
          <Button type="submit" loading={loading} fullWidth>
            Enviar link
          </Button>
          <Anchor component={Link} href="/login" ta="center" size="sm">
            Voltar para o login
          </Anchor>
        </Stack>
      </form>
    </Paper>
  );
}
