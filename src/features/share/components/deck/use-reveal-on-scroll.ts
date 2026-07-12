import { useLayoutEffect } from 'react'

/**
 * Revela cada [data-reveal] dentro do root ao entrar na viewport — UMA vez
 * (desconecta após revelar → nunca re-anima em scroll repetido).
 * No-op em prefers-reduced-motion ou sem IntersectionObserver → conteúdo
 * visível. useLayoutEffect arma o estado oculto antes do paint (sem flash).
 */
export function useRevealOnScroll(root: React.RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !('IntersectionObserver' in window)) return

    const targets = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'))
    targets.forEach((t) => t.setAttribute('data-armed', ''))

    const io = new IntersectionObserver(
      (entries, obs) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          e.target.setAttribute('data-revealed', '')
          obs.unobserve(e.target) // reveal-once
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.15 }
    )
    targets.forEach((t) => io.observe(t))
    return () => io.disconnect()
  }, [root])
}
