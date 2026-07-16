# Roteiro do testador — piloto AuditView (~15 min)

Você recebeu o link https://auditcontabil.vercel.app e as credenciais de acesso. Este roteiro conduz um passeio de ponta a ponta pelo produto, com **âncoras numéricas exatas** para você conferir se a auditoria fecha o valor esperado. Se qualquer valor divergir, é bug — reporte com screenshot.

## Contexto (30 segundos de leitura)

AuditView é auditoria contábil visual: você sobe uma planilha ou PDF do cliente, o produto extrai os números, aplica regras contábeis determinísticas (nada de IA fazendo conta) e gera um dashboard que também vira um link seguro pra mandar pro cliente final.

**A tese do produto:** o cliente confia porque cada número tem trilha auditável — de qual linha do arquivo veio, qual fórmula rodou, se bate ao centavo com o total declarado no documento.

## Roteiro

### 1. Login (30s)

- Acesse https://auditcontabil.vercel.app
- Faça login com o e-mail e senha entregues
- **Confira:** o header do app mostra **Escritório Piloto** (com acento correto). Se aparecer `EscritÃ³rio` ou similar, reporte.

### 2. Criar cliente (1 min)

- Menu lateral → **Clientes** → **Novo cliente**
- Nome: `Padaria Teste`
- Salvar
- **Confira:** o cliente aparece na lista imediatamente.

### 3. Criar auditoria (30s)

- **Auditorias** → **Nova auditoria**
- Cliente: `Padaria Teste`
- Nome: `Fechamento Teste`
- Período: `2025-01-01` a `2025-12-31`
- Salvar — cai automaticamente na tela de importação.

### 4. Subir o balancete de fixture (2 min)

- Arraste `docs/fixtures/balancete-mdw-2025.csv` para o dropzone (pergunte se não tem — o dono do projeto envia junto)
- Aguarde o preview aparecer
- **Confira:** o card mostra "Números conferidos: resultado bate com o declarado" em verde. Se disser divergência ou não aparecer o card, reporte.
- Clique **Gerar dashboard**
- Aguarde o processamento (~5s)

### 5. Dashboard interno — âncora principal (2 min)

Você deve ver a DRE tipografada com este resultado exato:

> **Resultado do período: R$ 232.696,03**

Este é o **teste de aceitação real** do produto: o balancete de fixture SEMPRE fecha nesse valor. Se o número for outro, é bug de conta (grave — reporte com screenshot).

Confira também:
- Selo abaixo da DRE: "Conferido com o documento: os totais batem ao centavo."
- Aba **Inconsistências**: podem aparecer alguns pontos de atenção (é esperado no fixture)

### 6. Revisar e aprovar (2 min)

- Aba **Revisão**
- Para cada item pendente: clicar em cima, escolher `Aceito` ou `Ocultar do cliente`, escrever uma justificativa curta (obrigatória)
- No topo: campo **Conclusão do escritório** — escreva algo simples como "Período regular; sem ressalvas."
- Clicar **Iniciar revisão** → depois **Aprovar auditoria**

### 7. Publicar e gerar link para o cliente (1 min)

- Aba **Compartilhar** → **Publicar**
- Digite uma senha de 8+ caracteres (guarde — vai usar na próxima etapa)
- Clicar **Gerar link**
- Copiar o link

### 8. Abrir o link como cliente final (aba anônima, 3 min)

Este é O MOMENTO — o que o cliente do escritório vai ver.

- Abra uma nova aba **anônima** (Ctrl+Shift+N no Chrome)
- Cole o link
- Senha errada primeiro (para testar): "abc" → deve mostrar erro genérico
- Senha certa: entrar no deck

**O que confirmar:**

1. **Capa "O Fechamento"** com três blocos abaixo do título:
   - **Resultado do período** — deve dizer algo como "sobraram R$ 233 mil"
   - **Confiabilidade dos dados** — verde, "batem ao centavo com o documento enviado"
   - **Pontos que exigem revisão** — verde (você aprovou) ou attention se algum ficou pendente

2. **DRE tipografada** com o mesmo R$ 232.696,03 do dashboard interno

3. **Selo verde** abaixo da DRE ("Conferido com o documento: os totais batem ao centavo")

4. **Botão Baixar PDF** — clique, o download deve começar. Abra o PDF: deve conter os 3 blocos (Resultado / Confiabilidade / Pontos) e a DRE em texto.

### 9. Repetir com a DRE em PDF (opcional, ~3 min)

Se o dono te enviou também `docs/fixtures/dre-educacao-2024.pdf`, repita o fluxo com ele: crie outra auditoria (mesmo cliente), suba o PDF em vez do CSV, o resultado esperado é:

> **Resultado do período: R$ 1.346.640,06**

Mesma checagem: número exato, selo verde, deck consistente.

## O que reportar

Para cada problema:

1. **URL exato onde apareceu** (copie da barra de endereço)
2. **Screenshot** (Print Screen ou Snipping Tool no Windows)
3. **Passo do roteiro** (ex.: "Passo 5, esperava R$ 232.696,03 e apareceu R$ 232.696,05")
4. **Console errors** (se possível: F12 → aba Console → foto do que estiver em vermelho)

## O que NÃO reportar

Fora do escopo desta rodada de piloto:

- **Convite de membros** (Equipe → Convidar) — Edge Function ainda não deployada
- **Faturamento / Stripe** — em trial de 90 dias, sem cartão
- **Mudanças de tema, dark mode** — cosmético, backlog
- **Mobile perfeito** — projetado para desktop; mobile funciona mas não é polido

## Se travar

Se a página quebrar completamente ou uma tela ficar em branco, F5 (recarregar). Se persistir, mande print do console (F12) para o dono do projeto.

Obrigado por testar. 🚀
