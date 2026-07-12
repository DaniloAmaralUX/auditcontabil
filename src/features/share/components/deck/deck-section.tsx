// A cola do deck: eyebrow Fraunces + h2 + insight + data-reveal de graça.
// O próximo dev adiciona uma seção sem tocar em motion/a11y.
export function DeckSection({
  eyebrow,
  title,
  insight,
  id,
  children,
}: {
  eyebrow?: string
  title: string
  insight?: React.ReactNode
  id?: string
  children: React.ReactNode
}) {
  const h = id ? `${id}-title` : undefined
  return (
    <section aria-labelledby={h} data-reveal className='space-y-4'>
      <div className='space-y-1.5'>
        {eyebrow && <p className='deck-eyebrow'>{eyebrow}</p>}
        <h2 id={h} className='text-xl font-semibold tracking-tight sm:text-2xl'>
          {title}
        </h2>
        {insight && <p className='text-muted-foreground'>{insight}</p>}
      </div>
      {children}
    </section>
  )
}
