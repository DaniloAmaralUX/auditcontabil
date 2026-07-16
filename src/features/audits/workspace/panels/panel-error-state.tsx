import { strings } from '@/lib/strings'
import { Button } from '@/components/ui/button'

// Falha de rede/query NUNCA pode virar um empty state enganoso
// ("nenhuma inconsistência encontrada" com a query quebrada).
export function PanelErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role='alert'
      className='rounded-lg border border-dashed py-12 text-center'
    >
      <p className='text-sm font-medium'>Não foi possível carregar os dados.</p>
      <Button variant='outline' size='sm' className='mt-2' onClick={onRetry}>
        {strings.common.retry}
      </Button>
    </div>
  )
}
