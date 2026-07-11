import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { strings } from '@/lib/strings'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useCreateClient, useUpdateClient } from '../data/mutations'
import { clienteFormSchema, type Cliente, type ClienteForm } from '../data/schema'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Cliente | null
}

export function ClientActionDialog({ open, onOpenChange, currentRow }: Props) {
  const isEdit = !!currentRow
  const create = useCreateClient()
  const update = useUpdateClient()

  const form = useForm<ClienteForm>({
    resolver: zodResolver(clienteFormSchema),
    defaultValues: { name: '', cnpj: '', contact_email: '', is_active: true },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: currentRow?.name ?? '',
        cnpj: currentRow?.cnpj ?? '',
        contact_email: currentRow?.contact_email ?? '',
        is_active: currentRow?.is_active ?? true,
      })
    }
  }, [open, currentRow, form])

  async function onSubmit(values: ClienteForm) {
    if (isEdit && currentRow) {
      await update.mutateAsync({ id: currentRow.id, values })
    } else {
      await create.mutateAsync(values)
    }
    onOpenChange(false)
  }

  const isPending = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar cliente' : strings.clients.new}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Atualize os dados cadastrais do cliente.'
              : 'Cadastre um cliente para criar auditorias.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='client-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='grid gap-3'
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{strings.clients.name}</FormLabel>
                  <FormControl>
                    <Input placeholder='Razão social ou nome' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='cnpj'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{strings.clients.cnpj}</FormLabel>
                  <FormControl>
                    <Input placeholder='00.000.000/0000-00' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='contact_email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{strings.clients.email}</FormLabel>
                  <FormControl>
                    <Input
                      type='email'
                      placeholder='contato@cliente.com'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='is_active'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between rounded-md border p-3'>
                  <FormLabel className='mb-0'>{strings.clients.active}</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {strings.common.cancel}
          </Button>
          <Button type='submit' form='client-form' disabled={isPending}>
            {isPending && <Loader2 className='animate-spin' />}
            {strings.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
