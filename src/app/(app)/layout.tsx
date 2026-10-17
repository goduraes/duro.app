import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { AppFrame } from '@/components/app-frame';
import { requireProfile } from '@/lib/auth';
import { avatarPublicUrl } from '@/lib/avatar';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile();
  // O estado do menu lateral vem de um cookie para o servidor já entregar a página recolhida (sem piscar).
  const sidebarCollapsed = (await cookies()).get('duro-sidebar-collapsed')?.value === '1';

  return (
    <AppFrame
      user={{
        name: profile.name || profile.email,
        email: profile.email,
        role: profile.role,
        avatarUrl: avatarPublicUrl(profile.avatar_path),
      }}
      initialCollapsed={sidebarCollapsed}
    >
      {children}
    </AppFrame>
  );
}
