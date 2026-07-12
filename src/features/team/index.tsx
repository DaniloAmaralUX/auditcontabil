import { useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { qk } from '@/lib/query-keys'
import { roleLabels } from '@/lib/permissions'
import { supabase, type Role } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import { Main } from '@/components/layout/main'
import { PageHeader, PageTitle } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Member = {
  id: string
  full_name: string
  role: Role
  is_active: boolean
  created_at: string
}

function membersQuery() {
  return queryOptions({
    queryKey: qk.team.members,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, is_active, created_at')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Member[]
    },
  })
}

const inviteSchema = z.object({
  email: z.email({ error: 'Informe um e-mail válido.' }),
  full_name: z.string().min(2, 'Informe o nome.'),
  role: z.enum(['accountant', 'analyst']),
})
type InviteForm = z.infer<typeof inviteSchema>

function useInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: InviteForm) => {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: values.email,
          full_name: values.full_name,
          role: values.role,
          redirect_to: `${window.location.origin}/accept-invite`,
        },
      })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(String(data.detail ?? data.error))
    },
    onSuccess: () => {
      toast.success('Convite enviado por e-mail.')
      qc.invalidateQueries({ queryKey: qk.team.members })
    },
  })
}

export function Team() {
  const { data, isLoading } = useQuery(membersQuery())
  const [open, setOpen] = useState(false)
  const invite = useInvite()
  const qc = useQueryClient()
  const myId = useAuthStore((s) => s.auth.userId)

  // RF-004/006: desativar bloqueia o acesso (guard verifica is_active no login/navegação)
  const toggleActive = useMutation({
    mutationFn: async (m: Member) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !m.is_active })
        .eq('id', m.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Situação atualizada.')
      qc.invalidateQueries({ queryKey: qk.team.members })
    },
  })

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', full_name: '', role: 'analyst' },
  })

  async function onSubmit(values: InviteForm) {
    await invite.mutateAsync(values)
    setOpen(false)
    form.reset()
  }

  return (
    <>
      <PageHeader />

      <Main>
        <PageTitle
          title='Equipe'
          description='Convide contadores e analistas para dividir a fila.'
          action={
            <Button onClick={() => setOpen(true)}>
              <UserPlus /> Convidar pessoa
            </Button>
          }
        />

        <div className='rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow className='bg-muted/40'>
                <TableHead>Nome</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Skeleton className='h-6 w-full' />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && (data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className='py-10 text-center'>
                    <p className='text-sm font-medium'>
                      Você ainda trabalha sozinha por aqui.
                    </p>
                    <p className='text-sm text-muted-foreground'>
                      Convide contadores e analistas para dividir a fila.
                    </p>
                  </TableCell>
                </TableRow>
              )}
              {(data ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className='font-medium'>
                    {m.full_name || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline'>{roleLabels[m.role]}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <Switch
                        checked={m.is_active}
                        onCheckedChange={() => toggleActive.mutate(m)}
                        disabled={m.id === myId || toggleActive.isPending}
                        aria-label={m.is_active ? 'Desativar usuário' : 'Ativar usuário'}
                      />
                      <span className='text-sm text-muted-foreground'>
                        {m.is_active ? 'Ativo' : 'Desativado'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Convidar pessoa</DialogTitle>
            <DialogDescription>
              A pessoa recebe um e-mail para definir a senha e entrar no
              escritório.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              id='invite-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='grid gap-3'
            >
              <FormField
                control={form.control}
                name='full_name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder='Nome completo' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input placeholder='pessoa@escritorio.com' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='role'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Papel</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='accountant'>
                          Contador responsável — revisa e conclui auditorias
                        </SelectItem>
                        <SelectItem value='analyst'>
                          Analista — prepara dados e mapeamentos
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setOpen(false)}
              disabled={invite.isPending}
            >
              Cancelar
            </Button>
            <Button type='submit' form='invite-form' disabled={invite.isPending}>
              {invite.isPending && <Spinner className='size-4' />}
              Enviar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
