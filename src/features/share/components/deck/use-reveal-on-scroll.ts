import { useLayoutEffect } from 'react'

/**
 * Revela cada [data-reveal] dentro do root ao entrar na viewport — UMA vez
 * (desconecta após revelar → nunca re-anima em scroll repetido).
 *
 * À prova de falha, porque conteúdo invisível é o pior bug possível:
 * - o que já está na dobra revela IMEDIATAMENTE (sem depender do observer);
 * - se o IntersectionObserver nunca disparar (ambiente quebrado/embedado),
 *   um fallback de 1,2s revela tudo;
 * - no-op em prefers-reduced-motion ou sem IO → conteúdo visível.
 * useLayoutEffect arma o estado oculto antes do paint (sem flash).
 */
export function useRevealOnScroll(root: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !('IntersectionObserver' in window)) return

    const targets = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'))
    const reveal = (t: Element) => t.setAttribute('data-revealed', '')

    // Acima da dobra: revela já (a animação roda no primeiro frame).
    const fold = window.innerHeight * 0.92
    const below: HTMLElement[] = []
    for (const t of targets) {
      t.setAttribute('data-armed', '')
      if (t.getBoundingClientRect().top < fold) reveal(t)
      else below.push(t)
    }
    if (below.length === 0) return

    let fired = false
    const io = new IntersectionObserver(
      (entries, obs) => {
        fired = true
        for (const e of entries) {
          if (!e.isIntersecting) continue
          reveal(e.target)
          obs.unobserve(e.target) // reveal-once
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.15 }
    )
    below.forEach((t) => io.observe(t))
    // Observer mudo (ambiente sem rendering loop) → nada fica invisível.
    const safety = window.setTimeout(() => {
      if (!fired) {
        below.forEach(reveal)
        io.disconnect()
      }
    }, 1200)
    return () => {
      window.clearTimeout(safety)
      io.disconnect()
    }
  }, [root])
}
