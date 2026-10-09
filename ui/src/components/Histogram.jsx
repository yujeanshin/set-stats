// Histogram beside the Over time chart (brief 6.5): the plotted metric over
// the same selection. Bins come from the API; this only labels and draws them.
import { Box, Typography } from "@mui/material";
import { Bar } from "react-chartjs-2";
import "../chart.js";
import { clock } from "../format.js";
import { colors } from "../theme.js";

/** Bin edge label: "8s" / "8.5s" for pace, "3:30" for game time. */
function edge(ms, metric) {
  if (metric === "time") return clock(ms, { tenths: false });
  return `${Number((ms / 1000).toFixed(2))}s`;
}

export default function Histogram({ series, metric }) {
  const bins = series.data?.histogram?.bins ?? [];
  const title =
    metric === "time" ? "Game time distribution" : "Pace distribution";
  const games = (n) => `${n} ${n === 1 ? "game" : "games"}`;
  const data = {
    // The open-ended last bin, if any, is labelled "40s+".
    labels: bins.map(
      (b) => `${edge(b.from, metric)}${b.to == null ? "+" : ""}`,
    ),
    datasets: [
      {
        data: bins.map((b) => b.count),
        backgroundColor: colors.scale[3],
        hoverBackgroundColor: colors.accentDark,
        borderRadius: { topLeft: 3, topRight: 3 },
        borderSkipped: "bottom",
        categoryPercentage: 1,
        barPercentage: 0.85,
      },
    ],
  };
  const options = {
    interaction: { mode: "index", intersect: false },
    scales: {
      x: {
        grid: { display: false },
        border: { color: colors.controlBorder },
        ticks: { maxRotation: 0, autoSkipPadding: 12 },
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { drawTicks: false },
        ticks: { precision: 0, padding: 6 },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          title(items) {
            const b = bins[items[0].dataIndex];
            return b.to == null
              ? `${edge(b.from, metric)} or more`
              : `${edge(b.from, metric)} to ${edge(b.to, metric)}`;
          },
          label: (item) => games(item.raw),
        },
      },
    },
  };
  return (
    <Box
      sx={{
        flex: "1 1 240px",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
      }}
    >
      <Typography
        component="h3"
        sx={{ m: 0, fontSize: 14, fontWeight: 600, color: "text.secondary" }}
      >
        {title}
      </Typography>
      <Box sx={{ position: "relative", height: 240 }}>
        <Bar
          data={data}
          options={options}
          fallbackContent={`${title}: ${bins
            .map((b) => `${edge(b.from, metric)}: ${games(b.count)}`)
            .join(", ")}`}
        />
      </Box>
    </Box>
  );
}
