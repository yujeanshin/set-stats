// Single game view (brief 7), shared by the full page (pages/Game.jsx) and
// the dialog over the games list (GameDialog.jsx).
import { Alert, Box, Link, Stack, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import { useApi } from "../api.js";
import { useFilters } from "../filters.js";
import { gameSite, gameUrl } from "../gameUrl.js";
import BoardReplay from "./BoardReplay.jsx";
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
 * Board data for one game from /games/:id/finds: my finds by seq, and why
 * there are none when board features can't be shown. The derived tables
 * only cover normal mode; multiplayer waits for its own design.
 */
function useBoards(id, game) {
  const { data } = useApi(
    game ? `/games/${encodeURIComponent(id)}/finds` : null,
  );
  return useMemo(() => {
    if (!game || !data) return { mine: [], note: null };
    if (data.normalOnly)
      return {
        mine: [],
        note: "Cards on hover and the board replay are for normal mode only.",
      };
    if (data.n_players > 1)
      return {
        mine: [],
        note: "Cards on hover and the board replay are for solo games for now; multiplayer comes later.",
      };
    const mine = data.finds.filter((f) => f.mine);
    if (!mine.length && game.findSeqs.length)
      return {
        mine,
        note: "No board data for this game yet. Run npm run rebuild:new to add it.",
      };
    return { mine, note: null };
  }, [game, data]);
}

/**
 * One bar per find time, matched to my finds by seq (not by index: with
 * breaks dropped, the i-th find time isn't always my i-th find).
 */
function timeBars(game, mine) {
  const number = new Map(mine.map((f, i) => [f.seq, i + 1]));
  const bySeq = new Map(mine.map((f) => [f.seq, f]));
  return game.findTimes.map((ms, i) => {
    const seq = game.findSeqs[i];
    return {
      ms,
      number: number.get(seq) ?? i + 1,
      find: bySeq.get(seq) ?? null,
      isBreak: false,
    };
  });
}

/**
 * One bar per find of mine, for the full page with the replay: bar i is
 * replay step i. Breaks stay in, greyed when the stats leave them out.
 */
const replayBars = (mine, dropBreaks) =>
  mine.map((f, i) => ({
    ms: f.elapsed_ms,
    number: i + 1,
    find: f,
    isBreak: dropBreaks && f.break,
  }));

/**
 * Heading, summary tiles and find times chart for one game, plus the board
 * replay when `replay` is set (the full page, not the dialog).
 * header: shown above the heading. titleId: id for the heading.
 */
export default function GameDetails({ id, header, titleId, replay = false }) {
  const [{ dropBreaks }] = useFilters();
  const { data: game, error } = useApi(`/games/${encodeURIComponent(id)}`, {
    dropBreaks,
  });
  const boards = useBoards(id, game);
  const withReplay = replay && boards.mine.length > 0;
  const bars = useMemo(
    () =>
      !game
        ? []
        : withReplay
          ? replayBars(boards.mine, dropBreaks)
          : timeBars(game, boards.mine),
    [game, boards, withReplay, dropBreaks],
  );
  const [step, setStep] = useState(0);
  const current = Math.min(step, Math.max(0, boards.mine.length - 1));
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
        {game ? (
          <Link
            href={gameUrl(game)}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
              alignSelf: "flex-start",
              fontWeight: 600,
            }}
          >
            Open on {gameSite(game).name}
          </Link>
        ) : null}
        {game?.bad_timing ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            Some sets in this game are under 100 ms apart, which no one can do,
            so its times are off. The dashboard leaves it out of the stats while
            Skip bad timing is on.
          </Alert>
        ) : null}
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
            <FindTimesChart
              bars={bars}
              medianMs={s.median}
              note={boards.note}
              selected={withReplay ? current : null}
              onSelect={withReplay ? setStep : null}
            />
          ) : null}
          {withReplay ? (
            <BoardReplay
              finds={boards.mine}
              step={current}
              onStep={setStep}
              breaksDropped={dropBreaks}
            />
          ) : null}
        </>
      )}
    </Stack>
  );
}
