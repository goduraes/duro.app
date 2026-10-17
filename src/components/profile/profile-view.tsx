'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Group, Paper, PasswordInput, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/page-header';
import { createClient } from '@/lib/supabase/client';
import {
  changePasswordSchema,
  profileSchema,
  type ChangePasswordValues,
  type ProfileValues,
} from '@/lib/schemas';
import type { Profile } from '@/lib/types';
import { updateProfileName } from '@/app/(app)/perfil/actions';

export function ProfileView({ profile }: { profile: Profile }) {
  return (
    <Stack gap="lg">
      <PageHeader title="Perfil" description="Seus dados e a segurança da sua conta." />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <DataCard profile={profile} />
        <PasswordCard email={profile.email} />
      </SimpleGrid>
    </Stack>
  );
}

function DataCard({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<ProfileValues>({
    initialValues: { name: profile.name },
    validate: zod4Resolver(profileSchema, { errorPriority: 'first' }),
  });

  async function handleSubmit(values: ProfileValues) {
    setLoading(true);
    setError(null);
    const result = await updateProfileName(values);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    form.resetDirty(values);
    notifications.show({ color: 'teal', icon: <IconCheck size={16} />, message: 'Perfil atualizado.' });
    router.refresh();
  }

  return (
    <Paper withBorder p="xl" radius="xl" h="100%">
      <form onSubmit={form.onSubmit(handleSubmit)} noValidate style={{ height: "100%" }}>
        <Stack h="100%">
          <Title order={4}>Dados pessoais</Title>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />}>
              {error}
            </Alert>
          )}

          <TextInput label="Nome" autoComplete="name" {...form.getInputProps('name')} />
          <TextInput
            label="E-mail"
            value={profile.email}
            readOnly
            description="O e-mail não pode ser alterado por aqui."
          />
          <Group gap="xl">
            <div>
              <Text size="xs" c="dimmed">
                Tipo de conta
              </Text>
              <Badge variant="light" color={profile.role === 'admin' ? 'grape' : 'gray'} mt={4}>
                {profile.role === 'admin' ? 'Administrador' : 'Comum'}
              </Badge>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Membro desde
              </Text>
              <Text size="sm" mt={4}>
                {dayjs(profile.created_at).format('DD/MM/YYYY')}
              </Text>
            </div>
          </Group>

          <Group justify="flex-end" mt="auto">
            <Button type="submit" loading={loading} disabled={!form.isDirty()}>
              Salvar
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}

function PasswordCard({ email }: { email: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<ChangePasswordValues>({
    initialValues: { current: '', password: '', confirm: '' },
    validate: zod4Resolver(changePasswordSchema, { errorPriority: 'first' }),
  });

  async function handleSubmit(values: ChangePasswordValues) {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Confirma a senha atual antes de trocar.
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: values.current,
      });
      if (authError) {
        if (authError.code === 'invalid_credentials' || /invalid login credentials/i.test(authError.message)) {
          form.setFieldError('current', 'Senha atual incorreta');
        } else {
          setError(`Não foi possível verificar a senha atual: ${authError.message}`);
        }
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: values.password });
      if (updateError) {
        if (updateError.code === 'same_password') {
          form.setFieldError('password', 'A nova senha deve ser diferente da atual');
        } else if (updateError.code === 'weak_password') {
          form.setFieldError('password', 'Senha muito fraca');
        } else {
          setError(`Não foi possível alterar a senha: ${updateError.message}`);
        }
        setLoading(false);
        return;
      }

      form.reset();
      setLoading(false);
      notifications.show({ color: 'teal', icon: <IconCheck size={16} />, message: 'Senha alterada.' });
    } catch (e) {
      setError(`Erro inesperado: ${e instanceof Error ? e.message : String(e)}`);
      setLoading(false);
    }
  }

  return (
    <Paper withBorder p="xl" radius="xl" h="100%">
      <form onSubmit={form.onSubmit(handleSubmit)} noValidate style={{ height: "100%" }}>
        <Stack h="100%">
          <Title order={4}>Alterar senha</Title>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={18} />}>
              {error}
            </Alert>
          )}

          <PasswordInput
            label="Senha atual"
            autoComplete="current-password"
            {...form.getInputProps('current')}
          />
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
          <Group justify="flex-end" mt="auto">
            <Button type="submit" loading={loading}>
              Alterar senha
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
