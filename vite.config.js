import { readFileSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// Testes automáticos das telas: HOMEFIT_MOCK=1 troca o banco real por um banco simulado em memória.
// No build normal (npm run build) isso não acontece e o simulado não entra no site.
const simulado = process.env.HOMEFIT_MOCK === '1'

// Cabeçalhos de segurança do site publicado (vercel.json). O "npm run preview" usa os mesmos,
// para testar no computador com as mesmas regras. Só ficam de fora os dois que exigem https.
const seguranca = Object.fromEntries(
  JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'))
    .headers[0].headers.filter((h) => h.key !== 'Strict-Transport-Security')
    .map((h) => [h.key, h.value.replace('; upgrade-insecure-requests', '')]),
)

// https://vite.dev/config/
export default defineConfig({
  // arquivos copiados como estão para o site (ícones, manifest, página 404)
  publicDir: 'publico',
  preview: { headers: seguranca },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  resolve: {
    alias: simulado
      ? [{ find: /^(\.\.?\/)+servicos\/banco$|^\.\/banco$/, replacement: fileURLToPath(new URL('./src/servicos/banco.simulado.js', import.meta.url)) }]
      : [],
  },
})
