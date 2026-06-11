import type { SVGProps } from 'react';

/**
 * Centralised icon set ported from the inline SVGs across the imported design
 * (landing.jsx, result-shell.jsx, upload-zone.jsx, scan-app.jsx). Each icon is
 * a thin wrapper over a 24×24 stroke SVG so callers can size via CSS.
 */
type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  ...props,
});

export const Icon = {
  upload: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8}>
      <path d="M12 16V4M7 9l5-5 5 5M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  scan: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8}>
      <path
        d="M4 7V5a1 1 0 011-1h2M20 7V5a1 1 0 00-1-1h-2M4 17v2a1 1 0 001 1h2M20 17v2a1 1 0 01-1 1h-2M3 12h18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  receipt: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8}>
      <path
        d="M6 3v18l2-1.4L10 21l2-1.4L14 21l2-1.4L18 21V3l-2 1.4L14 3l-2 1.4L10 3 8 4.4 6 3zM9 8h6M9 12h6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  check: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2.4}>
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  x: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2.2}>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  ),
  shield: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.7}>
      <path d="M12 3l8 3v6c0 5-3.5 7.7-8 9-4.5-1.3-8-4-8-9V6l8-3z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  lock: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" strokeLinecap="round" />
    </svg>
  ),
  bolt: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8}>
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" strokeLinejoin="round" />
    </svg>
  ),
  arrow: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2}>
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  back: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.9}>
      <path d="M19 12H5M11 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  menu: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2}>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  ),
  chevronLeft: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  chevronRight: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  swap: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2}>
      <path d="M16 3l4 4-4 4M20 7H8M8 21l-4-4 4-4M4 17h12" />
    </svg>
  ),
  eye: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  edit: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2}>
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
    </svg>
  ),
  download: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  ),
  share: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2}>
      <path d="M18 8a3 3 0 10-2.8-4M6 15a3 3 0 100 6 3 3 0 000-6zM18 19a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  ),
  plus: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2.2}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  minus: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2.2}>
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  refresh: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2}>
      <path d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5" />
    </svg>
  ),
  bookmark: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  ),
  credit: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 9.5h4.5a1.5 1.5 0 010 3H9m0 0h5" />
    </svg>
  ),
  spark: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8}>
      <path
        d="M12 3v4M12 17v4M5 12H1M23 12h-4M5.6 5.6l2.5 2.5M15.9 15.9l2.5 2.5M18.4 5.6l-2.5 2.5M8.1 15.9l-2.5 2.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  alert: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2}>
      <path
        d="M12 8v5M12 17h.01M10.3 3.9 2.4 18a1.9 1.9 0 001.7 2.9h15.8a1.9 1.9 0 001.7-2.9L13.7 3.9a1.9 1.9 0 00-3.4 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  face: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.7}>
      <circle cx="12" cy="9" r="4" />
      <path d="M5.5 20a6.5 6.5 0 0113 0" strokeLinecap="round" />
    </svg>
  ),
  hanger: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.7}>
      <path
        d="M12 7a2 2 0 112-2M12 7v2.5L3.5 15a1.5 1.5 0 00.9 2.7h15.2a1.5 1.5 0 00.9-2.7L12 9.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  move: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8}>
      <path
        d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  pinch: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8}>
      <path
        d="M9 11V5a2 2 0 014 0v6M13 7a2 2 0 014 0v6c0 3.3-2.7 6-6 6s-6-2.7-6-6v-2l2.5.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  reset: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8}>
      <path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.3M3 3v4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  trash: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8}>
      <path
        d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  info: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
    </svg>
  ),
  wifi: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8}>
      <path d="M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M2 9a15 15 0 0120 0" strokeLinecap="round" />
      <circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  star: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 2}>
      <path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.6 5.7 21l2.3-7.1-6-4.5h7.6z" />
    </svg>
  ),
  gem: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8} strokeLinejoin="round">
      <path d="M6 3h12l3 6-9 12L3 9l3-6zM3 9h18M9 3l-3 6 6 12M15 3l3 6-6 12" />
    </svg>
  ),
  gemFill: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" {...p}>
      <path d="M6 3h12l3 6-9 12L3 9l3-6z" />
    </svg>
  ),
  cloud: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 18a4 4 0 01-.5-7.97A5.5 5.5 0 0117.9 9.5 3.75 3.75 0 0117.5 18H7z" />
    </svg>
  ),
  phone: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="3" width="10" height="18" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  ),
  ghost: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 20V11a7 7 0 0114 0v9l-2.5-1.5L14 20l-2-1.5L10 20l-2.5-1.5L5 20z" />
      <path d="M9.5 10h.01M14.5 10h.01" />
    </svg>
  ),
  card: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19M6 14.5h4" />
    </svg>
  ),
  logout: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
  user: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" />
    </svg>
  ),
  home: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11l8-6.5L20 11M6 9.6V19a1 1 0 001 1h10a1 1 0 001-1V9.6" />
    </svg>
  ),
  grid: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8}>
      <rect x="4" y="4" width="7" height="7" rx="1.6" />
      <rect x="13" y="4" width="7" height="7" rx="1.6" />
      <rect x="4" y="13" width="7" height="7" rx="1.6" />
      <rect x="13" y="13" width="7" height="7" rx="1.6" />
    </svg>
  ),
  users: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.7} strokeLinecap="round">
      <circle cx="8.5" cy="8" r="3.1" />
      <path d="M2.5 19c.6-3 2.8-4.5 6-4.5" />
      <circle cx="16.5" cy="9" r="2.7" />
      <path d="M14 14.8c3-.3 5.3 1.1 6 4.2" />
    </svg>
  ),
  sparkle: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.6} strokeLinejoin="round">
      <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z" />
      <path d="M18.5 14.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
    </svg>
  ),
  gear: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.7} strokeLinecap="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9L5.3 5.3" />
    </svg>
  ),
  dots: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <circle cx="5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="19" cy="12" r="1.9" />
    </svg>
  ),
  open: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 5h5v5M19 5l-8 8M18 13v5a1 1 0 01-1 1H6a1 1 0 01-1-1V7a1 1 0 011-1h5" />
    </svg>
  ),
  layers: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />
    </svg>
  ),
  pencil: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4L19 9a2 2 0 00-3-3L5 17v3zM14 7l3 3" />
    </svg>
  ),
  key: (p: IconProps) => (
    <svg {...base(p)} strokeWidth={p.strokeWidth ?? 1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="15" r="4.5" />
      <path d="M11.2 11.8L20 3M16 7l2.5 2.5M18.5 4.5L21 7" />
    </svg>
  ),
  apple: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M16.4 12.9c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.3 2.8 2.2 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-1.1 2.7-2.1.8-1.2 1.2-2.4 1.2-2.4s-2.3-.9-2.3-3.5zM14.2 5.9c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.1z" />
    </svg>
  ),
  google: (p: IconProps) => (
    <svg viewBox="0 0 24 24" {...p}>
      <path
        fill="#4285F4"
        d="M22 12.2c0-.7-.06-1.4-.18-2.05H12v3.9h5.6a4.8 4.8 0 01-2.08 3.15v2.6h3.36C20.84 18 22 15.4 22 12.2z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.36-2.6c-.93.62-2.12.98-3.26.98-2.5 0-4.62-1.69-5.38-3.96H3.16v2.68A10 10 0 0012 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.62 13.99a6 6 0 010-3.98V7.33H3.16a10 10 0 000 9.34l3.46-2.68z"
      />
      <path
        fill="#EA4335"
        d="M12 6.06c1.47 0 2.78.5 3.82 1.5l2.85-2.85C16.96 3.06 14.7 2 12 2A10 10 0 003.16 7.33l3.46 2.68C7.38 7.75 9.5 6.06 12 6.06z"
      />
    </svg>
  ),
};

export type IconName = keyof typeof Icon;
