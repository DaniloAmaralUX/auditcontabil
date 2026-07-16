# Publicar para teste real — runbook (~15 min)

Depois do merge desta PR na `main`, a Vercel deploya o front automaticamente. Este runbook faz o resto do trabalho de produção: aplica migrações, corrige mojibake, rotaciona a senha de teste. **Executar na ordem.** Cada passo tem uma verificação SQL para confirmar antes de seguir.

Pré-requisitos: acesso de owner ao Supabase Studio do projeto `lgqexlhbpxfkzrsvbknz`.

---

## Passo 1 — Migração 7 (classificação por código)

Se ainda não estiver em produção, aplique agora. Sonda primeiro:

```sql
select proname from pg_proc where proname in ('classify_kind_v2','classify_category_v2');
```

- **2 linhas** retornaram → já aplicada, pular para o Passo 2.
- **0 linhas** → colar TODO o conteúdo de [docs/deploy/7-classificacao-codigo.sql](../deploy/7-classificacao-codigo.sql) no SQL Editor → Run.

Verificar sucesso:

```sql
select count(*) as expected_2 from pg_proc
where proname in ('classify_kind_v2','classify_category_v2');
-- deve retornar 2
```

---

## Passo 2 — Migração 8 (selo de reconciliação)

Colar TODO o conteúdo de [docs/deploy/8-selo-reconciliacao.sql](../deploy/8-selo-reconciliacao.sql) → Run.

Verificar:

```sql
-- publish_audit foi redefinido? Se sim, aparece 'reconciliation' no source.
select case when pg_get_functiondef(oid) like '%reconciliation%' then 'ok' else 'faltando' end
from pg_proc where proname = 'publish_audit';
-- deve retornar 'ok'
```

---

## Passo 3 — Corrigir mojibake do escritório piloto

```sql
select id, name from escritorios where name like '%rio Piloto%';
-- se aparecer 'EscritÃ³rio Piloto', corrigir:
update escritorios set name = 'Escritório Piloto'
where name like 'Escrit%rio Piloto' and name <> 'Escritório Piloto';
-- deve retornar UPDATE 1 (ou 0 se já estava correto)
```

**Republicar os decks demo** (opcional mas recomendado — snapshots antigos são imutáveis e continuarão com o nome corrompido):

```sql
-- Listar auditorias publicadas do piloto
select a.id, a.title, ps.version, ps.published_at
from audits a
join published_snapshots ps on ps.audit_id = a.id
where a.escritorio_id = (select id from escritorios where name = 'Escritório Piloto')
order by ps.published_at desc;
```

Para cada `audit_id` retornado, no app da Vercel: abrir a auditoria → aba **Compartilhar** → clicar **Publicar nova versão**. O snapshot novo terá:
- Nome do escritório correto no header
- Campo `reconciliation` no payload (populado pela migração 8)
- Selo real da DRE (não mais o proxy `invalid === 0`)

---

## Passo 4 — Rotacionar senha da conta de teste

A senha esteve no histórico do git antes de ser removida do HANDOFF.md. Rotacionar por precaução:

Studio → **Authentication → Users** → filtrar por e-mail da conta de teste do piloto → **Reset password** → seguir o e-mail que chega.

Verificar: fazer logout no auditcontabil.vercel.app, tentar login com a senha antiga (deve falhar), tentar com a nova (deve entrar).

---

## Passo 5 — Confirmar Site URL do Supabase Auth

Studio → **Authentication → URL Configuration** → confirmar:

- **Site URL**: `https://auditcontabil.vercel.app`
- **Redirect URLs**: `https://auditcontabil.vercel.app/**` (mais `http://localhost:5173/**` para dev local)

**Se ainda estiver `auditcontabil.pages.dev`**, os links de convite e de reset de senha vão para o domínio errado. Corrigir agora.

---

## Passo 6 — Smoke test em produção

Abrir uma aba anônima em https://auditcontabil.vercel.app:

- [ ] Login page renderiza sem console errors
- [ ] Login com a conta de teste (senha nova) entra no dashboard
- [ ] Sidebar mostra o nome **Escritório Piloto** (não mojibake)
- [ ] Uma auditoria republicada mostra a versão nova (v2 ou superior)
- [ ] Deck público (`/r/<token>`) da auditoria republicada tem os 3 blocos: **Resultado do período**, **Confiabilidade dos dados**, **Pontos que exigem revisão**
- [ ] Se a auditoria republicada usa balancete, o selo da DRE fala em "batem ao centavo" (não em `invalid === 0`)

**Se tudo isso funciona, o produto está pronto para o testador do piloto.** Ver o roteiro em [docs/runbooks/roteiro-testador.md](./roteiro-testador.md).

---

## Rollback

- **Migração 7 ou 8** rodou errada → não há rollback automático de `create or replace function`. Aplicar a versão anterior da função (respectivamente `docs/deploy/6-trust-telemetria.sql` para publish_audit sem reconciliation; para classify_kind_v2/category_v2 seria um `drop function` explícito — mas essas funções são novas, então "rollback" é dropar).
- **Mojibake UPDATE** → snapshots imutáveis não voltam. Se der problema, criar nova versão publicada e ignorar as antigas.
- **Senha rotacionada** → o próprio Studio permite fazer novo reset.

## Ordem de dependência

```
Migração 7 (P0 — falso alarme R001/R002)
  ↓
Migração 8 (P0 — selo real depende da estrutura da 7 estar aplicada)
  ↓
Mojibake + republicar (P1 — visual, só afeta snapshots novos)
  ↓
Senha (P1 — precaução)
  ↓
Auth URL (P1 — confirmar, geralmente já está)
  ↓
Smoke test (obrigatório antes de mandar para o testador)
```
