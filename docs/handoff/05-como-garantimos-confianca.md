# 05 — Como garantimos confiança no resultado

Este é o coração do produto. Um contador só usa uma ferramenta de auditoria se **confiar no número que ela entrega** — e assina embaixo. O AuditView constrói essa confiança por design, não por promessa.

## O princípio: a IA nunca é fonte de verdade contábil

Não há LLM no runtime do produto. Uma busca por `openai|anthropic|claude|gpt|llm` em `src/` não retorna nenhum uso no cálculo. Isso é uma **decisão de arquitetura explícita**, não uma lacuna:

> A IA foi usada para *construir* o produto (com Claude Code). O produto entrega confiança justamente por **não depender de IA no cálculo** — tudo é SQL determinístico versionado, reconciliado ao centavo, com trilha imutável e revisão humana.

A confiança é sustentada por **7 mecanismos verificáveis**.

## 1. Cálculo determinístico, reproduzível e versionado

Toda regra é SQL versionado sobre dados persistidos; reprocessar = reexecutar a mesma função. Cada `rule_result` guarda:

- `formula_snapshot` — a fórmula com os parâmetros já resolvidos;
- `values_snapshot` — as entradas usadas;
- `rule_version` — a versão da regra.

O contador vê a fórmula e os valores de cada achado e pode conferir a conta.
**Onde:** [`20260711000800_rule_functions_v1.sql`](../../supabase/migrations/20260711000800_rule_functions_v1.sql), [`20260711000400_pipeline_tables.sql`](../../supabase/migrations/20260711000400_pipeline_tables.sql).

## 2. Nenhuma linha é descartada em silêncio

`normalized_rows` preserva de **cada** linha: `original` (bruto) + `normalized` (tipado) + `status` + `message`. O enum `row_status` marca `invalid`/`duplicate` como **preservadas**. A constraint `msg_required` obriga uma mensagem sempre que `status <> 'ok'`. Verificável por contagem: `total = ok + coerced + invalid + duplicate`.
**Onde:** [`20260711000200_enums.sql`](../../supabase/migrations/20260711000200_enums.sql), [`20260711000400_pipeline_tables.sql`](../../supabase/migrations/20260711000400_pipeline_tables.sql).

## 3. Reconciliação ao centavo contra o próprio documento

O valor calculado é conferido com o total **declarado pela empresa no arquivo** (tolerância ±0,01); a prova entra na trilha como uma linha "Conferência com o documento". Os arquivos reais são **testes de aceitação**: o balancete tem de fechar em **R$ 232.696,03** e a DRE em PDF em **R$ 1.346.640,06**. Se um desses testes quebra, o produto está errando conta — **não se ajusta o teste**.
**Onde:** [`src/workers/extractors/to-normalized.ts`](../../src/workers/extractors/to-normalized.ts), [`balancete-csv.ts`](../../src/workers/extractors/balancete-csv.ts) (`reconcile()`), [`dre-pdf.ts`](../../src/workers/extractors/dre-pdf.ts) (`checks`).

## 4. Revisão humana obrigatória antes de publicar

A máquina de estados **só deixa aprovar** com zero itens `attention`/`divergence` em `pending`. No painel de revisão, a contadora vê a fórmula + os valores de cada achado e é **obrigada a justificar** (Justificada / Falso positivo + nota) para marcar como revisado — a constraint `review_note_required` reforça isso no banco. Ela decide item a item se o cliente vê (`hidden_from_client`).
**Onde:** [`20260711000900_rpcs.sql`](../../supabase/migrations/20260711000900_rpcs.sql) (`transition_audit`, `publish_audit`), [`src/features/audits/workspace/panels/`](../../src/features/audits/workspace/panels) (inconsistências/revisão).

## 5. Snapshot imutável + tamper-evidence

`publish_audit` congela um payload JSON e grava `payload_hash = sha256(payload)`. A tabela `published_snapshots` tem um trigger (`snapshots_immutable`) que **rejeita UPDATE/DELETE**. O payload publicado **exclui os itens ocultos** e só inclui `attention`/`divergence` visíveis.
**Onde:** [`20260711000900_rpcs.sql`](../../supabase/migrations/20260711000900_rpcs.sql), [`20260711000500_share_billing_tables.sql`](../../supabase/migrations/20260711000500_share_billing_tables.sql), [`20260712001300_analytics.sql`](../../supabase/migrations/20260712001300_analytics.sql).

## 6. Trilha de auditoria append-only

`audit_events` registra cada ação crítica (`file.registered`, `mapping.saved`, `rules.executed`, `audit.published`, `share.accessed`…) via `app.log_event`, com trigger `events_immutable`. Os metadados **nunca** contêm conteúdo de linhas, senhas ou tokens. A trilha nunca é apagada — nem em `purge_audit`.
**Onde:** [`20260711000600_audit_events.sql`](../../supabase/migrations/20260711000600_audit_events.sql).

## 7. Narrativa que nunca inventa cifra

As frases do deck do cliente saem de `insights.ts` — lógica **pura por thresholds**, uma única fonte para capa, seções e PDF. Sem `analytics`, o veredito decide apenas por contagem de `attention`, **jamais fabricando números**. O escritório fala em duas vozes: interna (técnica, com fórmula/origem/valores) e cliente (zero jargão, 3 rótulos: "Precisa de atenção / Está tudo certo / Informativo").
**Onde:** [`src/features/audits/analytics/insights.ts`](../../src/features/audits/analytics/insights.ts), [`src/features/share/components/public-report.tsx`](../../src/features/share/components/public-report.tsx).

## Segurança que sustenta a confiança

- **Autoridade específica > marca anônima.** O snapshot carrega o **nome do escritório** que publica, exibido na capa e no rodapé do deck ([`20260712002000_trust_telemetry.sql`](../../supabase/migrations/20260712002000_trust_telemetry.sql)).
- **RLS multi-tenant** por `escritorio_id`; o papel `anon` **não lê nenhuma tabela** — o link público só funciona via RPCs `SECURITY DEFINER` `redeem_share`/`get_shared_snapshot` (bcrypt + rate limit + snapshot imutável). ([`20260711000700_rls.sql`](../../supabase/migrations/20260711000700_rls.sql))
- **Servidor re-valida** shape/tipos/tamanhos em `ingest_rows` mesmo sendo o próprio usuário — um cliente malicioso só corrompe a própria auditoria, nunca o veredito das regras (server-side) nem outro tenant.
- **Testes de banco (pgTAP)** verificam isolamento de tenant, share e máquina de estados: [`supabase/tests/`](../../supabase/tests).

## Resumo

| Ameaça à confiança | Mecanismo que responde |
|---|---|
| "O número está certo?" | Cálculo determinístico versionado (1) + reconciliação ao centavo (3) |
| "Perderam dados no meio?" | Nenhuma linha descartada (2) |
| "Alguém aprovou sem olhar?" | Revisão humana obrigatória (4) |
| "Mexeram no relatório depois?" | Snapshot imutável + hash (5) |
| "Quem fez o quê?" | Trilha append-only (6) |
| "A ferramenta inventou uma cifra?" | Narrativa por threshold, nunca fabrica número (7) |
| "Um cliente vê dados de outro?" | RLS multi-tenant + anon sem acesso |

Detalhe das regras: [04 — Regras de negócio](04-regras-de-negocio.md). Arquitetura: [06 — Arquitetura técnica](06-arquitetura-tecnica.md).
