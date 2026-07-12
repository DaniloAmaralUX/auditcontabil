# 02 — Histórias de usuário

Histórias organizadas por perfil, com critério de aceite. Extraídas da especificação funcional [`docs/arquitetura-v1.html`](../arquitetura-v1.html) (v1, jul/2026) e do [PRD](../PRD.md). Cada história aponta os requisitos funcionais (RF) relacionados — a lista completa RF-001…RF-068 está no HTML de arquitetura.

## Proprietária (`owner`)

- **Convidar equipe e definir perfis.** *Como dona do escritório, quero convidar funcionários e definir seus perfis para que cada pessoa tenha o acesso adequado.*
  **Aceite:** convite por e-mail, perfil definido, status do convite, e possibilidade de desativar o usuário. *(RF-002, RF-003, RF-004)*

- **Acompanhar a operação.** *Como dona, quero visualizar todas as auditorias e seus responsáveis para acompanhar o andamento.*
  **Aceite:** listagem com cliente, responsável, status, prazo, alertas e última atualização. *(RF-066, RF-068)*

- **Aprovar antes de compartilhar.** *Como dona, quero aprovar uma auditoria antes do compartilhamento para controlar a qualidade das entregas.*
  **Aceite:** auditoria só pode ser publicada após revisão obrigatória e aprovação registrada. *(RF-053, RF-054)*

- **Rastrear quem alterou/publicou.** *Como dona, quero consultar quem alterou e publicou uma auditoria para manter rastreabilidade.*
  **Aceite:** log com usuário, data, ação, valor anterior e valor posterior. *(RF-064, RF-065)*

## Contador responsável (`accountant`)

- **Criar auditoria e dividir trabalho.** *Como contador, quero criar uma auditoria e atribuir tarefas a um analista para dividir o trabalho.*
  **Aceite:** responsável principal, colaboradores e histórico de atribuição. *(RF-012, RF-013)*

- **Revisar cada divergência e concluir.** *Como contador, quero revisar cada divergência e registrar minha conclusão para que o resultado tenha validação profissional.*
  **Aceite:** justificar, marcar falso positivo, ocultar do cliente e adicionar comentário. *(RF-048–RF-052)*

- **Conferir a fórmula da regra.** *Como contador, quero visualizar a fórmula e os valores usados em cada regra para conferir o cálculo.*
  **Aceite:** regra, versão, tolerância, valores encontrados e registros de origem. *(RF-040)*

## Analista / funcionário (`analyst`)

- **Preparar dados sem depender de suporte.** *Como analista, quero enviar arquivos e corrigir o mapeamento de colunas para preparar os dados sem depender de suporte técnico.*
  **Aceite:** upload, mensagens simples, sugestão de colunas e confirmação manual. *(RF-019, RF-026–RF-028)*

- **Não perder dados silenciosamente.** *Como analista, quero saber quais linhas não foram processadas para corrigir o arquivo sem perder dados silenciosamente.*
  **Aceite:** número da linha, campo, valor original, motivo e opção de exportar erros. *(RF-025, RF-033)*

- **Retomar de onde parou.** *Como funcionário, quero retomar uma auditoria de onde parei para continuar sem repetir etapas.*
  **Aceite:** salvamento por etapa, status persistente e indicação da próxima ação. *(RF-015)*

## Cliente final (externo, sem conta)

- **Acessar por link e senha, sem conta.** *Como cliente, quero acessar a auditoria por link e senha para consultar os resultados sem criar uma conta.*
  **Aceite:** acesso limitado a uma auditoria e sessão somente leitura. *(RF-058, RF-059, RF-061)*

- **Entender sem jargão.** *Como cliente, quero ver explicações simples para compreender os pontos de atenção sem conhecer termos técnicos.*
  **Aceite:** textos publicados pelo contador, KPIs claros e ausência de logs técnicos. *(RF-056)*

## Critérios de aceite do produto (fluxo completo)

A v1 só é considerada utilizável quando o fluxo ponta a ponta funciona (de [`arquitetura-v1.html`](../arquitetura-v1.html), seção "Critérios de aceite"):

| Área | Critério | Resultado esperado |
|---|---|---|
| Equipe | Proprietária convida funcionário | Funcionário recebe acesso com o perfil correto |
| Cliente | Funcionário cadastra cliente | Cliente aparece na listagem e pode receber auditorias |
| Auditoria | Contador cria e atribui auditoria | Status, responsável e colaboradores registrados |
| Arquivo | Analista envia arquivo real | Sistema valida e informa o que foi reconhecido |
| Dados | Analista corrige mapeamento | Dados normalizados **sem descarte silencioso** |
| Regras | Sistema executa verificações | Resultados exibem fórmula, origem e classificação |
| Revisão | Contador justifica divergências | Comentários e decisões salvos no histórico |
| Aprovação | Proprietária aprova relatório | Somente a versão aprovada pode ser publicada |
| Cliente | Cliente acessa link com senha | Visualiza apenas a auditoria publicada |
| PDF | Cliente baixa o relatório | PDF contém somente dados autorizados |

Veja como esses passos se conectam em [03 — Fluxos de usuário](03-fluxos-de-usuario.md).
