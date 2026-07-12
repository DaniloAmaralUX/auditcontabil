import { useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/context/theme-provider'
import { Button } from '@/components/ui/button'

/**
 * Alterna claro ↔ escuro em um clique só (sem dropdown, sem opção "sistema"
 * na UI). O ícone atual mostra o modo em que está; o de fundo é o destino.
 * Se o tema estava seguindo o sistema, o primeiro clique vai para o oposto
 * do que está resolvido no momento.
 */
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    const themeColor = theme === 'dark' ? '#020817' : '#fff'
    const metaThemeColor = document.querySelector("meta[name='theme-color']")
    if (metaThemeColor) metaThemeColor.setAttribute('content', themeColor)
  }, [theme])

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches)

  const next = isDark ? 'light' : 'dark'
  const label = isDark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'

  return (
    <Button
      variant='ghost'
      size='icon'
      className='scale-95 rounded-full'
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
    >
      <Sun className='size-[1.2rem] scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90' />
      <Moon className='absolute size-[1.2rem] scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0' />
      <span className='sr-only'>{label}</span>
    </Button>
  )
}
