import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { AuthError, PostgrestError } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { handleServerError } from '@/lib/handle-server-error'
import { invalidateSessionCache, supabase } from '@/lib/supabase'
import { DirectionProvider } from './context/direction-provider'
import { FontProvider } from './context/font-provider'
import { ThemeProvider } from './context/theme-provider'
// Generated Routes
import { routeTree } from './routeTree.gen'
// Styles
import './styles/index.css'

function isAuthDenied(error: unknown) {
  if (error instanceof AuthError) return true
  // RLS/permução negada não deve ser re-tentada.
  if (error instanceof PostgrestError)
    return error.code === '42501' || error.code === 'PGRST301'
  return false
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (import.meta.env.DEV) return false
        if (failureCount > 3) return false
        return !isAuthDenied(error)
      },
      refetchOnWindowFocus: import.meta.env.PROD,
      staleTime: 10 * 1000,
    },
    mutations: {
      onError: (error) => handleServerError(error),
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof AuthError) {
        toast.error('Sua sessão expirou.')
        supabase.auth.signOut()
        useAuthStore.getState().auth.reset()
        invalidateSessionCache()
        const redirect = `${router.history.location.href}`
        router.navigate({ to: '/sign-in', search: { redirect } })
      }
    },
  }),
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Hidrata o auth-store a partir da sessão Supabase e mantém sincronizado.
supabase.auth.getSession().then(({ data }) => {
  useAuthStore.getState().auth.setSession(data.session)
})
supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.getState().auth.setSession(session)
  invalidateSessionCache()
})

const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <FontProvider>
            <DirectionProvider>
              <RouterProvider router={router} />
            </DirectionProvider>
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
