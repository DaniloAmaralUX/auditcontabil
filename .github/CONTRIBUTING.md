# Contribuindo com o AuditView

Guia para desenvolvedores que trabalham no AuditView. O produto é um SaaS de auditoria contábil; a barra de qualidade é alta porque **o resultado precisa ser confiável para um contador**.

## Começando

```bash
pnpm install
cp .env.example .env   # cole a anon key do Supabase (Settings → API); a URL já vem preenchida
pnpm dev               # http://localhost:5173
```

Setup completo de banco e deploy: [`docs/handoff/07-rodando-e-deployando.md`](../docs/handoff/07-rodando-e-deployando.md).

## Gate de qualidade — antes de todo commit

```bash
pnpm lint && pnpm knip && pnpm test
```

Tudo precisa passar verde. `pnpm test` roda o Vitest em browser mode (Playwright/chromium). Os **arquivos reais** em `docs/fixtures/` são testes de aceitação: o balancete tem de fechar em **R$ 232.696,03** e a DRE em **R$ 1.346.640,06**. Se um desses testes quebrar, **o produto está errando conta — não "ajuste o teste"**.

## Padrões de código

- **TypeScript type-safe.** Siga ESLint + Prettier (configs já no repo).
- **Textos de UI ficam em `src/lib/strings.ts`** — componentes não têm literais de UI (tudo em PT-BR, uma fonte).
- **Permissões de UI em `src/lib/permissions.ts`** — mas a segurança real é **RLS no banco**. Nunca confie só no front.
- **Regras de auditoria são versionadas.** Mudou uma regra? Crie `app.rule_*_v2` + nova linha em `rules`. **Nunca edite a v1** — a rastreabilidade depende disso.
- **Migrations são a verdade do backend.** Toda mudança de schema entra como migration ordenada em `supabase/migrations/`.
- **Design tokens em `src/styles/theme.css`.** Única extensão permitida: `--success` / `--warning` / `--info`. A régua de craft é [`docs/design/CRAFT.md`](../docs/design/CRAFT.md) — PR que a viola não passa.
- **Nenhuma linha de dado é descartada silenciosamente** — invariante de domínio (veja [regras de negócio](../docs/handoff/04-regras-de-negocio.md)).

## Fluxo de Pull Request

- Trabalhe em um branch dedicado; mantenha o PR **focado e conciso**.
- Preencha o [template de PR](./PULL_REQUEST_TEMPLATE.md).
- Commits seguem [Conventional Commits](https://www.conventionalcommits.org/) (há `cz.yaml` para `git cz`).
- O CI (`.github/workflows/`) roda testes de banco (pgTAP) + front. Deploy é automático no merge para `main` (Vercel).

## Reportando problemas

Use os templates de [bug](./ISSUE_TEMPLATE) e [feature](./ISSUE_TEMPLATE). Descreva com clareza, dê passos de reprodução e inclua o arquivo/período quando for algo de dado contábil (sem expor dados sensíveis de clientes reais).
