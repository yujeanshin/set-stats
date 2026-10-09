import { Alert, Box } from "@mui/material";
import { clock, secs } from "../format.js";
import Tile from "./Tile.jsx";

const LABELS = [
  "Games finished / started",
  "Fastest game",
  "Average pace, last 5 games",
  "Average game time, last 5 games",
];

/** "± 0.4" using fmt, or "" when there is no standard deviation (n < 2). */
const plusMinus = (sd, fmt) => (sd == null ? "" : `± ${fmt(sd)}`);
const shortClock = (ms) => clock(ms, { tenths: false });

/** The four headline tiles (brief 6.3). `summary` is useApi("/summary"). */
export default function HeadlineTiles({ summary }) {
  const { data, error } = summary;
  if (error) return <Alert severity="error">{error.message}</Alert>;
  const h = data?.headline;
  const tiles = h
    ? [
        {
          label: LABELS[0],
          value: h.finished,
          suffix: `/ ${h.started}`,
          suffixSize: 18,
        },
        { label: LABELS[1], value: clock(h.fastestMs) },
        {
          label: LABELS[2],
          value: secs(h.pace.avg),
          suffix: [plusMinus(h.pace.sd, secs), "s / set"]
            .filter(Boolean)
            .join(" "),
          accent: true,
        },
        {
          label: LABELS[3],
          value: shortClock(h.gameTime.avg),
          suffix: plusMinus(h.gameTime.sd, shortClock),
        },
      ]
    : LABELS.map((label) => ({ label, value: "…" }));
  return (
    <Box
      component="section"
      aria-label="Summary"
      sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}
    >
      {tiles.map((t) => (
        <Tile key={t.label} {...t} />
      ))}
    </Box>
  );
}
