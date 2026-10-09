import { Alert, Box, Container, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink, useLocation, useParams } from "react-router-dom";
import { useApi } from "../api.js";
import FindTimesChart from "../components/FindTimesChart.jsx";
import Tile from "../components/Tile.jsx";
import { clock, dateTime, secs } from "../format.js";
import { contentWidth } from "../theme.js";

function BackLink() {
  const { search } = useLocation();
  return (
    <Link
      component={RouterLink}
      to={{ pathname: "/", search }}
      underline="none"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        minHeight: 44,
        alignSelf: "flex-start",
        fontWeight: 600,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 3 L5 8 L10 13" />
      </svg>
      All games
    </Link>
  );
}

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

/** Single game view (brief 7). */
export default function Game() {
  const { id } = useParams();
  const { data: game, error } = useApi(`/games/${encodeURIComponent(id)}`);
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
    <Container maxWidth={false} sx={{ maxWidth: contentWidth, py: 3 }}>
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <BackLink />
          <Typography variant="h1" component="h1">
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
    </Container>
  );
}
