// Friend-vs-Friend contender palettes — shared by the upload page and the result
// page so a given matchup shows the SAME colours in both places.
//
// A is always Solo Scan's brand accent (icy blue); B varies per matchup among Solo's
// other distinct accents (lime / gold / red) so each matchup looks a bit different
// while both sides keep a clear, on-brand identity. (cyan clashes with the icy A;
// magenta is the blue+pink combo the user disliked — both left out.) Applied by
// overriding --icy / --gold on the page root.
export const PALETTES: { a: string; b: string }[] = [
  { a: '#83b4ff', b: '#b6ff3c' }, // icy / lime
  { a: '#83b4ff', b: '#ffcf66' }, // icy / gold
  { a: '#83b4ff', b: '#ff3b49' }, // icy / red
];

/**
 * Deterministic palette pick from the matchup seed (the two names), so a given
 * battle keeps its colours across the upload page, the result deck, and a saved
 * battle — instead of flickering a new pair each view.
 */
export function pickPalette(seed: string): { a: string; b: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}
