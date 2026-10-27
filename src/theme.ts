import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Оранжевый акцент как в референсе (Vertix): основной оттенок — #f26b3a.
const brand: MantineColorsTuple = [
  '#fff1ec',
  '#ffe0d6',
  '#fbbfaa',
  '#f89c7c',
  '#f57f55',
  '#f3713f',
  '#f26b3a',
  '#d85a2b',
  '#c14e23',
  '#a8411a',
];

// Бирюзовый неон «денег» (пилот «Кино», 2026-10-27): хорошо, накоплено, влезает.
const neon: MantineColorsTuple = [
  '#e0fffc',
  '#c2fbf6',
  '#8ff5ec',
  '#5cefe2',
  '#3ee9da',
  '#2ee6d6',
  '#1fcdbe',
  '#12a89c',
  '#0a8278',
  '#035c55',
];

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 6 },
  colors: { brand, neon },
  fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif',
  headings: { fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif', fontWeight: '600' },
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    Button: { defaultProps: { radius: 'xl' } },
    // В референсе бейджи обычным регистром, а не ЗАГЛАВНЫМИ (как по умолчанию в Mantine).
    Badge: { defaultProps: { radius: 'sm', tt: 'none' } },
  },
});
