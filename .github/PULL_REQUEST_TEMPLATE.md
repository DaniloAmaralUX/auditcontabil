## Descrição

<!-- O que este PR faz e por quê. Inclua motivação e contexto relevante. -->

## Tipo de mudança

<!-- Marque com um x o que se aplica -->

- [ ] Correção de bug
- [ ] Nova funcionalidade
- [ ] Refatoração (melhora estrutura sem mudar comportamento)
- [ ] Mudança de schema/migration (backend)
- [ ] Documentação
- [ ] Breaking change (quebra comportamento ou contrato existente)

## Checklist

- [ ] Rodei o gate de qualidade: `pnpm lint && pnpm knip && pnpm test` (tudo verde)
- [ ] Li o [guia de contribuição](./CONTRIBUTING.md)
- [ ] Textos de UI estão em `src/lib/strings.ts` (sem literais no componente)
- [ ] Se mexi em regra de auditoria, criei uma nova versão (`_v2`) em vez de editar a v1
- [ ] Se mexi no schema, adicionei uma migration ordenada em `supabase/migrations/`
- [ ] Os fixtures reais continuam fechando ao centavo (R$ 232.696,03 / R$ 1.346.640,06)

## Comentários adicionais

<!-- Para mudanças grandes/complexas: explique a solução escolhida e alternativas consideradas. -->

## Issue relacionada

Closes: #<!-- número da issue, se houver -->
