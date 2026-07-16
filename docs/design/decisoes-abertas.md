# Decisões de design abertas — para o designer

Itens levantados pelas revisões (code-review multi-agente, ce-simplify, passe de Web Interface Guidelines) que são **decisões de design, não bugs**. Nenhum bloqueia o envio ao testador. Ordenados por impacto no usuário.

## 1. Tom `neutral` no PDF é visualmente idêntico ao `good`

No deck web, o estado "sem dados consolidados" (tone `neutral`) tem ícone Info azul (`text-info-text`). No PDF, `toneColor()` renderiza `neutral` e `good` no mesmo preto `#1a1a1a` — um relatório sem analytics parece um relatório saudável. O arquivo já define `styles.info: '#1d4ed8'` (azul, contraste ok em papel) sem usar.

**Opções:** (a) azul `#1d4ed8` para neutral no PDF; (b) manter preto e diferenciar só pelo texto (a headline já diz "não estão disponíveis"). Custo de implementação: 1 linha.

## 2. Bloco de capa: `short` vs `headline`

Os 3 blocos da capa usam `summary.short` (ex.: "Superávit de R$ 233 mil") com a manchete h1 carregando a frase completa. No PDF, o bloco RESULTADO usa o `short` e a manchete usa a headline — consistente. Mas o bloco "Confiabilidade" no deck usa o short ("Totais conferidos ao centavo") enquanto o `detail` (linhas inválidas) aparece embaixo em texto menor. Vale validar com olho de designer se a hierarquia short/detail está comunicando bem no mobile (375px).

## 3. Toggle "Mostrar/Ocultar" senha muda a largura do botão

No password gate, o botão alterna entre "Mostrar" (7ch) e "Ocultar" (7ch) — em pt-BR ficou quase igual, mas o layout ainda pode dar um saltinho. Alternativa: ícone de olho com `aria-label` (padrão do sign-in interno, que usa `PasswordInput` com ícone). Unificar com o componente `PasswordInput` existente resolveria os dois.

## 4. Leitor de tela não recebe o "tom" dos blocos da capa

O tom (verde/âmbar/vermelho/azul) dos 3 blocos é comunicado por cor+ícone; o texto em si é autoexplicativo ("Totais divergem do documento"), então não é violação WCAG — mas um prefixo `sr-only` ("Atenção:", "Crítico:") daria paridade explícita. Decisão de voz/copy: os prefixos podem soar redundantes com o texto atual.

## 5. Tipos `SnapshotPayload` × `PublicSnapshot` (achado #8 da revisão)

Dois revisores discordaram: o maintainability queria unificar (payload é o mesmo shape em runtime), o quality reviewer defendeu manter separados (caminhos de fetch distintos — RPC pública vs query interna). Empate técnico; critério de decisão é de produto: se a pré-visualização interna deve SEMPRE espelhar o deck público 1:1, unificar o tipo formaliza isso.

## 6. Loading do botão "Acessar" e "Baixar PDF"

Guidelines sugerem que estados de loading terminem com `…` ("Acessando…"). Hoje mostramos spinner + label estático. Escolha de voz do produto.
