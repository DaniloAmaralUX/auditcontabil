# Prompt de continuação — cole numa sessão NOVA do Claude Code

> Abra o Claude Code na pasta `C:\Users\PITANG\Desktop\AuditContabilidade\shadcn-admin-main` e cole o bloco abaixo como primeira mensagem.

---

Estou continuando o projeto **Plataforma de Auditoria Contábil Visual** (auditcontabil). Contexto completo:

**O que é:** SaaS para escritórios de contabilidade — upload de planilhas XLSX/CSV → mapeamento de colunas → processamento com regras determinísticas → revisão em equipe → publicação → compartilhamento com cliente final por link+senha. Piloto com 1 escritório (proprietária + contadores + analistas). Sem IA em cálculo contábil; nenhuma linha descartada silenciosamente; revisão humana obrigatória.

**Fonte da verdade:** `docs/PRD.md` NESTA PASTA (PRD v2.0 completo — produto §1–7, backend §8, frontend §9, design §10, roadmap §11, verificação §12, apêndices). Leia antes de qualquer código. Anexos: `docs/arquitetura-v1.html` (RF-001–068, matriz de permissões, user stories) e `docs/pesquisa-ux-financeiro.md` (padrões UX).

**Decisões já tomadas (não rediscutir — detalhes e justificativas no PRD):**
- Backend = Supabase (projeto `lgqexlhbpxfkzrsvbknz`, JÁ LINKADO — `supabase/config.toml` nesta pasta). Postgres + RLS multi-tenant por `escritorio_id` via app_metadata; Storage privado com upload TUS; Realtime para progresso.
- **Parse no browser (Web Worker SheetJS/Papaparse), regras determinísticas em SQL versionado no Postgres** (Edge Functions têm 2s de CPU — verificado nas docs; nunca postar arquivo em função).
- Share público `/r/:token`: RPC SECURITY DEFINER + bcrypt + rate limit em tabela + snapshot imutável.
- Stripe preparado (Checkout/Portal/webhook padrão `withSupabase({auth:'none'})`), piloto em trial de 90 dias sem cartão.
- Front = este repo (fork satnaing/shadcn-admin v2.2.1): remover Clerk/axios/demos, TanStack Router com workspace de abas via `?tab=` validado com `@tanstack/zod-adapter`. Hosting: Vercel (`auditcontabil.vercel.app`, deploy no merge para `main`). PDF: @react-pdf/renderer client-side.
- Custo-alvo: ~US$25/mês (Supabase Pro) + R$40/ano domínio.

**Estado atual:** repo conectado ao GitHub (`DaniloAmaralUX/auditcontabil`), supabase init+link feitos, NENHUMA migration ou código de domínio ainda — o próximo passo é a **Fase F1 do roadmap (§11 do PRD)**: migrations core + RLS base + Edge `invite-user` + seed do trial, e no front a remoção do Clerk/axios + auth Supabase + guard por perfil.

**Como trabalhar:** uso a esteira do plugin `design-compound` (instalado; se a sessão for em outra máquina: `/plugin marketplace add DaniloAmaralUX/eumesmo` + `/plugin install design-compound`, e o CE: `/plugin marketplace add EveryInc/compound-engineering-plugin` + `/plugin install compound-engineering`). Roteiro no Apêndice A do PRD:
1. Se `design-compound/` ainda não existe aqui: rode `/design-compound-setup` e no intake aponte `docs/PRD.md` + o repo.
2. Depois `/design-maestro` → "rodar etapa 1" e siga os gates. As fases F1–F6 do §11 são os slices da etapa 5; os aceites da tabela viram evidências de gate.
3. Dentro das etapas técnicas, use Context7 (`resolve-library-id`/`query-docs`) para docs na versão certa — **a fonte vence a memória**.
4. Anote fricções da esteira em `design-compound/evidence/friccoes.md`.

Alternativa direta (sem esteira): comece pela F1 do §11 seguindo §8.7 (migrations) e §9.7 (front), com `pnpm lint + test` e `supabase test db` verdes antes de cada commit.

**Gotchas do ambiente:** Windows 11; pnpm; `supabase login` é interativo (rodar no terminal do usuário) ou `SUPABASE_ACCESS_TOKEN`; a senha do banco só é necessária em `supabase db push` (usuário digita no próprio terminal); commits semânticos; push só após confirmar comigo.
