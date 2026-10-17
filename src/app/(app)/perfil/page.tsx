import type { Metadata } from 'next';
import { ProfileView } from '@/components/profile/profile-view';
import { requireProfile } from '@/lib/auth';
import { avatarPublicUrl } from '@/lib/avatar';

export const metadata: Metadata = { title: 'Perfil' };

export default async function ProfilePage() {
  const profile = await requireProfile();
  return <ProfileView profile={profile} avatarUrl={avatarPublicUrl(profile.avatar_path)} />;
}
