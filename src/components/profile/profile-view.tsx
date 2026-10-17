'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  FileButton,
  Group,
  Paper,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { PageHeader } from '@/components/page-header';
import { createClient } from '@/lib/supabase/client';
import { resizeSquareJpeg } from '@/lib/image';
import {
  changePasswordSchema,
  profileSchema,
  type ChangePasswordValues,
  type ProfileValues,
} from '@/lib/schemas';
import type { Profile } from '@/lib/types';
import { removeAvatar, saveAvatar, updateProfileName } from '@/app/(app)/perfil/actions';

export function ProfileView({ profile, avatarUrl }: { profile: Profile; avatarUrl: string | null }) {
  return (
    <Stack gap="lg">
      <PageHeader title="Perfil" description="Seus dados e a segurança da sua conta." />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <DataCard profile={profile} avatarUrl={avatarUrl} />
        <PasswordCard email={profile.email} />
      </SimpleGrid>
    </Stack>
  );
}

function DataCard({ profile, avatarUrl }: { profile: Profile; avatarUrl: string | null }) {
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

          <AvatarSection name={profile.name || profile.email} avatarUrl={avatarUrl} />

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

const ACCEPTED_IMAGES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_MB = 10;

/** Foto de perfil: escolhe a imagem, recorta em quadrado no navegador, envia ao Storage e registra. */
function AvatarSection({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);

  const fail = (message: string) => notifications.show({ color: 'red', title: 'Foto de perfil', message });

  async function handleFile(file: File | null) {
    if (!file) return;
    if (!ACCEPTED_IMAGES.includes(file.type)) return fail('Use uma imagem JPG, PNG ou WebP.');
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return fail(`A imagem é muito grande (máximo de ${MAX_IMAGE_MB} MB).`);

    setBusy('upload');
    try {
      const blob = await resizeSquareJpeg(file, 256);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Nome novo a cada envio: a URL muda e o navegador não mostra a foto antiga em cache.
      const path = `${user.id}/avatar-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (error) throw new Error(error.message);

      const result = await saveAvatar(path);
      if (!result.ok) throw new Error(result.error);

      notifications.show({ color: 'teal', icon: <IconCheck size={16} />, message: 'Foto atualizada.' });
      router.refresh();
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Não foi possível enviar a foto.');
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    setBusy('remove');
    const result = await removeAvatar();
    setBusy(null);
    if (!result.ok) return fail(result.error);
    notifications.show({ color: 'teal', icon: <IconCheck size={16} />, message: 'Foto removida.' });
    router.refresh();
  }

  return (
    <Group gap="lg" wrap="nowrap">
      <Avatar src={avatarUrl} alt={name} size={88} radius="xl" color="brand" variant="filled">
        {name.slice(0, 1).toUpperCase()}
      </Avatar>
      <Stack gap={6}>
        <Group gap="xs">
          <FileButton onChange={handleFile} accept={ACCEPTED_IMAGES.join(',')}>
            {(props) => (
              <Button {...props} variant="default" size="xs" loading={busy === 'upload'} disabled={busy === 'remove'}>
                {avatarUrl ? 'Alterar foto' : 'Enviar foto'}
              </Button>
            )}
          </FileButton>
          {avatarUrl && (
            <Button
              variant="subtle"
              color="red"
              size="xs"
              onClick={handleRemove}
              loading={busy === 'remove'}
              disabled={busy === 'upload'}
            >
              Remover
            </Button>
          )}
        </Group>
        <Text size="xs" c="dimmed">
          JPG, PNG ou WebP. A foto é recortada em quadrado.
        </Text>
      </Stack>
    </Group>
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
