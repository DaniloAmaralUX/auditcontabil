# 09 — Glossário

Vocabulário para quem não é da contabilidade entender o domínio, e para o time usar termos consistentes. Divide-se em termos **contábeis** (do negócio) e termos **do produto** (entidades e conceitos do sistema).

## Termos contábeis

- **Balancete (societário)** — relatório que lista todas as contas com seus saldos em um período. É o principal insumo do produto (arquivo CSV real: `balancete-mdw-2025.csv`).
- **DRE (Demonstração do Resultado do Exercício)** — relatório que mostra receitas, deduções, custos e despesas até chegar ao lucro/prejuízo do período (arquivo real: `dre-educacao-2024.pdf`).
- **Fechamento** — o encerramento contábil de um período (mês/ano); o resultado consolidado que a contadora apresenta ao cliente. Dá nome ao deck do cliente, **"O Fechamento"**.
- **Competência / período** — o intervalo contábil a que os dados se referem (ex.: 01/01/2025–31/12/2025).
- **Conta** — item do plano de contas. Identificada por **código** (ex.: `3.1.03`) + nome.
- **Conta sintética** — conta "pai" que agrega as filhas (marcada com flag `S` no balancete). Seu saldo deve ser igual à soma das analíticas abaixo dela.
- **Conta analítica** — conta "folha", que recebe lançamentos diretamente.
- **Plano de contas** — a árvore hierárquica de contas. No Brasil, o primeiro dígito indica o grupo: `1|2` = balanço patrimonial, `3` = resultado (receitas/despesas). A classificação por código está em [`src/workers/extractors/classify.ts`](../../src/workers/extractors/classify.ts).
- **Débito / crédito** — os dois lados de um lançamento (partidas dobradas). Em um balancete de posição, porém, esses campos carregam a convenção de agregação (|saldo| na natureza da conta), não partidas — por isso R001/R002 os ignoram nesses documentos (ver [04](04-regras-de-negocio.md)).
- **Saldo inicial / saldo final** — o valor da conta no começo e no fim do período. Regra R002: saldo inicial + débitos − créditos = saldo final.
- **Receita bruta** — total de vendas/serviços antes de deduções.
- **Deduções** — impostos sobre venda, devoluções, descontos incondicionais (subtraídos da receita bruta).
- **Receita líquida** — receita bruta − deduções.
- **CMV (Custo da Mercadoria Vendida)** — custo direto do que foi vendido.
- **Despesa** — gastos operacionais (Pessoal, Financeiras, Tributárias…), classificados por subgrupo.
- **Resultado** — lucro ou prejuízo do período (receita líquida − custos − despesas).
- **Margem** — resultado como percentual da receita.
- **Reconciliação** — conferir se um valor calculado bate com o valor declarado no documento. No produto, é feita **ao centavo** (±0,01) e vira a linha "Conferência com o documento".

## Termos do produto

- **Escritório (`escritorios`)** — o tenant. Toda a segurança multi-tenant é por `escritorio_id`.
- **Cliente (`clientes`)** — a empresa (PJ) auditada pelo escritório. (Não confundir com o "cliente final" que acessa o deck — que é uma pessoa do lado da empresa cliente.)
- **Auditoria (`audits`)** — a unidade de trabalho: um cliente + um período, que passa pela máquina de estados até ser publicada.
- **Mapeamento (`mappings`)** — o mapa de colunas do arquivo → campos internos, reutilizável por cliente.
- **Linha normalizada (`normalized_rows`)** — cada linha do arquivo, preservada com `original` + `normalized` + `status` + `message`. **Nunca é descartada.**
- **Regra (`rules`) / resultado (`rule_results`)** — as 8 verificações de auditoria (versionadas) e seus achados (com fórmula/valores/versão).
- **Severidade** — classificação do achado: `ok` · `info` · `attention` · `divergence`.
- **Snapshot (`published_snapshots`)** — o payload JSON congelado e imutável da auditoria publicada, com `payload_hash`.
- **Share (`shares`)** — o compartilhamento: token + senha (hasheados), validade, permissão de download.
- **Trilha de auditoria (`audit_events`)** — o log append-only e imutável de ações críticas.
- **Deck "O Fechamento"** — a apresentação editorial do cliente final, servida em `/r/:token`.
- **Pipeline de 1 botão** — a orquestração hashing → upload → registro → mapeamento → ingestão → finalização → regras.

Conceitos relacionados no código: [`src/features/audits/analytics/types.ts`](../../src/features/audits/analytics/types.ts), [`src/workers/parse-protocol.ts`](../../src/workers/parse-protocol.ts).
