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
  { id: 'starter', tier: 'Starter', credits: 10, price: '$4.99', perScan: '$0.50 / scan' },
  {
    id: 'regular',
    tier: 'Regular',
    credits: 30,
    price: '$11.99',
    perScan: '$0.40 / scan',
    featured: true,
    badge: 'Most picked',
  },
  { id: 'group', tier: 'Group chat', credits: 80, price: '$19.99', perScan: '$0.25 / scan' },
];
