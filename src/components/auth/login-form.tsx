'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Anchor, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { IconAlertCircle } from '@tabler/icons-react';
import { createClient } from '@/lib/supabase/client';
import { loginSchema, type LoginValues } from '@/lib/schemas';

export function LoginForm({ deactivated, invalidLink }: { deactivated: boolean; invalidLink: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginValues>({
    initialValues: { email: '', password: '' },
    validate: zod4Resolver(loginSchema, { errorPriority: 'first' }),
  });

  async function handleSubmit(values: LoginValues) {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword(values);
      if (error) {
        const invalid =
          error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message);
        if (invalid) {
          setError('E-mail ou senha incorretos.');
          form.setFieldError('password', 'E-mail ou senha incorretos');
        } else if (error.code === 'email_not_confirmed') {
          setError('Confirme seu e-mail antes de entrar. Verifique a caixa de entrada (e o spam).');
        } else {
          setError(`Não foi possível entrar: ${error.message}`);
        }
        setLoading(false);
        return;
      }
      router.replace('/dashboard');
      router.refresh();
    } catch (e) {
      // Ex.: variáveis NEXT_PUBLIC_SUPABASE_* ausentes (reinicie o `npm run dev` após criar o .env.local)
      setError(`Erro inesperado: ${e instanceof Error ? e.message : String(e)}`);
      setLoading(false);
    }
  }

  return (
    <Paper withBorder p="xl" radius="xl">
      <form onSubmit={form.onSubmit(handleSubmit)} noValidate>
        <Stack>
          <Title order={3}>Entrar</Title>

          {deactivated && (
            <Alert color="orange" icon={<IconAlertCircle size={18} />}>
              Sua conta está desativada. Fale com um administrador.
            </Alert>
          )}
          {invalidLink && (
            <Alert color="orange" icon={<IconAlertCircle size={18} />}>
              O link de confirmação é inválido ou expirou. Entre com seu e-mail e senha; se a conta ainda não
              foi confirmada, cadastre-se novamente.
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
          <PasswordInput
            label="Senha"
            autoComplete="current-password"
            {...form.getInputProps('password')}
          />
          <Anchor component={Link} href="/esqueci-senha" size="sm" ta="right">
            Esqueci minha senha
          </Anchor>
          <Button type="submit" loading={loading} fullWidth>
            Entrar
          </Button>
          <Text size="sm" ta="center">
            Ainda não tem conta?{' '}
            <Anchor component={Link} href="/cadastro">
              Criar conta
            </Anchor>
          </Text>
        </Stack>
      </form>
    </Paper>
  );
}
