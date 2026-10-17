import type { MetadataRoute } from 'next';

/** Manifest do PWA: permite instalar o Duro.app na tela inicial / no desktop. Serve em /manifest.webmanifest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Duro.app',
    short_name: 'Duro.app',
    description: 'Controle financeiro pessoal: transações, orçamento e dashboard.',
    lang: 'pt-BR',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // O manifest aceita uma cor só: aqui é a do tema claro. A cor da barra superior acompanha o tema
    // escolhido no app (veja ThemeColorSync) e muda para #8b73ff no tema escuro.
    theme_color: '#6d4aff',
    background_color: '#141414',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Nova transação',
        short_name: 'Nova transação',
        url: '/transacoes?nova=1',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Orçamento',
        short_name: 'Orçamento',
        url: '/orcamento',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
