/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permite abrir o app em desenvolvimento por outro dispositivo da rede (ex.: celular em http://192.168.x.x:3000).
  // Sem isso o Next bloqueia os scripts do dev server e a página não "liga" (o formulário recarrega a página).
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*'],
};

export default nextConfig;
