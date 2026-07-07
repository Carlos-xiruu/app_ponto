import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Ponto Seguro',
        short_name: 'PontoSeguro',
        description: 'Sistema de Gestão e Auditoria de Ponto',
        theme_color: '#0f172a', /* A cor da barra de status do celular */
        background_color: '#020617',
        display: 'standalone', /* Isso arranca a barra de navegação e deixa em tela cheia */
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})