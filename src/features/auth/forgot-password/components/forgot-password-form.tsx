import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { strings } from '@/lib/strings'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

const formSchema = z.object({
  email: z.email({ error: 'Informe um e-mail válido.' }),
})

export function ForgotPasswordForm({
  className,
  ...props
}: React.HTMLAttributes<HTMLFormElement>) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    const redirectTo = `${window.location.origin}/accept-invite`
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo,
    })
    setIsLoading(false)
    if (error) {
      toast.error(strings.auth.genericError)
      return
    }
    form.reset()
    // Mensagem genérica: não revela se o e-mail existe.
    toast.success(
      'Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha.'
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-2', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{strings.auth.email}</FormLabel>
              <FormControl>
                <Input
                  placeholder='voce@escritorio.com'
                  autoComplete='email'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {strings.auth.sendLink}
          {isLoading ? <Spinner className='size-4' /> : <ArrowRight />}
        </Button>
      </form>
    </Form>
  )
}
