# Documentação do AuditView

Índice mestre. **AuditView** é um SaaS de auditoria contábil visual para escritórios de contabilidade — sobe a planilha, aperta um botão, nasce um dashboard que é auditoria e apresentação, compartilhável com o cliente por link + senha.

## Comece por aqui

- 🚀 **[`HANDOFF.md`](../HANDOFF.md)** — mapa técnico de 10 minutos (rode em 3 comandos, onde mexer por papel).
- 🧭 **[Pacote de handoff](#pacote-de-handoff)** abaixo — a documentação organizada por tema, em PT-BR.

## Pacote de handoff

Leitura recomendada na ordem, mas cada documento é independente:

| # | Documento | Para quê |
|---|---|---|
| 01 | [O que o produto faz](handoff/01-o-que-o-produto-faz.md) | Proposta, problema, personas, fronteiras |
| 02 | [Histórias de usuário](handoff/02-historias-de-usuario.md) | Histórias por perfil + critérios de aceite |
| 03 | [Fluxos de usuário](handoff/03-fluxos-de-usuario.md) | Jornada da contadora, pipeline, máquina de estados, cliente |
| 04 | [Regras de negócio](handoff/04-regras-de-negocio.md) | As 8 regras, extração, classificação, invariantes |
| 05 | [Como garantimos confiança](handoff/05-como-garantimos-confianca.md) | **Os 7 mecanismos de confiança** (o coração do produto) |
| 06 | [Arquitetura técnica](handoff/06-arquitetura-tecnica.md) | Stack, parse-no-browser/regras-no-banco, backend Supabase |
| 07 | [Rodando e deployando](handoff/07-rodando-e-deployando.md) | Setup, env, deploy (Vercel), pendências |
| 08 | [Testes e qualidade](handoff/08-testes-e-qualidade.md) | Vitest + pgTAP + e2e, fixtures de aceitação, gate |
| 09 | [Glossário](handoff/09-glossario.md) | Vocabulário contábil e do produto |

## Referências profundas (fontes da verdade)

- [`PRD.md`](PRD.md) — PRD v2: produto, backend, frontend, design, roadmap (fonte da verdade).
- [`arquitetura-v1.html`](arquitetura-v1.html) — especificação funcional: RF-001…RF-068, matriz de permissões, escopo do MVP, critérios de aceite.
- [`RUNBOOK-DEPLOY.md`](RUNBOOK-DEPLOY.md) — deploy do zero ao link, passo a passo.
- [`ROTEIRO-JANAINA.md`](ROTEIRO-JANAINA.md) — roteiro real da primeira auditoria da contadora.
- [`design/CRAFT.md`](design/CRAFT.md) — standards de design engineering (personas Jakub × Emil), tema Firecrawl, spec do deck "O Fechamento".
- [`PROMPT-NOVA-SESSAO.md`](PROMPT-NOVA-SESSAO.md) — prompt para continuar em uma nova sessão de Claude Code (decisões + gotchas de ambiente).
- [`pesquisa-ux-financeiro.md`](pesquisa-ux-financeiro.md) — pesquisa de UX (padrões financeiros).

## Artefatos de apoio

- [`fixtures/`](fixtures) — arquivos reais da contadora (balancete CSV, DRE PDF, XLSX de grupo) usados como testes de aceitação.
- [`deploy/`](deploy) — SQLs prontos e numerados para o SQL Editor do Supabase (schema → owner → analytics → … → migração 7).
- [`dogfood-reports/`](dogfood-reports) — relatórios de QA em browser.
- [`plans/`](plans) — planos de blocos de trabalho.

## Mapa rápido do repositório

```
docs/            esta documentação + referências profundas + fixtures reais
src/             front (routes · features · workers · components · lib · styles)
supabase/        migrations (a verdade do backend) · functions (Edge) · tests (pgTAP)
scripts/         e2e de produção · geradores de fixture
public/          painel de progresso · assets
```

Produção: https://auditcontabil.vercel.app · Progresso: https://auditcontabil.vercel.app/progresso/index.html
