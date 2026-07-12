# CRAFT.md — Design Engineering Standards do AuditView

> Assinado pelos design engineers do projeto:
> **Jakub** (superfícies & detalhes — persona de [Jakub Krehel](https://jakub.kr),
> skill `make-interfaces-feel-better`) e **Emil** (motion & taste — persona de
> [Emil Kowalski](https://emilkowal.ski), autor do Sonner que roda nos nossos
> toasts). Régua de qualidade da auditoria: framework
> [ui-audit](https://github.com/tommygeoco/ui-audit) de Tommy Geoco.
>
> Vale para humanos E agentes. PR que viola uma régua não passa.
> Os revisores vivem em `.claude/agents/jakub.md` e `.claude/agents/emil.md`.

## Identidade visual — Firecrawl

- Um só acento: **laranja `#E97318`** → `--brand`/`--primary`
  (`oklch(0.69 0.17 48)`). Texto **escuro** sobre o laranja (6,9:1) — branco
  não passa de 3,1:1 e é proibido.
- Neutros quentes: papel `oklch(0.988 0.0035 85)` no claro; `#1e1e1e/#252526`
  no escuro. Tema único (claro padrão + dark) — sem seletor de temas extras.
- Cor SEMPRE em OKLCH. Texto pequeno colorido usa `--success-text` /
  `--warning-text` (≥4.5:1 no claro; alias no escuro).

## Superfícies · Jakub

1. **Raio concêntrico**: externo = interno + padding (`--radius` 0.625rem;
   ex.: TabsTrigger = `calc(var(--radius) - 3px)` dentro do TabsList `p-0.75`).
2. **Sombras compostas** com anel `0 0 0 1px oklch(0 0 0 / 4%)` de 1ª camada
   (`--shadow-soft`/`--shadow-lift`) — nunca borda dura para profundidade.
3. **Tipografia**: `tabular-nums` em número dinâmico; `text-wrap: balance`
   em h1–h3, `pretty` em parágrafo (global no index.css); antialiased no root.
4. **Hit areas**: 44px em touch (`pointer-coarse:min-h-11` no button/select);
   ≥40px em desktop denso quando possível.
5. **Nunca `transition: all`** — só propriedades explícitas.
6. Ícones assimétricos: alinhar opticamente, não geometricamente.

## Motion · Emil

Tokens: `--dur-fast: 140ms` · `--dur-base: 200ms` · `--dur-slow: 300ms` ·
`--ease-out: cubic-bezier(0.25, 1, 0.5, 1)`.

1. **UI ≤300ms**, sempre `--ease-out`. Nunca ease-in.
2. **Alta frequência NÃO anima**: troca de aba do workspace, ações de teclado,
   toggles diários. O dashboard interno abre instantâneo.
3. **Momento raro pode ser rico**: o relatório público (`/r/:token`) usa
   `animate-rise-stagger` (opacity + blur(4px) + translateY, 80ms entre blocos)
   — é apresentação, não ferramenta.
4. **Press**: `scale(0.96)` no `:active` (nunca <0.95).
5. Nunca partir de `scale(0)` — mínimo 0.93.
6. Só `transform`/`opacity` (60fps); `will-change` raríssimo.
7. `transform-origin` no gatilho (vars do Radix nos menus).
8. `prefers-reduced-motion` zera tudo (já global).
9. Na dúvida: **a melhor animação é nenhuma**.

## Processo

- Menor diff que resolve ("less is more"). Antes de construir: *should we
  build this?*
- Revisão em tabela **Before/After** por princípio (formato da skill).
- Auditoria de qualidade: 8 dimensões do ui-audit com verificação adversarial
  (workflow `ui-audit-10`); meta permanente = zero fail/warn confirmado.
- Acessibilidade não negocia: contraste 4.5:1, foco visível, aria em erro e
  status, equivalente textual para gráficos (tabela sr-only), skip link.
