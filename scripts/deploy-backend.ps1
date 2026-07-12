# Deploy do backend Supabase — roda numa janela interativa (login abre o browser;
# db push pede a senha do banco). Ao final grava as API keys em supabase/.temp/api-keys.json
# (pasta git-ignorada) para o assistente continuar a configuração do front.
$ErrorActionPreference = 'Continue'
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host ""
Write-Host "=== 1/4 · Login no Supabase (o browser vai abrir; clique em Authorize) ===" -ForegroundColor Cyan
npx -y supabase login
if ($LASTEXITCODE -ne 0) { Write-Host "Login falhou." -ForegroundColor Red; Read-Host "Enter para sair"; exit 1 }

Write-Host ""
Write-Host "=== 2/4 · db push (digite a SENHA DO BANCO quando pedir) ===" -ForegroundColor Cyan
Write-Host "    (Dashboard > Project Settings > Database > Database password)" -ForegroundColor DarkGray
npx -y supabase db push
if ($LASTEXITCODE -ne 0) { Write-Host "db push falhou." -ForegroundColor Red; Read-Host "Enter para sair"; exit 1 }

Write-Host ""
Write-Host "=== 3/4 · Edge Functions ===" -ForegroundColor Cyan
npx -y supabase functions deploy create-checkout-session customer-portal invite-user
npx -y supabase functions deploy stripe-webhook --no-verify-jwt

Write-Host ""
Write-Host "=== 4/4 · Exportando API keys para o assistente continuar ===" -ForegroundColor Cyan
npx -y supabase projects api-keys --project-ref lgqexlhbpxfkzrsvbknz -o json | Out-File -Encoding utf8 supabase\.temp\api-keys.json
Write-Host ""
Write-Host "PRONTO! Pode voltar para o Claude — ele continua sozinho." -ForegroundColor Green
Read-Host "Enter para fechar"
