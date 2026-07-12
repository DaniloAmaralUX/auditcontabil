# Roteiro da primeira auditoria — para a contadora (Janaina)

> 10 minutos, do arquivo que você já exporta até o link de apresentação
> para o seu cliente. Nada para instalar.

## O que você precisa

- O **Balancete Societário em CSV** (ou a **DRE em PDF**) exportado da sua
  plataforma de contabilidade — o mesmo arquivo de sempre, sem mexer em nada.
- Login: https://auditcontabil.vercel.app
  - E-mail: `teste@espacoacao.app` · Senha: `senha123`

## Passo a passo

1. **Entre** e clique em **Clientes → Novo cliente**. Cadastre a empresa
   (nome e CNPJ — os mesmos do balancete).
2. Vá em **Auditorias → Nova auditoria**, escolha o cliente e o período
   (ex.: 01/01/2025 a 31/12/2025).
3. Na aba **Importar**, **arraste o CSV** para a área pontilhada.
   - O sistema reconhece o arquivo sozinho e mostra: *"Balancete Societário
     reconhecido · MATERIAIS MDW LTDA · CNPJ · Período"* e a linha de
     conferência: *"Números conferidos: o resultado bate com o declarado"*.
   - Se aparecer **DIVERGÊNCIA**, o arquivo tem totais que não fecham —
     isso é exatamente o que a auditoria deve pegar.
4. Clique em **Gerar dashboard**. Em segundos a aba **Dashboard** mostra
   receita, deduções, despesas por grupo, maiores contas e o resultado —
   **idêntico ao centavo** ao que o balancete declara.
5. Na aba **Revisão**, veja os pontos levantados. Justifique o que tiver
   explicação (e escolha se o cliente vê ou não). Escreva a **conclusão**.
6. **Aprovar → Publicar → Compartilhar**: defina uma senha e copie o link.
7. Abra o link: essa é a apresentação **"O Fechamento"** — feita para
   projetar na reunião ou para o cliente ver sozinho no celular. O botão
   **Baixar PDF** gera o resumo em papel.

## Exemplo pronto para ver agora

- Deck publicado com o balancete real:
  https://auditcontabil.vercel.app/r/YbxbYYG0pyaMJ7J19pBHp5fb3yo3U_T0imDg9Rh5LaI
  (senha: `cliente123`)

## Se algo não sair como esperado

- **O arquivo não foi reconhecido** → o mapeamento manual abre embaixo:
  diga qual coluna é a conta e qual é o valor, e siga normalmente.
- **PDF escaneado (foto)** → o sistema avisa; exporte como CSV na sua
  plataforma.
- Qualquer coisa estranha, mande o arquivo e um print — cada linha ignorada
  ou divergência fica registrada, nada é descartado em silêncio.
