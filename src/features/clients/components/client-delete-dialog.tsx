import { strings } from '@/lib/strings'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useDeleteClient } from '../data/mutations'
import { type Cliente } from '../data/schema'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: Cliente
}

export function ClientDeleteDialog({ open, onOpenChange, currentRow }: Props) {
  const del = useDeleteClient()
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={strings.clients.deleteTitle}
      desc={
        <>
          <p className='mb-2'>
            Remover <strong>{currentRow.name}</strong>?
          </p>
          <p>{strings.clients.deleteBody}</p>
        </>
      }
      confirmText={strings.common.remove}
      destructive
      isLoading={del.isPending}
      handleConfirm={async () => {
        await del.mutateAsync(currentRow)
        onOpenChange(false)
      }}
    />
  )
}
