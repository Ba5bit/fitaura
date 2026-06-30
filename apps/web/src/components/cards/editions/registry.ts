// apps/web/src/components/cards/editions/registry.ts
export const NFACTORIAL_ENTITLEMENT = 'theme:company-nfactorial';

export type EditionId = 'default' | 'nfactorial';

export interface Edition {
  id: EditionId;
  label: string;
  /** Gate key; undefined = always available. */
  entitlement?: string;
}

export const EDITIONS: Edition[] = [
  { id: 'default', label: 'Default' },
  { id: 'nfactorial', label: 'nFactorial', entitlement: NFACTORIAL_ENTITLEMENT },
];

/** The editions a holder of `owned` entitlements may pick (default always included). */
export function entitledEditions(owned: string[]): Edition[] {
  return EDITIONS.filter((e) => !e.entitlement || owned.includes(e.entitlement));
}

/** Narrow an arbitrary string to a known EditionId, else 'default'. */
export function asEditionId(v: string | null | undefined): EditionId {
  return v === 'nfactorial' ? 'nfactorial' : 'default';
}
