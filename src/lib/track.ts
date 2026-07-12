import { supabase } from '@/lib/supabase'

// Telemetria mínima de ativação (funil de onboarding): fire-and-forget,
// nunca quebra a UI, nada de provider externo. Leitura via SQL Editor.
export function track(name: string, props?: Record<string, unknown>) {
  void supabase
    .from('app_events')
    .insert({ name, props: props ?? {} })
    .then(
      () => {},
      () => {} // sem tabela/rede? silêncio — telemetria não é feature
    )
}
