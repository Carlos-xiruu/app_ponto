import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Atualiza o app no celular do usuário sozinho quando você subir versão nova
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Ponto Seguro - Auditoria',
        short_name: 'Ponto Seguro',
        description: 'Controle de Jornada e Assinaturas Eletrônicas',
        theme_color: '#020617', // Cor da barra superior do celular (mesma do app)
        background_color: '#020617', // Cor da tela de carregamento (Splash Screen)
        display: 'standalone', // Faz o app rodar em tela cheia, sem barra de navegação
        orientation: 'portrait', // Trava o app em pé (modo retrato)
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})