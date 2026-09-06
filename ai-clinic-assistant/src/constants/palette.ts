export const Palette = {
  // Backgrounds
  parchment: '#F5EDE0',
  parchmentDeep: '#EDE1CF',
  cream: '#FFFBF4',
  sand: '#E8D9C0',

  // Earth & accents
  earth: '#6B4423',
  earthDark: '#4A2E16',
  burgundy: '#8B2635',
  burgundyDark: '#6E1C29',
  burgundyLight: '#F3E1E3',
  gold: '#C9A24E',
  goldLight: '#F1E5C6',
  teal: '#2F6F6A',
  tealLight: '#D9E9E6',
  olive: '#5C7A3F',
  oliveLight: '#DDE6CF',

  // Text
  ink: '#2B1D14',
  inkSoft: '#4E3B2E',
  muted: '#7A6A5A',
  faint: '#A8988A',

  // Lines
  line: '#E2D3BE',
  lineStrong: '#C9B69A',

  // Status
  danger: '#B91C1C',
  dangerLight: '#FDE8E8',
  success: '#2F6F4E',
  successLight: '#DFF0E6',

  white: '#FFFFFF',
} as const;

export const Header = {
  background: Palette.burgundy,
  text: Palette.cream,
  subtle: 'rgba(255, 251, 244, 0.72)',
  chip: 'rgba(255, 251, 244, 0.16)',
  chipBorder: 'rgba(255, 251, 244, 0.32)',
} as const;
