# 04 — Regras de negócio

A lógica de domínio vive em **duas camadas deliberadamente separadas**:

- **Extração / normalização** — roda no browser (Web Worker), em [`src/workers/extractors/`](../../src/workers/extractors).
- **Regras de auditoria** — rodam no banco, versionadas em SQL, em [`supabase/migrations/`](../../supabase/migrations).

Motivo da separação: parse de arquivos de 20 MB é inviável no limite de CPU das Edge Functions; e as regras precisam rodar server-side para serem **confiáveis e auditáveis** (o cliente não pode influenciar o veredito). Ver [06 — Arquitetura técnica](06-arquitetura-tecnica.md).

## As 8 regras de auditoria

Vivem como funções `app.rule_*_v1` em [`supabase/migrations/20260711000800_rule_functions_v1.sql`](../../supabase/migrations/20260711000800_rule_functions_v1.sql). Cada resultado grava **fórmula + valores + versão** (`rule_results.formula_snapshot`, `values_snapshot`, `rule_version`).

| Código | Nome | O que verifica | Severidade |
|---|---|---|---|
| **R001** | `DEBIT_CREDIT` | Σ débito = Σ crédito por período (dentro da tolerância) | divergence |
| **R002** | `BALANCE_EQUATION` | saldo inicial + débitos − créditos = saldo final, por conta | divergence |
| **R003** | `REQUIRED_FIELDS` | campos obrigatórios ausentes (linhas `status = 'invalid'`) | divergence |
| **R004** | `INVALID_FORMAT` | valores coagidos na leitura (linhas `status = 'coerced'`) | info |
| **R005** | `PERIOD_VARIATION` | variação atípica entre períodos por conta (LAG, threshold % — default 30) | attention |
| **R006** | `NEW_ACCOUNT` | conta presente no período N e ausente em N-1 | info |
| **R007** | `UNUSUAL_VALUE` | \|valor − média\| > k·desvio por conta (k — default 3) | attention |
| **R008** | `DUPLICATE_ROW` | linha duplicada (marcada na ingestão, **nunca excluída**) | attention |

Severidades (enum `severity` em [`20260711000200_enums.sql`](../../supabase/migrations/20260711000200_enums.sql)): `ok` · `info` · `attention` · `divergence`.

### Detalhes que importam

- **Nunca dá "OK" indevido.** Se não há dados aplicáveis, a regra grava severidade `info` "Não executada" em vez de fingir aprovação.
- **Versionamento imutável.** Mudou uma regra? Cria-se `app.rule_*_v2` + nova linha em `rules`. A v1 continua rastreável para sempre. **Nunca se edita a v1.**
- **Parâmetros por escritório.** Tolerâncias e thresholds (ex.: variação de 30%, k de desvio) vivem em `rules.params` ([`20260711000400_pipeline_tables.sql`](../../supabase/migrations/20260711000400_pipeline_tables.sql)) — cada escritório pode calibrar.
- **Regras cientes de documento extraído.** R001/R002 **pulam** linhas de balancete/DRE (identificadas por `normalized->>'origem'`), porque nesses relatórios de posição os campos débito/crédito carregam a convenção de agregação (|saldo| na natureza da conta), não partidas dobradas — rodá-las geraria falso alarme. Isso é a **migração 7** ([`20260712150000_classificacao_codigo.sql`](../../supabase/migrations/20260712150000_classificacao_codigo.sql)), ainda **pendente de 1 aplicação em produção** (ver [07 — Rodando e deployando](07-rodando-e-deployando.md)).

## Extração e normalização (browser)

- **`balancete-csv.ts`** — lê o balancete societário CSV real (CP1252, separador `;`, código+nome colados, flag `S` de conta sintética, negativos em parênteses). A função `reconcile()` soma os filhos diretos de cada conta sintética e confere com o saldo declarado no próprio documento (tolerância ±0,01).
- **`dre-pdf.ts`** — extrai a DRE de PDF vetorial reconstruindo a hierarquia por indentação (posição X), com pilha de ancestrais que persiste entre páginas; gera `checks` de reconciliação pai × soma-dos-filhos.
- **`classify.ts`** — **classificação determinística por código contábil** do plano de contas BR: `1|2` = balanço, `3.1` = receita, `3.1.03` = dedução, `3.2` = CMV, `3.7` = despesa (subgrupos → categoria: Pessoal, Financeiras, Tributárias…). Fallback textual por nome.
- **`to-normalized.ts`** — converte a extração para o formato do pipeline e **acrescenta uma linha "Conferência com o documento"** que registra na trilha se os números batem ao centavo. É o "selo" de reconciliação.

Encoding legado (CP1252) tratado em [`encoding.ts`](../../src/workers/extractors/encoding.ts); detecção do tipo de documento em [`detect.ts`](../../src/workers/extractors/detect.ts).

## Agregação gerencial (100% SQL determinística)

`app.audit_analytics` ([`20260712001300_analytics.sql`](../../supabase/migrations/20260712001300_analytics.sql), RPC `get_audit_analytics`) calcula: consolidado (receita bruta, deduções, receita líquida, despesas, resultado, margem), por grupo, por empresa (status Superavitária / Deficitária / Crítica), top contas e evolução mensal. É o núcleo do dashboard **e** do deck. `publish_audit` congela esse JSON no snapshot.

## Invariantes de domínio (nunca violar)

1. **Nenhuma linha descartada em silêncio** — `normalized_rows` preserva `original` + `normalized` + `status` + `message` de cada linha; `invalid`/`duplicate` são **preservadas**, nunca apagadas. Constraint `msg_required` obriga mensagem quando `status <> 'ok'`.
2. **Cálculo determinístico e reproduzível** — reprocessar = reexecutar a mesma função sobre os mesmos dados; fórmula + valores + versão gravados por resultado.
3. **Revisão humana obrigatória** — não se aprova com pendências (`attention`/`divergence` em `pending`).
4. **A IA nunca calcula contabilidade** — não há LLM no runtime.

Por que essas invariantes tornam o resultado confiável: [05 — Como garantimos confiança](05-como-garantimos-confianca.md). Vocabulário contábil: [09 — Glossário](09-glossario.md).
