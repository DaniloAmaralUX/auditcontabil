import { ClientActionDialog } from './client-action-dialog'
import { ClientDeleteDialog } from './client-delete-dialog'
import { useClients } from './clients-provider'

export function ClientsDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useClients()

  function close() {
    setOpen(null)
    // limpa a linha após a animação de fechamento (padrão do template)
    setTimeout(() => setCurrentRow(null), 300)
  }

  return (
    <>
      <ClientActionDialog
        open={open === 'create'}
        onOpenChange={(v) => (v ? setOpen('create') : close())}
      />
      {currentRow && (
        <>
          <ClientActionDialog
            key={`edit-${currentRow.id}`}
            open={open === 'update'}
            onOpenChange={(v) => (v ? setOpen('update') : close())}
            currentRow={currentRow}
          />
          <ClientDeleteDialog
            key={`delete-${currentRow.id}`}
            open={open === 'delete'}
            onOpenChange={(v) => (v ? setOpen('delete') : close())}
            currentRow={currentRow}
          />
        </>
      )}
    </>
  )
}
