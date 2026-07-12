# Changelog — AuditView

Todas as mudanças relevantes do produto. O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/); as datas estão em ISO (AAAA-MM-DD).

> Histórico anterior ao AuditView (template base `satnaing/shadcn-admin`, v1.0.0-beta → v2.2.1) foi removido deste changelog. A atribuição ao template permanece no [`LICENSE`](LICENSE).

## [0.1.0] — 2026-07-12 · v0 oficial

Primeira versão utilizável ponta a ponta, com arquivos reais da contadora e o deck "O Fechamento".

### Adicionado

- **Pipeline de 1 botão**: upload resumável (TUS) → parse no Web Worker → normalização pt-BR → ingestão idempotente → execução de regras no banco.
- **8 regras de auditoria determinísticas** (R001–R008) como funções SQL versionadas, cada resultado gravando fórmula + valores + versão.
- **Extractors de arquivos reais**: balancete societário CSV (CP1252) e DRE em PDF vetorial, com **reconciliação ao centavo** contra o total declarado no documento.
- **Classificação determinística por código contábil** (plano de contas BR) e R001/R002 cientes de documento extraído (migração 7).
- **Dashboard gerencial** (Recharts) e **analytics 100% SQL** via RPC `get_audit_analytics`.
- **Deck do cliente "O Fechamento"** em `/r/:token`: password gate (bcrypt), snapshot imutável, DRE tipografada, PDF client-side.
- **Segurança**: RLS multi-tenant por escritório; `anon` sem acesso a tabelas; share por token + senha com rate limit; trilha de auditoria append-only.
- **Equipe, clientes, billing (trial 90 dias)** e máquina de estados da auditoria.
- **Suíte de testes**: Vitest (browser mode) + pgTAP + e2e de produção; fixtures reais como testes de aceitação.

### Pendências conhecidas

- Migração 7 (`docs/deploy/7-classificacao-codigo.sql`) aguardando 1 aplicação em produção.
- Edge Functions (convite por e-mail + Stripe) escritas mas não deployadas.
- Reconciliar alvo de deploy na documentação (produção real = Vercel).

Veja o detalhamento em [`docs/handoff/07-rodando-e-deployando.md`](docs/handoff/07-rodando-e-deployando.md).
