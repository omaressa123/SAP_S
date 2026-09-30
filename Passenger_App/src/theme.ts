/**
 * Theme extracted from themes1.jpeg
 *
 * 071739 — deep navy (primary / header / text on light)
 * 4B6382 — slate blue (secondary / active tab / info)
 * A4B5C4 — dusty blue-grey (muted text, borders, disabled)
 * CDD5DB — pale mist (app background tint)
 * A68868 — warm taupe (accent / CTA secondary)
 * E3C39D — light sand (highlight / boarding pass / warning)
 */

export const palette = {
  navy: '#071739',
  slate: '#4B6382',
  dustyBlue: '#A4B5C4',
  mist: '#CDD5DB',
  taupe: '#A68868',
  sand: '#E3C39D',
  white: '#FFFFFF',
  ink: '#0B1526',
} as const;

export const colors = {
  // Backgrounds
  appBackground: '#E8ECF1', // mist-tinted for readability (derived from CDD5DB)
  card: palette.white,
  cardAlt: '#F4F6F8',
  header: palette.navy,
  headerText: '#FFFFFF',
  tabBar: palette.navy,
  tabActive: palette.sand,
  tabInactive: palette.dustyBlue,

  // Text
  textPrimary: palette.navy,
  textSecondary: palette.slate,
  textMuted: '#6B7B8F',
  textOnDark: '#FFFFFF',

  // Actions
  primary: palette.navy,
  primaryText: '#FFFFFF',
  secondary: palette.slate,
  accent: palette.taupe,
  highlight: palette.sand,

  // Borders / dividers
  border: palette.dustyBlue,
  divider: palette.mist,

  // Status
  success: '#2E7D5B',
  warning: '#9A6B2E', // taupe-darkened for contrast on light bg
  danger: '#B3261E',
  info: palette.slate,

  // Boarding pass
  passHeader: palette.navy,
  passBody: palette.white,
  passStripe: palette.sand,
  passAccent: palette.taupe,

  // Status dots
  onTime: '#2E7D5B',
  delayed: '#B26A00',
  alert: '#B3261E',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 28, fontWeight: '800' as const },
  title: { fontSize: 22, fontWeight: '700' as const },
  subtitle: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  bodyBold: { fontSize: 14, fontWeight: '700' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  captionBold: { fontSize: 12, fontWeight: '700' as const },
  mono: { fontSize: 13, fontWeight: '600' as const, fontFamily: 'monospace' as const },
} as const;
