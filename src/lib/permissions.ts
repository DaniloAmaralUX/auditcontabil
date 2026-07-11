import { type Role } from '@/lib/supabase'

// Capacidades da UI. A RLS garante no servidor; aqui só desabilitamos ações.
export type Capability =
  | 'manage_team'
  | 'manage_billing'
  | 'manage_clients'
  | 'delete_client'
  | 'create_audit'
  | 'delete_audit'
  | 'upload_files'
  | 'run_rules'
  | 'review'
  | 'approve'
  | 'publish'
  | 'share'
  | 'edit_rules'

const MATRIX: Record<Capability, Role[]> = {
  manage_team: ['owner'],
  manage_billing: ['owner'],
  manage_clients: ['owner', 'accountant', 'analyst'],
  delete_client: ['owner'],
  create_audit: ['owner', 'accountant'],
  delete_audit: ['owner'],
  upload_files: ['owner', 'accountant', 'analyst'],
  run_rules: ['owner', 'accountant', 'analyst'],
  review: ['owner', 'accountant', 'analyst'],
  approve: ['owner'],
  publish: ['owner'],
  share: ['owner', 'accountant'],
  edit_rules: ['owner'],
}

export function can(role: Role | undefined, cap: Capability): boolean {
  if (!role) return false
  return MATRIX[cap].includes(role)
}

export const roleLabels: Record<Role, string> = {
  owner: 'Proprietária',
  accountant: 'Contador responsável',
  analyst: 'Analista',
}
