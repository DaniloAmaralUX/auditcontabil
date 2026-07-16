import { AuthError, PostgrestError } from '@supabase/supabase-js'
import { toast } from 'sonner'

// Mapa de códigos de erro dos RPCs (raise exception ... using message = <code>) para PT-BR.
const MESSAGES: Record<string, string> = {
  not_authenticated: 'Sua sessão expirou. Entre novamente.',
  forbidden: 'Você não tem permissão para esta ação.',
  subscription_inactive:
    'A assinatura do escritório está inativa. Regularize para continuar.',
  audit_not_found: 'Auditoria não encontrada.',
  audit_not_accepting_files:
    'Esta auditoria não está aceitando novos arquivos.',
  file_too_large: 'O arquivo passa do limite de 20 MB.',
  unsupported_mime: 'Formato não aceito. Use .xlsx, .xls ou .csv.',
  duplicate_file: 'Este arquivo já foi enviado nesta auditoria.',
  file_limit_reached: 'Esta auditoria já atingiu o limite de 5 arquivos.',
  storage_object_missing:
    'O upload não foi concluído. Envie o arquivo novamente.',
  file_not_found: 'Arquivo não encontrado.',
  batch_too_large: 'Lote de linhas grande demais.',
  row_limit_exceeded: 'O arquivo passou do limite de linhas do piloto.',
  files_not_ready: 'Ainda há arquivos sendo processados.',
  illegal_transition: 'Esta mudança de estado não é permitida agora.',
  review_pending: 'Ainda há itens pendentes de revisão.',
  only_owner_approves: 'Apenas a proprietária pode aprovar.',
  only_owner_publishes: 'Apenas a proprietária pode publicar.',
  audit_not_approved: 'A auditoria precisa ser aprovada antes de publicar.',
  audit_not_published: 'Publique a auditoria antes de compartilhar.',
  password_too_short: 'A senha do link precisa ter ao menos 8 caracteres.',
  no_snapshot: 'Não há uma versão publicada para compartilhar.',
  share_not_found: 'Compartilhamento não encontrado.',
  too_many_attempts: 'Muitas tentativas. Aguarde alguns minutos.',
  invalid_credentials: 'Não foi possível acessar com esses dados.',
  missing_required_mapping:
    'Faltam colunas obrigatórias no mapeamento (conta, período e valores).',
}

/** Erro para a UI: desconhecido NUNCA vaza texto técnico — cai no fallback. */
export function friendlyErrorMessage(raw: string, fallback: string): string {
  if (!raw) return fallback
  const key = raw.split(':')[0].trim()
  return MESSAGES[key] ?? fallback
}

export function handleServerError(error: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error(error)
  }

  const fallback = 'Algo deu errado. Tente novamente.'
  let msg = fallback
  // Erro desconhecido NUNCA vaza texto técnico cru para a UI.
  if (error instanceof PostgrestError)
    msg = friendlyErrorMessage(error.message, fallback)
  else if (error instanceof AuthError) msg = error.message
  else if (error instanceof Error)
    msg = friendlyErrorMessage(error.message, fallback)

  toast.error(msg)
}
