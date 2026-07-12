// Factory única de query keys (§9.4).
export const qk = {
  clients: {
    all: ['clients'] as const,
    detail: (id: string) => ['clients', id] as const,
  },
  audits: {
    list: (f: unknown) => ['audits', 'list', f] as const,
    detail: (id: string) => ['audits', id] as const,
    files: (id: string) => ['audits', id, 'files'] as const,
    inconsistencies: (id: string, f: unknown) =>
      ['audits', id, 'inconsistencies', f] as const,
    snapshot: (id: string) => ['audits', id, 'snapshot'] as const,
    events: (id: string) => ['audits', id, 'events'] as const,
  },
  team: { members: ['team', 'members'] as const, invites: ['team', 'invites'] as const },
  billing: { subscription: ['billing', 'subscription'] as const },
  share: { report: (token: string) => ['share', token] as const },
  overview: { queue: ['overview', 'queue'] as const },
} as const
