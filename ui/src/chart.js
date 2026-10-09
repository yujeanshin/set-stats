// Chart.js 4 is tree-shakeable: register the parts the app uses once, here,
// and take fonts and colors from the theme so charts match the page. Import
// this module (for its side effects) from every chart component.
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  TimeScale,
  Tooltip,
} from "chart.js";
import "chartjs-adapter-date-fns";
import theme, { colors } from "./theme.js";

Chart.register(
  LineController,
  BarController,
  LinearScale,
  TimeScale,
  CategoryScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
);

// Axis labels are statistics, so they use the number font (brief section 8).
Chart.defaults.font.family = theme.typography.mono;
Chart.defaults.font.size = 12;
Chart.defaults.color = colors.muted; // tick text
Chart.defaults.borderColor = colors.border; // grid and axis lines
Chart.defaults.animation = false;
Chart.defaults.maintainAspectRatio = false; // size from the parent box

const tooltip = Chart.defaults.plugins.tooltip;
tooltip.backgroundColor = colors.text;
tooltip.titleFont = {
  family: theme.typography.fontFamily,
  size: 13,
  weight: 600,
};
tooltip.bodyFont = { family: theme.typography.mono, size: 13 };
tooltip.padding = 10;
tooltip.displayColors = false;

export { Chart };
