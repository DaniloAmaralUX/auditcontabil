# AuditView — Guia para agentes

Aplicação Vite + React 19 + TS · Tailwind v4 + shadcn/ui (new-york) · Supabase.
SaaS PT-BR para contadores brasileiros. Deploy: merge em `main` → Vercel.

Documentação de handoff completa: [HANDOFF.md](HANDOFF.md) · direção de craft:
[docs/design/CRAFT.md](docs/design/CRAFT.md).

## Convenções essenciais

- **Idioma**: UI e microcopy sempre em PT-BR (sem misturar inglês); código,
  identificadores, paths e commits em inglês. `type Foo` fica em inglês; a
  string que o usuário lê fica em português.
- **Contraste**: usar `oklch()` e ajustar apenas L (regra do Jakub em
  `docs/design/CRAFT.md`). Nunca branco sobre laranja `--brand`.
- **Testes**: `pnpm test` (browser mode chromium, headless). NÃO usar
  `pnpm test run`. Os arquivos reais em `docs/fixtures/` são fixtures de
  aceitação — se o teste quebrou, a conta está errada, não o teste.
- **Push**: só com confirmação explícita do dono; commits podem ser feitos
  livremente.

## Agent skills

### Issue tracker

Issues e PRDs vivem como **GitHub issues** em
`DaniloAmaralUX/auditcontabil`. Skills que precisam do tracker (`to-tickets`,
`triage`, `to-spec`, `qa`) usam o `gh` CLI. Ver
[docs/agents/issue-tracker.md](docs/agents/issue-tracker.md).

### Domain docs

Single-context. Se existir, `CONTEXT.md` na raiz + `docs/adr/*` para
decisões. Ainda não temos glossário formal — a linguagem canônica está
no PRD (`docs/PRD.md`) e no `docs/design/CRAFT.md`. Ver
[docs/agents/domain.md](docs/agents/domain.md).
