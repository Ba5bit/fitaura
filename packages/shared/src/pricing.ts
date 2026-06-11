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
  { id: 'starter', tier: 'Starter', credits: 5, price: '$4.99', perScan: '$1.00 / scan' },
  {
    id: 'regular',
    tier: 'Regular',
    credits: 15,
    price: '$11.99',
    perScan: '$0.80 / scan',
    featured: true,
    badge: 'Most picked',
  },
  { id: 'group', tier: 'Group chat', credits: 40, price: '$29.99', perScan: '$0.75 / scan' },
];
