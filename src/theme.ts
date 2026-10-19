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

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 6 },
  colors: { brand },
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
