// Visual design tokens from docs/design/brief.md section 8, as an MUI theme.
// Components get colors, fonts, radii and the 44px control height from here.
import { createTheme } from "@mui/material";

export const colors = {
  page: "#fafafa",
  surface: "#ffffff",
  border: "#e4e0e8",
  controlBorder: "#cfc9d6",
  text: "#1f1b24",
  muted: "#5b5564",
  accent: "#800080",
  accentDark: "#5c005c",
  // Light to dark. White text only on the last two.
  scale: ["#ebe8ee", "#dcc3dc", "#c08ac0", "#a04da0", "#800080"],
  record: "#b25c00",
  // The chosen set in the board replay (brief-v2). Not the accent: card
  // purple is #800080 too. White text on it passes AA (4.7:1).
  chosen: "#2f7f86",
  // The position heatmap (brief-v3 item 8), by distance from an even
  // spread: neutral, then 4 steps each way, nearest first. Above is the
  // accent scale; below is teal at about the same lightness. Every step
  // keeps its text at 4.5:1 or more: dark text on the first two steps,
  // white on the last two.
  heat: {
    neutral: "#ecebee",
    above: ["#dcc3dc", "#c08ac0", "#a04da0", "#800080"],
    below: ["#b3d7db", "#5fa9b0", "#2f7f86", "#1b555a"],
  },
  // The Set types trend's 4 lines, 1 to 4 features differing. Each is 3:1
  // or more against the card, and every pair passes the dataviz validator
  // for color-vision deficiency with all pairs compared, since lines cross.
  nDiff: ["#2a78d6", "#b85c00", "#0f7f5e", "#a0349b"],
};

// 1120px of content plus 24px side padding, as a border-box width.
export const contentWidth = 1120 + 48;

const textFont = 'Figtree, system-ui, -apple-system, "Segoe UI", sans-serif';
const monoFont = '"IBM Plex Mono", ui-monospace, Menlo, monospace';

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: colors.accent,
      dark: colors.accentDark,
      contrastText: "#ffffff",
    },
    background: { default: colors.page, paper: colors.surface },
    text: { primary: colors.text, secondary: colors.muted },
    divider: colors.border,
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: textFont,
    fontSize: 15,
    // Use with sx={{ fontFamily: "mono" }} for every statistic and axis label.
    mono: monoFont,
    h1: { fontSize: 26, fontWeight: 700 },
    h2: { fontSize: 17, fontWeight: 700 },
    body1: { fontSize: 15, lineHeight: 1.4 },
    body2: { fontSize: 14 },
    caption: { fontSize: 13, color: colors.muted },
    // Tile and control labels.
    subtitle2: { fontSize: 13, fontWeight: 600, color: colors.muted },
    button: { textTransform: "none", fontWeight: 600, fontSize: 15 },
  },
  components: {
    MuiPaper: {
      defaultProps: { variant: "outlined" },
      styleOverrides: {
        outlined: { borderColor: colors.border, borderRadius: 10 },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { minHeight: 44 },
        outlined: { borderColor: colors.accent },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          minHeight: 44,
          padding: "0 14px",
          whiteSpace: "nowrap",
          textTransform: "none",
          fontSize: 15,
          fontWeight: 500,
          color: colors.text,
          borderColor: colors.controlBorder,
          "&.Mui-selected": {
            backgroundColor: colors.accent,
            color: "#ffffff",
            fontWeight: 600,
            "&:hover": { backgroundColor: colors.accentDark },
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { minHeight: 44, backgroundColor: colors.surface },
        notchedOutline: { borderColor: colors.controlBorder },
      },
    },
    MuiTabs: { styleOverrides: { indicator: { height: 3 } } },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          padding: "0 18px",
          textTransform: "none",
          fontSize: 15,
          fontWeight: 500,
          "&.Mui-selected": { fontWeight: 600 },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { padding: "12px 8px", borderBottomColor: colors.border },
        head: {
          padding: "10px 8px",
          fontSize: 13,
          fontWeight: 600,
          color: colors.muted,
          borderBottomColor: colors.controlBorder,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: colors.text, fontSize: 13 },
      },
    },
  },
});

export default theme;
