/** Credit packs, mirrored from the landing pricing section. */
export interface CreditPack {
  id: string;
  tier: string;
  credits: number;
  price: string;
  perScan: string;
  featured?: boolean;
  badge?: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: 'starter', tier: 'Starter', credits: 10, price: '$3.99', perScan: '$0.40 / scan' },
  {
    id: 'regular',
    tier: 'Regular',
    credits: 30,
    price: '$9.99',
    perScan: '$0.33 / scan',
    featured: true,
    badge: 'Most picked',
  },
  { id: 'group', tier: 'Group chat', credits: 80, price: '$14.99', perScan: '$0.19 / scan' },
];
