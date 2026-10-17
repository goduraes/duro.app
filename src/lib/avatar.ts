/** URL pública da foto de perfil (bucket "avatars" do Supabase Storage), ou null se o usuário não tem foto. */
export function avatarPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
}
