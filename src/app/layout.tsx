import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/notifications/styles.css';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/figtree';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: { default: 'Duro.app', template: '%s · Duro.app' },
  description: 'Controle financeiro pessoal: transações, tags e dashboard.',
  applicationName: 'Duro.app',
  // iPhone: abre em tela cheia ao adicionar à tela de início.
  appleWebApp: { capable: true, title: 'Duro.app', statusBarStyle: 'default' },
};

// Cor da barra superior antes de o app carregar (segue o tema do sistema); depois o ThemeColorSync
// passa a seguir o tema escolhido no app.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#6d4aff' },
    { media: '(prefers-color-scheme: dark)', color: '#8b73ff' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
