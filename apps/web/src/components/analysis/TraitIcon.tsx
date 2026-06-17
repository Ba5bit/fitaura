import type { ReactNode } from 'react';
import type { FaceTraitIcon } from '@fitaura/shared';

/** Simple geometric trait icons for the gym-app breakdown. Design's `GIcon`. */
export function TraitIcon({ name }: { name: FaceTraitIcon }) {
  const paths: Record<FaceTraitIcon, ReactNode> = {
    jaw: <path d="M5 5v6a7 7 0 0 0 14 0V5" />,
    harmony: (
      <g>
        <circle cx="9" cy="12" r="5" />
        <circle cx="15" cy="12" r="5" />
      </g>
    ),
    eye: (
      <g>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="2.4" />
      </g>
    ),
    brow: <path d="M4 14c3-5 13-5 16 0" />,
    beard: <path d="M6 7c0 8 3 11 6 11s6-3 6-11" />,
    star: <path d="M12 3l2.3 6.2L21 11l-6.7 1.8L12 21l-2.3-8.2L3 11l6.7-1.8z" />,
    // face / jaw — head outline tapering to a chin
    face: <path d="M12 3c-3.7 0-6 2.7-6 6.4 0 4.3 2.7 8.6 6 8.6s6-4.3 6-8.6C18 5.7 15.7 3 12 3z" />,
    // haircut — a head of hair (two arcs over the crown)
    hair: (
      <g>
        <path d="M5 14c0-6 3-9 7-9s7 3 7 9" />
        <path d="M5 14c1.6-3 3.6-4.5 7-4.5s5.4 1.5 7 4.5" />
      </g>
    ),
    // grooming — a comb
    razor: (
      <g>
        <path d="M4 8h16" />
        <path d="M6.5 8v6M9.5 8v6M12.5 8v6M15.5 8v6" />
      </g>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] ?? paths.star}
    </svg>
  );
}
