/** Токены как в веб styles.css */
export type ColorScheme = 'light' | 'dark'

export const light = {
  bg: '#EBF0EF',
  card: '#FFFFFF',
  ink: '#12242B',
  mut: '#5E7078',
  line: '#D5DFDD',
  inc: '#0E8A6B',
  exp: '#C9473D',
  acc: '#1D4E5F',
  white: '#FFFFFF',
  onAcc: '#FFFFFF',
}

export const dark = {
  bg: '#0E1A1F',
  card: '#16262D',
  ink: '#E6EEF0',
  mut: '#8FA3AB',
  line: '#25393F',
  inc: '#3CC6A0',
  exp: '#F0776C',
  acc: '#245E72',
  white: '#FFFFFF',
  onAcc: '#FFFFFF',
}

export type Colors = typeof light

/** @deprecated используйте useTheme().colors */
export const colors = light

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
}

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
}
