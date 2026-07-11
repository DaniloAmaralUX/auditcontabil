-- 20260711000400_pipeline_tables.sql

-- Toda linha do arquivo vive aqui. NUNCA descartamos linha:
-- original preserva o dado bruto, normalized o dado tipado,
-- status+message explicam o que aconteceu com CADA linha.
create table normalized_rows (
  id              bigint generated always as identity primary key,
  escritorio_id   uuid not null references escritorios(id),
  audit_id        uuid not null references audits(id) on delete cascade,
  file_id         uuid not null references files(id) on delete cascade,
  row_number      int  not null,               -- linha no arquivo original (1-based)
  original        jsonb not null,              -- células cruas, chave = header original
  normalized      jsonb not null,              -- pós-mapeamento/normalização
  -- colunas tipadas extraídas pelo RPC (indexáveis p/ regras em SQL):
  account_code    text,
  account_name    text,
  period          date,
  opening_balance numeric(18,2),
  debit           numeric(18,2),
  credit          numeric(18,2),
  closing_balance numeric(18,2),
  status          row_status not null,
  message         text not null default '',    -- obrigatório quando status <> 'ok' (check)
  created_at      timestamptz not null default now(),
  constraint uq_row unique (file_id, row_number),   -- idempotência por linha
  constraint msg_required check (status = 'ok' or length(message) > 0)
);
create index idx_nr_audit_account on normalized_rows (audit_id, account_code, period);
create index idx_nr_audit_status  on normalized_rows (audit_id, status);
create index idx_nr_file          on normalized_rows (file_id);

-- Controle de idempotência de lotes da ingestão
create table ingest_batches (
  file_id     uuid not null references files(id) on delete cascade,
  batch_seq   int  not null,
  row_count   int  not null,
  received_at timestamptz not null default now(),
  primary key (file_id, batch_seq)
);

-- Catálogo VERSIONADO de regras. A implementação vive em funções SQL
-- (app.rule_<code>_v<version>) criadas por migration; esta tabela guarda
-- metadados + parâmetros/tolerâncias POR ESCRITÓRIO.
create table rules (
  id               uuid primary key default gen_random_uuid(),
  escritorio_id    uuid not null references escritorios(id),
  code             text not null,        -- 'R001_DEBIT_CREDIT', 'R002_BALANCE_EQUATION', ...
  version          int  not null default 1,
  name             text not null,
  description      text not null,
  default_severity severity not null,
  formula          text not null,        -- legível
  fn_name          text not null,        -- 'rule_r001_debit_credit_v1' (schema app)
  params           jsonb not null default '{}', -- {'tolerance_abs':0.01} / {'threshold_pct':30}
  enabled          boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (escritorio_id, code, version)
);

-- Cada execução de run_rules = um run (permite reprocessar sem perder histórico)
create table rule_runs (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id),
  audit_id      uuid not null references audits(id) on delete cascade,
  started_by    uuid references profiles(id),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  is_current    boolean not null default true,   -- run_rules zera o anterior
  stats         jsonb not null default '{}'      -- {'R001':{'ms':84,'results':2},...}
);
create unique index uq_current_run on rule_runs (audit_id) where is_current;

-- Snapshot completo de cada resultado: o PRD exige fórmula/versão/valores.
create table rule_results (
  id               bigint generated always as identity primary key,
  escritorio_id    uuid not null references escritorios(id),
  audit_id         uuid not null references audits(id) on delete cascade,
  run_id           uuid not null references rule_runs(id) on delete cascade,
  rule_id          uuid not null references rules(id),
  rule_code        text not null,               -- desnormalizado: sobrevive a mudanças
  rule_version     int  not null,
  scope            result_scope not null,
  row_id           bigint references normalized_rows(id),
  account_code     text,
  period           date,
  severity         severity not null,
  message          text not null,
  formula_snapshot text not null,               -- fórmula com params resolvidos
  values_snapshot  jsonb not null,
  review_status    review_status not null default 'pending',
  review_note      text,
  reviewed_by      uuid references profiles(id),
  reviewed_at      timestamptz,
  hidden_from_client boolean not null default false,
  created_at       timestamptz not null default now(),
  constraint review_note_required check (
    review_status = 'pending' or length(coalesce(review_note,'')) > 0
  )
);
create index idx_rr_audit_run  on rule_results (audit_id, run_id);
create index idx_rr_review     on rule_results (audit_id, review_status)
  where severity in ('attention','divergence');

-- FK adiada de comments -> rule_results (comments criada em 000300).
alter table comments
  add constraint comments_rule_result_fk
  foreign key (rule_result_id) references rule_results(id) on delete set null;
