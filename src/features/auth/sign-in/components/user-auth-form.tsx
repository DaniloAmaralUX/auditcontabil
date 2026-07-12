import { useState } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { LogIn } from 'lucide-react'
import { setRememberSession, supabase } from '@/lib/supabase'
import { strings } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/password-input'

const formSchema = z.object({
  email: z.email({ error: 'Informe um e-mail válido.' }),
  password: z.string().min(1, 'Informe sua senha.'),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [remember, setRemember] = useState(true)
  const navigate = useNavigate()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    // Define ONDE a sessão é guardada antes do login gravar o token.
    setRememberSession(remember)
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    setIsLoading(false)
    if (error) {
      // Erro persistente junto ao formulário (não só um toast que some).
      form.setError('root', { message: strings.auth.invalidCredentials })
      return
    }
    navigate({ to: redirectTo || '/', replace: true })
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
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
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel>{strings.auth.password}</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder='********'
                  autoComplete='current-password'
                  {...field}
                />
              </FormControl>
              <FormMessage />
              <Link
                to='/forgot-password'
                className='absolute inset-e-0 -top-0.5 text-sm font-medium text-muted-foreground hover:opacity-75'
              >
                {strings.auth.forgot}
              </Link>
            </FormItem>
          )}
        />
        <div className='flex items-center gap-2'>
          <Checkbox
            id='remember'
            checked={remember}
            onCheckedChange={(v) => setRemember(v === true)}
          />
          <Label
            htmlFor='remember'
            className='cursor-pointer text-sm font-normal text-muted-foreground'
          >
            {strings.auth.rememberMe}
          </Label>
        </div>
        {form.formState.errors.root && (
          <p role='alert' className='text-sm text-destructive'>
            {form.formState.errors.root.message}
          </p>
        )}
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Spinner className='size-4' /> : <LogIn />}
          {strings.auth.signIn}
        </Button>
      </form>
    </Form>
  )
}
