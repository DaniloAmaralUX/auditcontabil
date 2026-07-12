# Plano final — AuditView engole os arquivos reais e entrega o deck "O Fechamento"

## Contexto

A contadora real (Janaina, CRC-PB) exporta da plataforma contábil dela DOIS
formatos, ambos fornecidos e diagnosticados:
- **CSV Balancete Societário** (`Relatorios_..._Debito_Credito (1).csv`):
  0089 MATERIAIS MDW LTDA, 2025. CP1252, paginado (cabeçalho repetido a cada
  página), separador `;`, 2 colunas de indentação em branco, `Conta;S;
  Classificação;Saldo Ant.;Débito;Crédito;Saldo`, flag `S`=sintética (pai),
  código+nome colados (`1.1.01.002.001   Banco Sicredi`), negativos em
  parênteses, SEM coluna de data (período no cabeçalho), grupos 1=Ativo,
  2=Passivo/PL, 3=DRE.
- **PDF DRE do Exercício** (`250416105004s2LDy.pdf`): 0086 CENTRO DE EDUCACAO
  MDW LTDA, 2024. Vetorial (não escaneado), 4 páginas, hierarquia por
  INDENTAÇÃO (posição X), grupos nomeados (PESSOAL, GERAIS, PROPAGANDA,
  OCUPAÇÃO, UTILIDADES, DEPRECIAÇÕES, FINANCEIRAS, TRIBUTÁRIAS), negativos em
  parênteses com `)` em token separado, totais declarados: receita bruta
  7.537.018,64 → deduções (1.439.538,32) → (=) LUCRO LIQUIDO 1.346.640,06.

Hoje o produto NÃO abre nenhum dos dois (Papaparse header:true pega lixo;
PDF nem é aceito). O core do produto é: documento contábil real → auditoria →
linda apresentação. Requisito inegociável do usuário: **zero erro nos cálculos
que alimentam os charts**.

## Regra de ouro: reconciliação (zero erro de cálculo)

Os arquivos TRAZEM os próprios totais (sintéticas no CSV; linhas de grupo e
LUCRO LÍQUIDO no PDF). Regra determinística em 3 camadas:
1. **Só analíticas entram nos agregados** (CSV: sem flag `S`; PDF: nível de
   indentação mais profundo). Sintéticas/grupos são preservadas como
   `kind='other'` (nada descartado silenciosamente).
2. **Reconciliar**: Σ(analíticas de um pai) DEVE bater com o valor declarado
   do pai (tolerância 0,01). O resultado calculado DEVE bater com o
   RESULTADO/LUCRO declarado no arquivo.
3. **Divergência vira inconsistência visível** (regra nova R-RECON no fluxo
   existente de rule_results), nunca erro silencioso. Se bate: o deck exibe o
   selo "Conferido com o documento: os totais batem ao centavo".

Convenção de sinal (DRE): receita/dedução têm saldo credor; despesa devedor.
Valor da linha = |Saldo| do arquivo; o `kind` dá o papel na equação:
`resultado = receita_bruta − deduções − despesas` (validado contra o arquivo;
no CSV MDW: 3 RESULTADO DO PERÍODO = (232.696,03) credor ⇒ LUCRO de
232.696,03 — sinal contábil invertido documentado no parser).

## Pipeline de ingestão (worker)

Novo módulo puro `src/workers/extractors/` (padrão onboarding-logic):
- `encoding.ts` — detectar CP1252 vs UTF-8 (heurística de bytes 0x80-0x9F +
  falha de decode) e transcodificar com TextDecoder('windows-1252').
- `balancete-csv.ts` — pré-processador ANTES do Papaparse: acha a linha de
  cabeçalho real (`Conta;S;Classificação`), remove boilerplate/cabeçalhos de
  página repetidos/linhas de indentação vazias/assinaturas; extrai metadados
  do cabeçalho (razão social, CNPJ, período "01/01/2025 a 31/12/2025");
  split código+nome; marca sintética pela flag `S` E valida pela profundidade
  do código; emite linhas normalizadas (uma empresa por arquivo).
- `dre-pdf.ts` — pdfjs-dist (getTextContent) por página: agrupa tokens por Y
  (linha) e usa X para separar rótulo × valor × `)`; nível de hierarquia pela
  indentação (X do primeiro token); folha = linha sem filhos abaixo com X
  maior; negativos por parênteses; metadados do cabeçalho; RECONCILIA com os
  totais de grupo e o LUCRO LÍQUIDO declarado. Risco anotado: PDF escaneado
  (sem texto) → erro humano "Este PDF é uma imagem — exporte como CSV".
- `detect.ts` — identifica o tipo (balancete-csv | dre-pdf | gerencial-xlsx |
  csv simples) pela assinatura do conteúdo, não pela extensão.
- `parse.worker.ts` passa a rotear: PREVIEW devolve também `meta` (tipo
  detectado, empresa, CNPJ, período, totais declarados) e o import aplica
  preset de mapping automático (usuário não vê mapping quando o preset cola).

Classificação por CÓDIGO (mais forte que nome), espelhada em worker + SQL
(migration 7 `docs/deploy/7-classificacao-codigo.sql`):
- `3.1*` revenue · `3.1.03*`/nome com "(-)" deduction · `3.2*` expense
  (categoria "Custo das mercadorias") · `3.7*` expense com categoria por
  subgrupo: `3.7.03.001` Pessoal · `3.7.03.009` Depreciações · `3.7.03.011`
  Utilidades · `3.7.03.015` Gerais · `3.7.05/propaganda` Comercial ·
  `3.7.09` Tributárias · `3.7.11` Financeiras. Grupos 1/2 (balanço) →
  `kind='other'` (fora da DRE, preservados). PDF DRE: categoria = nome do
  grupo pai (já vem nomeado). Fallback: heurística por nome atual.

## Import UX (preview falante, zero clique)

- Preview: "**Balancete Societário** · MATERIAIS MDW LTDA · CNPJ 48.386... ·
  Período 01/01/2025–31/12/2025 · 312 contas (89 analíticas) · Resultado
  declarado R$ 232.696,03" — antes de qualquer mapping.
- Preset colou → botão "Gerar dashboard" ativo direto; mapping avançado
  continua no collapsible para arquivos fora do padrão.
- Falha honesta: "Parece um balancete, mas o cabeçalho difere do que
  conhecemos — ajuste o mapeamento" com o painel aberto.
- `accept` do dropzone ganha `.pdf`; PDF grande roda no worker sem travar.

## Deck "O Fechamento" (specs dos 3 agentes de design, já detalhados)

- **Tokens** (OKLCH, contrastes medidos): Papel/Tinta/Brasa/Receita(+text)/
  Despesa/Névoa(+text) light+dark; Fraunces (opsz) via Google Fonts no
  index.html; utilities `.leader-dots`, `.bottom-rule`, `.deck-eyebrow`,
  `.result-figure` (spec do agente 1, pronto para colar).
- **IncomeStatement**: `<table>` semântica com leader dots, régua-brasa antes
  do RESULTADO (Fraunces opsz 144), sinais `+/−` + parênteses contábeis +
  tag Superávit/Déficit (nunca só cor), rodapé D/R% e margem. + o selo de
  reconciliação ("Conferido com o documento ✓").
- **Narrativa por seção** (agente 2): capa com VEREDITO em ladder de
  severidade → DRE → composição (donut c/ total no centro) → empresas
  (ranking + divergente; ocultos p/ 1 empresa) → top contas (bar horizontal)
  → evolução (area gradient; oculto p/ 1 competência) → atenção → conclusão.
  Insights dinâmicos por thresholds em `analytics/insights.ts` puro,
  compartilhado com capa e PDF de saída.
- **Arquitetura/motion/a11y** (agente 3): charts.tsx → pasta `charts/` com
  barrel (zero churn nos consumidores); `statement.ts` + `insights.ts` puros
  e testados; `DeckSection` wrapper (eyebrow/h2/insight/data-reveal);
  `useRevealOnScroll` reveal-once via IntersectionObserver (450ms --ease-out,
  no-op em reduced-motion); h1 único + h2 por seção; bar charts `aria-hidden`
  com CompanyTable como equivalente; 375px→desktop regras definidas.
- PDF de saída (download): veredito + mini-DRE textual + hex de contraste
  fixos (≥4.5:1 sobre branco).

## Dashboard interno

Herda os mesmos gráficos; degradação: 1 empresa esconde comparativos
(guards já existem), 1 competência esconde evolução com nota "A evolução
aparece a partir de 2 competências". KPIs e DRE sempre presentes.

## Testes e E2E (os arquivos reais são as fixtures)

- Copiar os 2 arquivos para `docs/fixtures/` (balancete-mdw-2025.csv,
  dre-educacao-2024.pdf).
- Unit (vitest): encoding, pré-processador CSV (linhas/página/split/flag S),
  extrator PDF (linhas por Y, indentação, parênteses), classificação por
  código, reconciliação (Σ filhos = pai; resultado = declarado), statement/
  insights/verdict, report-format.
- **Prova dos números (aceitação)**: CSV → receita_bruta 1.046.954,21;
  deduções 57.390,26 (+ outras receitas 26.142,40); CMV 683.880,78; despesas
  operacionais 99.861,11; resultado ≡ 232.696,03 declarado. PDF → receita
  7.537.018,64; deduções 1.439.538,32; lucro ≡ 1.346.640,06 declarado.
- E2E prod: importar os DOIS arquivos em auditorias reais → dashboard e deck
  com os números conferidos → publicar → link.
- Gates sempre: tsc · eslint · knip · vitest.

## Entrega final da sessão

- Conta ativa teste@espacoacao.app / senha123 + link de produção + roteiro
  de 1ª auditoria para a Janaina (importar o balancete dela).
- HANDOFF.md + CRAFT.md atualizados (formatos suportados, regra de
  reconciliação, direção do deck); commit/push main → Vercel.
- Esteira design-compound: evidências + avanço de etapa.

## Ordem de execução

1. Fixtures reais copiadas + extractors (encoding → balancete-csv → detect)
   com unit tests batendo os números do CSV.
2. dre-pdf.ts (pdfjs) + tests batendo os números do PDF.
3. Migration 7 (classificação por código) — 1 Run no SQL Editor (usuário).
4. Reconciliação (R-RECON) + selo no deck/dashboard.
5. Import UX (preview falante + presets + accept .pdf).
6. Deck "O Fechamento" completo (tokens, DRE, insights, reveal, Fraunces).
7. Dashboard degradação + PDF de saída alinhado.
8. E2E prod com os 2 arquivos reais + gates + deploy.
9. Handoff (HANDOFF/CRAFT/esteira/memória) + link + roteiro da Janaina.
