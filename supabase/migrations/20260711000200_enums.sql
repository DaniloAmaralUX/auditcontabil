-- 20260711000200_enums.sql
create type audit_status as enum (
  'draft',                -- criada, metadados incompletos
  'awaiting_files',       -- pronta para upload
  'awaiting_mapping',     -- arquivos subidos, falta mapear colunas
  'processing',           -- ingestão e/ou regras em execução
  'partially_processed',  -- parte dos arquivos ingerida; há falhas/pendências
  'processed',            -- todas as linhas ingeridas + regras executadas
  'in_review',            -- revisão obrigatória em curso
  'approved',             -- owner aprovou
  'published',            -- snapshot imutável gerado
  'archived'              -- fora do fluxo; shares revogados
);
-- Nota: "shared" NÃO é estado da auditoria — compartilhamento é propriedade
-- da entidade shares (0..n shares ativos por auditoria published).

create type file_status as enum (
  'uploading','uploaded','awaiting_mapping','mapped','ingesting','ingested','failed'
);

create type severity as enum ('ok','info','attention','divergence');

create type share_status as enum ('active','revoked','expired');

create type row_status as enum (
  'ok',        -- normalizada sem intervenção
  'coerced',   -- valor coagido (ex.: "1.234,56" -> 1234.56); message explica
  'invalid',   -- campo obrigatório ausente/formato irrecuperável; linha PRESERVADA
  'duplicate'  -- duplicata detectada; linha PRESERVADA e marcada
);

create type user_role as enum ('owner','accountant','analyst');
create type review_status as enum ('pending','justified','false_positive');
create type invite_status as enum ('pending','accepted','expired','revoked');
create type actor_type as enum ('user','system','share_client');
create type result_scope as enum ('row','account','file','audit');
create type subscription_status as enum (
  'trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid','paused'
);
