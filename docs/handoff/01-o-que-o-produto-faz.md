# 01 — O que o produto faz

## Em uma frase

**AuditView** é um SaaS de **auditoria contábil visual para escritórios de contabilidade**. A contadora sobe a planilha que já exporta do sistema contábil, aperta **um botão**, e nasce um dashboard gerencial que é **auditoria e apresentação ao mesmo tempo** — compartilhável com o cliente final por link protegido por senha.

## O problema

Escritórios de contabilidade recebem arquivos imperfeitos dos clientes (XLSX, CSV, PDF) — colunas inconsistentes, encodings antigos (CP1252), erros de digitação. O trabalho de conferir, consolidar, encontrar divergências, montar gráficos e explicar tudo ao cliente é:

- **repetitivo** — refeito a cada competência;
- **sujeito a erro** — conferência manual de centenas de linhas;
- **sem rastreabilidade** — não fica registrado o que foi verificado, por quem, com qual fórmula.

## O que o AuditView entrega

Transforma esse trabalho manual numa **auditoria visual, revisável, versionada e compartilhável**:

1. **Sobe o arquivo** que o cliente já tem (balancete, DRE, planilha de grupo).
2. **Detecção e mapeamento automáticos** — o produto adivinha as colunas e mostra uma linha de conferência ("Números conferidos" ou "DIVERGÊNCIA").
3. **Processamento** — normaliza os dados (pt-BR), roda **8 regras de auditoria determinísticas** no banco e monta o dashboard gerencial.
4. **Revisão humana** — a equipe justifica cada achado ou marca como falso positivo, e decide item a item o que o cliente enxerga.
5. **Aprovação e publicação** — a proprietária aprova; o produto congela um **snapshot imutável** com hash.
6. **Compartilhamento** — o cliente final acessa a apresentação editorial **"O Fechamento"** em `/r/:token`, por link + senha, sem criar conta; baixa PDF se permitido.

> Fonte de verdade do produto: [`docs/PRD.md`](../PRD.md) (PRD v2). Mapa técnico de 10 minutos: [`HANDOFF.md`](../../HANDOFF.md).

## Fronteiras — o que o produto **não** faz

- **Não substitui o contador.** Ele é a autoridade; o produto é a ferramenta.
- **Não faz cálculo fiscal avançado** (SPED, XML, apuração de impostos) — fora do escopo da v1.
- **A IA nunca é fonte de verdade contábil.** Não há LLM no runtime do produto: todo cálculo é SQL determinístico e versionado, reconciliado ao centavo contra o próprio documento. (A IA foi usada para *construir* o produto, não para *calcular* dentro dele.) Detalhe em [05 — Como garantimos confiança](05-como-garantimos-confianca.md).

Escopo completo do que entra e do que fica de fora: [`docs/arquitetura-v1.html`](../arquitetura-v1.html) (seção "Escopo da versão 1").

## Quem usa — 4 perfis

Três perfis internos (com conta) + o cliente externo (sem conta). A segurança real é aplicada por **RLS multi-tenant no banco**; a matriz abaixo é o modelo de papéis (código em [`src/lib/permissions.ts`](../../src/lib/permissions.ts)).

| Perfil | Papel (`role`) | O que faz |
|---|---|---|
| **Proprietária** | `owner` | Gestão total: convida/edita/desativa equipe, vê todas as auditorias, **aprova e publica**, revoga links, billing. |
| **Contador responsável** | `accountant` | Revisão técnica: cria/edita auditorias, envia e mapeia arquivos, **justifica divergências**, escreve a conclusão, compartilha quando autorizado. |
| **Analista / funcionário** | `analyst` | Operação de dados: cadastra clientes, faz upload/mapeamento, analisa linhas com falha, notas internas. Não gerencia equipe nem publica. |
| **Cliente final** | *(externo, sem conta)* | Só lê **uma** auditoria publicada, por link + senha. Vê KPIs, gráficos e conclusão em linguagem simples; baixa PDF quando permitido. Não vê dados internos nem outras auditorias. |

Matriz de permissões detalhada por funcionalidade: [`docs/arquitetura-v1.html`](../arquitetura-v1.html) (seção "Matriz de permissões") e [02 — Histórias de usuário](02-historias-de-usuario.md).

## Princípios de domínio (invioláveis)

1. **Nenhuma linha é descartada silenciosamente** — toda linha tem status + mensagem.
2. **Cálculos determinísticos, auditáveis e versionados** — fórmula + valores + versão gravados em cada resultado.
3. **Revisão humana obrigatória antes de publicar** — não se publica com pendências.
4. **Status nunca é comunicado só por cor** — sempre ícone + texto ([`src/features/audits/components/status-badge.tsx`](../../src/features/audits/components/status-badge.tsx)).

Continue em: [02 — Histórias de usuário](02-historias-de-usuario.md) · [03 — Fluxos de usuário](03-fluxos-de-usuario.md) · [04 — Regras de negócio](04-regras-de-negocio.md).
