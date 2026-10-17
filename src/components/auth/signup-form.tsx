'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Anchor, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import { signupSchema, type SignupValues } from '@/lib/schemas';

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<SignupValues>({
    initialValues: { name: '', email: '', password: '', confirm: '' },
    validate: zod4Resolver(signupSchema, { errorPriority: 'first' }),
  });

  async function handleSubmit(values: SignupValues) {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { name: values.name },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });

      if (error) {
        const code = error.code ?? '';
        if (code === 'user_already_exists' || /already registered/i.test(error.message)) {
          setError('Este e-mail já está cadastrado.');
          form.setFieldError('email', 'Este e-mail já está cadastrado');
        } else if (code === 'weak_password') {
          setError('Senha muito fraca. Escolha uma senha mais forte.');
          form.setFieldError('password', 'Senha muito fraca');
        } else if (code === 'email_address_invalid' || code === 'validation_failed') {
          setError('Não foi possível usar este e-mail.');
          form.setFieldError('email', 'E-mail inválido');
        } else if (code.includes('rate_limit')) {
          setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
        } else {
          setError(`Não foi possível criar a conta: ${error.message}`);
        }
        setLoading(false);
        return;
      }

      if (data.session) {
        router.replace('/dashboard');
        router.refresh();
        return;
      }

      // Confirmação de e-mail habilitada no projeto
      setNeedsConfirmation(true);
      setLoading(false);
    } catch (e) {
      // Ex.: variáveis NEXT_PUBLIC_SUPABASE_* ausentes (reinicie o `npm run dev` após criar o .env.local)
      setError(`Erro inesperado: ${e instanceof Error ? e.message : String(e)}`);
      setLoading(false);
    }
  }

  if (needsConfirmation) {
    return (
      <Paper withBorder p="xl" radius="xl">
        <Stack>
          <Alert color="teal" icon={<IconCheck size={18} />} title="Quase lá!">
            Enviamos um link de confirmação para o seu e-mail. Ao clicar nele, sua conta é ativada e você já entra no app.
          </Alert>
          <Anchor component={Link} href="/login" ta="center" size="sm">
            Ir para o login
          </Anchor>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="xl" radius="xl">
      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack>
          <Title order={3}>Criar conta</Title>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />}>
              {error}
            </Alert>
          )}

          <TextInput label="Nome" autoComplete="name" {...form.getInputProps('name')} />
          <TextInput
            label="E-mail"
            type="email"
            autoComplete="email"
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Senha"
            description="Mínimo de 8 caracteres"
            autoComplete="new-password"
            {...form.getInputProps('password')}
          />
          <PasswordInput
            label="Confirmar senha"
            autoComplete="new-password"
            {...form.getInputProps('confirm')}
          />
          <Button type="submit" loading={loading} fullWidth>
            Criar conta
          </Button>
          <Text size="sm" ta="center">
            Já tem conta?{' '}
            <Anchor component={Link} href="/login">
              Entrar
            </Anchor>
          </Text>
        </Stack>
      </form>
    </Paper>
  );
}
