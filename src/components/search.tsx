import { SearchIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSearch } from '@/context/search-provider'
import { Button } from './ui/button'
import { Kbd, KbdGroup } from './ui/kbd'

// O affordance visível deve casar com a tecla real (⌘ no Mac, Ctrl no Windows).
const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export function Search({
  className = '',
  placeholder = 'Buscar',
  ...props
}: React.ComponentProps<'button'> & { placeholder?: string }) {
  const { setOpen } = useSearch()
  return (
    <Button
      {...props}
      variant='outline'
      className={cn(
        'group relative h-8 w-full flex-1 justify-start rounded-md bg-muted/25 text-sm font-normal text-muted-foreground shadow-none hover:bg-accent sm:w-40 sm:pe-12 md:flex-none lg:w-52 xl:w-64 pointer-coarse:min-h-11',
        className
      )}
      aria-keyshortcuts='Meta+K Control+K'
      onClick={() => setOpen(true)}
    >
      <SearchIcon
        aria-hidden='true'
        className='absolute inset-s-1.5 top-1/2 -translate-y-1/2'
        size={16}
      />
      <span className='ms-4'>{placeholder}</span>
      <KbdGroup className='absolute inset-e-[0.35rem] top-1/2 hidden -translate-y-1/2 sm:flex'>
        <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    </Button>
  )
}
