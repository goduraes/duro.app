import type { ReactNode } from 'react';
import { AppFrame } from '@/components/app-frame';
import { requireProfile } from '@/lib/auth';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile();

  return (
    <AppFrame user={{ name: profile.name || profile.email, email: profile.email, role: profile.role }}>
      {children}
    </AppFrame>
  );
}
