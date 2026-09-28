const midnight = {
  text: '#FFFFFF',
  tint: '#2563EB',
  background: '#0B1020',
  foreground: '#FFFFFF',
  card: '#151C30',
  cardForeground: '#FFFFFF',
  primary: '#2563EB',
  primaryForeground: '#FFFFFF',
  secondary: '#202A43',
  secondaryForeground: '#FFFFFF',
  muted: '#1B2439',
  mutedForeground: '#AAB3C5',
  accent: '#23304D',
  accentForeground: '#FFFFFF',
  destructive: '#EF5B67',
  destructiveForeground: '#FFFFFF',
  border: '#29334D',
  input: '#29334D',
  playerOne: '#3B82F6',
  playerTwo: '#8B5CF6',
  winner: '#FBBF24',
  success: '#34D399',
  overlay: 'rgba(3, 7, 18, 0.82)',
  handle: '#52617F',
};

const contrast = {
  ...midnight,
  background: '#070A14',
  card: '#1B2744',
  secondary: '#263657',
  muted: '#22304E',
  border: '#3D4E76',
  input: '#3D4E76',
};

const colors = {
  light: midnight,
  dark: midnight,
  radius: 18,
};

export const gameThemes = { midnight, contrast };
export type GameColors = typeof midnight;

export default colors;