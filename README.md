# AuditView

> **Auditoria contábil visual para escritórios de contabilidade.** A contadora sobe a planilha do cliente, aperta **um botão**, e nasce um dashboard gerencial que é auditoria e apresentação ao mesmo tempo — compartilhável com o cliente final por link protegido por senha.

- **Produção:** https://auditcontabil.vercel.app
- **Painel de progresso:** https://auditcontabil.vercel.app/progresso/index.html
- **Documentação completa:** [`docs/README.md`](docs/README.md) · **Handoff de 10 min:** [`HANDOFF.md`](HANDOFF.md)

---

## O que é

Escritórios de contabilidade recebem arquivos imperfeitos dos clientes (XLSX, CSV, PDF) e gastam horas conferindo, consolidando, achando divergências, montando gráficos e explicando o resultado. O **AuditView** transforma esse trabalho manual numa **auditoria visual, revisável, versionada e compartilhável**:

1. A contadora sobe o arquivo que já exporta do sistema contábil.
2. O produto normaliza os dados, roda **8 regras de auditoria determinísticas** e monta um dashboard gerencial.
3. A equipe revisa cada achado (justifica ou marca falso positivo) e escreve a conclusão.
4. A proprietária aprova e publica um **snapshot imutável**.
5. O cliente final acessa uma apresentação editorial ("O Fechamento") por **link + senha**, sem criar conta.

**Fronteiras (o que o produto não faz):** não substitui o contador, não faz cálculo fiscal avançado, e **a IA nunca é fonte de verdade contábil** — todo cálculo é SQL determinístico e versionado, reconciliado ao centavo contra o próprio documento.

Por que confiar no resultado? Veja [`docs/handoff/05-como-garantimos-confianca.md`](docs/handoff/05-como-garantimos-confianca.md).

## Rodar localmente

```bash
pnpm install
cp .env.example .env   # cole a anon key (Supabase → Settings → API); a URL já vem preenchida
pnpm dev               # http://localhost:5173
```

Teste com os arquivos reais em [`docs/fixtures/`](docs/fixtures) — `balancete-mdw-2025.csv` (balancete societário, CP1252, detectado e mapeado sozinho) e `dre-educacao-2024.pdf` (DRE em PDF). Setup completo (banco, deploy) em [`docs/handoff/07-rodando-e-deployando.md`](docs/handoff/07-rodando-e-deployando.md).

## Stack

| Camada | Tecnologia |
|---|---|
| Front | React 19 · Vite 8 · TanStack Router/Query/Table · Zustand · TypeScript |
| UI | shadcn/ui (Radix) · Tailwind v4 · Recharts · tema Firecrawl |
| Processamento | Web Worker + SheetJS (XLSX) · PapaParse (CSV) · pdf.js (PDF) — parse no browser |
| Backend | Supabase — Postgres + RLS + Storage + Edge Functions + Realtime |
| Saídas | Dashboard (Recharts) · Deck público `/r/:token` · PDF client-side (`@react-pdf/renderer`) |
| Qualidade | ESLint · Prettier · knip · Vitest (browser mode) · pgTAP |

Decisão central de arquitetura: **parse no browser, regras no banco**. Detalhes em [`docs/handoff/06-arquitetura-tecnica.md`](docs/handoff/06-arquitetura-tecnica.md).

## Estrutura

```
docs/            documentação (handoff, PRD, runbook, design, fixtures reais)
src/
├─ routes/       TanStack Router file-based (guardas de auth + /r/:token público)
├─ features/     código por domínio (audits, share, clients, team, billing, ...)
├─ workers/      parse no browser + extractors (balancete CSV, DRE PDF)
├─ components/   layout + ui (shadcn)
├─ lib/          supabase, permissions, strings (textos PT-BR)
└─ styles/       theme.css (tokens do tema)
supabase/        migrations (a verdade do backend) · functions (Edge) · tests (pgTAP)
scripts/         e2e de produção, geradores de fixture
public/          painel de progresso, assets
```

## Documentação

Comece por [`docs/README.md`](docs/README.md) — o índice mestre. Destaques:

- **O que o produto faz** → [`docs/handoff/01-o-que-o-produto-faz.md`](docs/handoff/01-o-que-o-produto-faz.md)
- **Histórias de usuário** → [`docs/handoff/02-historias-de-usuario.md`](docs/handoff/02-historias-de-usuario.md)
- **Fluxos de usuário** → [`docs/handoff/03-fluxos-de-usuario.md`](docs/handoff/03-fluxos-de-usuario.md)
- **Regras de negócio** → [`docs/handoff/04-regras-de-negocio.md`](docs/handoff/04-regras-de-negocio.md)
- **Como garantimos confiança** → [`docs/handoff/05-como-garantimos-confianca.md`](docs/handoff/05-como-garantimos-confianca.md)
- **Referência profunda** → [`docs/PRD.md`](docs/PRD.md) · [`docs/RUNBOOK-DEPLOY.md`](docs/RUNBOOK-DEPLOY.md) · [`docs/design/CRAFT.md`](docs/design/CRAFT.md)

## Contribuindo

Antes de todo commit: `pnpm lint && pnpm knip && pnpm test`. Padrões e fluxo de PR em [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md). Deploy é automático no merge para `main` (Vercel).

## Licença

Licenciado sob a [MIT License](LICENSE). O produto foi construído sobre o template [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) (também MIT) — a atribuição ao autor original é preservada no arquivo [`LICENSE`](LICENSE), conforme exige a licença. Direção visual, personas de craft e créditos em [`docs/design/CRAFT.md`](docs/design/CRAFT.md).
