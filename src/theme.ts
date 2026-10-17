import {
  ActionIcon,
  Badge,
  Button,
  Modal,
  NavLink,
  Paper,
  SegmentedControl,
  Table,
  createTheme,
  type MantineColorsTuple,
} from '@mantine/core';

// Cor da marca (violeta, base #7c5cff = tom 5). Para trocar a cor base do sistema, altere esta paleta.
// Tons usados como cor principal: claro = 6 (#6d4aff), escuro = 4 (#8b73ff).
const brand: MantineColorsTuple = [
  '#f1edff', '#e2dbff', '#c8bbff', '#ac9aff', '#8b73ff',
  '#7c5cff', '#6d4aff', '#5b38e6', '#4a2cc0', '#3a2299',
];

// Tons escuros neutros (substituem o cinza padrão do Mantine no tema dark):
// 6 = cards/inputs/dropdowns (#1d1d1f), 7 = fundo da página (#141414), 4 = bordas/hover.
const dark: MantineColorsTuple = [
  '#d5d5d8', '#b4b4b8', '#929296', '#737378', '#2e2e32',
  '#252528', '#1d1d1f', '#141414', '#0f0f10', '#0a0a0b',
];

export const theme = createTheme({
  colors: { brand, dark },
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 4 },
  defaultRadius: 'md',
  radius: { xs: '6px', sm: '8px', md: '12px', lg: '16px', xl: '24px' },
  fontFamily: '"Figtree Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily: '"Bricolage Grotesque Variable", "Figtree Variable", system-ui, sans-serif',
    fontWeight: '700',
  },
  components: {
    Paper: Paper.extend({
      defaultProps: { radius: 'lg' },
      styles: { root: { boxShadow: 'var(--duro-shadow)' } },
    }),
    Button: Button.extend({
      defaultProps: { radius: 'md' },
      styles: { root: { fontWeight: 600 } },
    }),
    ActionIcon: ActionIcon.extend({ defaultProps: { radius: 'md' } }),
    Badge: Badge.extend({
      defaultProps: { radius: 'xl', tt: 'none' },
      styles: { root: { fontWeight: 600 } },
    }),
    SegmentedControl: SegmentedControl.extend({ defaultProps: { radius: 'xl' } }),
    Modal: Modal.extend({
      defaultProps: { radius: 'lg', centered: true, overlayProps: { blur: 4, backgroundOpacity: 0.45 } },
      styles: { title: { fontFamily: 'var(--mantine-font-family-headings)', fontWeight: 700, fontSize: 18 } },
    }),
    Table: Table.extend({
      styles: {
        th: {
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--mantine-color-dimmed)',
          borderBottomColor: 'var(--duro-border)',
        },
        td: { borderBottomColor: 'var(--duro-border)' },
      },
    }),
    NavLink: NavLink.extend({
      styles: {
        root: { borderRadius: 'var(--mantine-radius-md)', marginBottom: 2, fontWeight: 500 },
      },
    }),
  },
});
