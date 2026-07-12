import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: [
    'src/components/ui/**',
    'src/components/layout/app-title.tsx',
    'src/tanstack-table.d.ts',
    // Deno (Edge Functions) e utilitários fora do grafo do Vite
    'supabase/functions/**',
    'scripts/**',
    'public/**',
  ],
}

export default config
