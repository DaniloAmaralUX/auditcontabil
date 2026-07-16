import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { clientsQuery } from '@/features/clients/data/queries'
import { useCreateAudit } from '../data/mutations'
import { auditFormSchema, type AuditForm } from '../data/schema'

type Props = { open: boolean; onOpenChange: (v: boolean) => void }

export function AuditCreateDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const { data: clients } = useQuery(clientsQuery())
  const create = useCreateAudit()

  const form = useForm<AuditForm>({
    resolver: zodResolver(auditFormSchema),
    defaultValues: {
      cliente_id: '',
      title: '',
      period_start: '',
      period_end: '',
    },
  })

  async function onSubmit(values: AuditForm) {
    const auditId = await create.mutateAsync(values)
    onOpenChange(false)
    form.reset()
    navigate({ to: '/audits/$auditId/import', params: { auditId } })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Nova auditoria</DialogTitle>
          <DialogDescription>
            Escolha o cliente e o período. Em seguida você envia as planilhas.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='audit-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='grid gap-3'
          >
            <FormField
              control={form.control}
              name='cliente_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Selecione o cliente' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(clients ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da auditoria</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Ex.: Fechamento Junho/2026'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='grid grid-cols-2 gap-3'>
              <FormField
                control={form.control}
                name='period_start'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Início</FormLabel>
                    <FormControl>
                      <Input type='date' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='period_end'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fim</FormLabel>
                    <FormControl>
                      <Input type='date' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            {strings.common.cancel}
          </Button>
          <Button type='submit' form='audit-form' disabled={create.isPending}>
            {create.isPending && <Spinner className='size-4' />}
            Criar e enviar arquivos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
