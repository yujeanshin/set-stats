import { Alert, Box, Link } from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { clock, dateOnly, dateTime, deltaText, secs } from "../format.js";
import Tile from "./Tile.jsx";

// Most glanced at first (brief-v3 item 1).
const LABELS = [
  "Average game time, last 5 games",
  "Average pace, last 5 games",
  "Fastest game",
  "Games finished / started",
];

/** "± 0.4" using fmt, or "" when there is no standard deviation (n < 2). */
const plusMinus = (sd, fmt) => (sd == null ? "" : `± ${fmt(sd)}`);
const shortClock = (ms) => clock(ms, { tenths: false });

/**
 * The fastest game's date, linking to it. Like the games list, it opens as
 * a dialog over the dashboard (App.jsx).
 */
function FastestLink({ game }) {
  const location = useLocation();
  return (
    <Link
      component={RouterLink}
      to={{ pathname: `/games/${game.game_id}`, search: location.search }}
      state={{ backgroundLocation: location }}
      underline="hover"
      title={`Open this game, played ${dateTime(game.started_at)}`}
      sx={{ fontFamily: "fontFamily", fontWeight: 600 }}
    >
      {dateOnly(game.started_at)}
    </Link>
  );
}

/**
 * The four headline tiles (brief 6.3, order and deltas from brief-v3 item
 * 1). `summary` is useApi("/summary").
 */
export default function HeadlineTiles({ summary }) {
  const { data, error } = summary;
  if (error) return <Alert severity="error">{error.message}</Alert>;
  const h = data?.headline;
  const tiles = h
    ? [
        {
          label: LABELS[0],
          value: shortClock(h.gameTime.avg),
          suffix: plusMinus(h.gameTime.sd, shortClock),
          note: deltaText(h.gameTime.delta, "time"),
        },
        {
          label: LABELS[1],
          value: secs(h.pace.avg),
          suffix: [plusMinus(h.pace.sd, secs), "s / set"]
            .filter(Boolean)
            .join(" "),
          note: deltaText(h.pace.delta, "pace"),
        },
        {
          label: LABELS[2],
          value: clock(h.fastestMs),
          suffix: h.fastestGame ? (
            <>
              on <FastestLink game={h.fastestGame} />
            </>
          ) : null,
        },
        {
          label: LABELS[3],
          value: h.finished,
          suffix: `/ ${h.started}`,
          suffixSize: 18,
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
