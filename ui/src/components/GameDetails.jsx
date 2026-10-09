// Single game view (brief 7), shared by the full page (pages/Game.jsx) and
// the dialog over the games list (GameDialog.jsx).
import { Alert, Box, Stack, Typography } from "@mui/material";
import { useApi } from "../api.js";
import { useFilters } from "../filters.js";
import FindTimesChart from "./FindTimesChart.jsx";
import Tile from "./Tile.jsx";
import { clock, dateTime, secs } from "../format.js";

/** "Normal · Solo · Done · 3:54.8 · 25 sets · <id>" */
function Subtitle({ game }) {
  const parts = [
    game.modeName,
    game.n_players === 1 ? "Solo" : `${game.n_players} players`,
    game.status === "done" ? "Done" : "Unfinished",
    game.durationMs == null ? null : clock(game.durationMs),
    `${game.sets} ${game.sets === 1 ? "set" : "sets"}`,
  ].filter(Boolean);
  return (
    <Typography color="text.secondary">
      {parts.join(" · ")} ·{" "}
      <Box component="span" sx={{ fontFamily: "mono", fontSize: 14 }}>
        {game.game_id}
      </Box>
    </Typography>
  );
}

/**
 * Heading, summary tiles and find times chart for one game.
 * header: shown above the heading. titleId: id for the heading.
 */
export default function GameDetails({ id, header, titleId }) {
  const [{ dropBreaks }] = useFilters();
  const { data: game, error } = useApi(`/games/${encodeURIComponent(id)}`, {
    dropBreaks,
  });
  const s = game?.stats;
  const v = (ms) => (game ? secs(ms) : "…");
  const tiles = [
    {
      label: "Average pace",
      value: v(s?.mean),
      suffix: "s / set",
      accent: true,
    },
    { label: "Median pace", value: v(s?.median), suffix: "s / set" },
    {
      label: "Std dev of pace",
      value: v(s?.stdev),
      suffix: s?.stdev == null ? "" : "s",
    },
    {
      label: "Range of find times",
      value: s?.min == null ? v(null) : `${secs(s.min)}`,
      suffix: s?.min == null ? "" : `to ${secs(s.max)} s`,
    },
  ];
  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        {header}
        <Typography variant="h1" component="h1" id={titleId}>
          {game ? dateTime(game.started_at) : error ? "Game" : "…"}
        </Typography>
        {game ? <Subtitle game={game} /> : null}
      </Stack>
      {error ? (
        <Alert severity="error">{error.message}</Alert>
      ) : (
        <>
          <Box
            component="section"
            aria-label="Game summary"
            sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}
          >
            {tiles.map((t) => (
              <Tile key={t.label} size={28} {...t} />
            ))}
          </Box>
          {game ? (
            <FindTimesChart findTimes={game.findTimes} medianMs={s.median} />
          ) : null}
        </>
      )}
    </Stack>
  );
}
