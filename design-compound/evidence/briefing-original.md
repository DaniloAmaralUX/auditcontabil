# Briefing original — AuditView (consolidado da sessão de 11–12/07/2026)

> Material BRUTO consolidado pelo maestro a partir da sessão de trabalho, a pedido do usuário ("use o contexto do projeto"). Fontes citadas por path. Registrado em 2026-07-12.

## Fontes primárias (no repo / na máquina do usuário)

- `docs/PRD.md` — PRD v2.0 completo (produto §1–7, backend Supabase §8, frontend §9, design §10, roadmap §11, verificação §12, apêndices)
- `docs/arquitetura-v1.html` — RF-001–068, matriz de permissões, user stories
- `docs/pesquisa-ux-financeiro.md` — deep research UX (Mobbin Finance+/Airtable)
- `C:\Users\PITANG\Downloads\Auditview PRD.pdf` — **Auditview PRD v1.1** (21 págs): nome do produto, VER-001–008, RF-001–063, RN-001–012, dashboards técnico e do cliente, fases 1–6, definição de pronto
- Exemplos reais do fluxo da contadora (Downloads): 2× XLSX `Analise_Gerencial_Despesas_Grupo_Jan2026*.xlsx` (workbook com 1 aba por empresa 0104–0119 + abas Dashboard/Consolidado/Detalhamento/Plano de Ação) e 5× PPTX de apresentação gerencial (sumário executivo, composição por grupo, rankings, 1 slide por empresa, recomendações)

## Fatos ditos pelo usuário (decisões dele, nesta sessão)

1. **Nome do produto: AuditView**; logo = ícone minimalista (substituiu a marca anterior "Espaço Ação").
2. **Prioridade nº 1**: "conseguir facilmente colocar esses arquivos, apertar um botão e esperar o resultado que será uma linda dashboard com uma ótima experiência do usuário que funcione como fim de auditoria e de apresentação ao mesmo tempo — aesthetic elegante e profissional, porque esse link pode ser compartilhado com o cliente do contador."
3. **Prioridade nº 2**: "fazer essa apresentação por CPF e CNPJ — a de um dono de várias empresas de uma vez" (grupo empresarial consolidado + por empresa).
4. Consumo da apresentação: **reunião ao vivo E link enviado, igualmente** (precisa funcionar conduzida e autoexplorada, inclusive mobile).
5. Lead/persona de priorização: **contador / dono de escritório de contabilidade / quem trabalha com finanças contábeis**.
6. Direção visual de produto: **Ramp** (mobbin ramp) — limpo, denso-arejado, profissional.
7. Deploy final: **https://auditcontabil.vercel.app** (Vercel, Git integration, repo DaniloAmaralUX/auditcontabil).

## Estado do produto (fato técnico, verificado)

- Em produção na Vercel; backend Supabase (projeto lgqexlhbpxfkzrsvbknz) com schema aplicado via SQL Editor; conta de teste `teste@espacoacao.app` / senha123 (owner).
- Stack: Vite + React 19 + TanStack Router/Query + Tailwind v4 + shadcn/ui + Zustand + RHF/Zod + vitest browser + Supabase + recharts + @react-pdf/renderer + SheetJS/Papaparse (worker) + tus.
- Fluxo completo funcionando: clientes → auditoria → import (multi-abas, 1 botão) → 8 regras SQL → revisão → aprovação → publicação → share com senha (/r/:token) → PDF.
- Em construção AGORA (Bloco 4 do plano de ajuste): aba **Dashboard** gerencial (recharts) + visão do cliente com gráficos + analytics no snapshot (migration `20260712001300_analytics.sql` escrita; aguardando Run no SQL Editor).

## Inferências do maestro (não confirmadas pelo usuário)

- O "momento uau" da primeira utilização é ver a planilha real virar o dashboard consolidado sem configurar nada (pergunta de brainstorm ficou aberta).
- O PPTX dela é o benchmark de conteúdo; o dashboard deve cobrir: KPIs executivos, composição por grupo, rankings de empresas, resultado por empresa com status gerencial, top contas, detalhe por empresa, evolução mensal.
- PDF continua relevante como artefato de arquivo, mas o link é o produto.
