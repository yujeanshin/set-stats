// Find a game by its id (brief-v3 item 5): any part of the three-word id,
// or a pasted game URL. Searches every started game on the server,
// whatever the top-bar filters and mode. Matches are grouped into Play
// again series (lib/search.js): one row per series, headed by its first
// game, with a button that lists the rest of the series' matches. Each
// game opens as a dialog.
import { useEffect, useId, useState } from "react";
import { Alert, Box, Stack, TextField, Typography } from "@mui/material";
import { useApi } from "../api.js";
import { clock, countText, dateTime } from "../format.js";
import { GameLink } from "./GameTable.jsx";

/** The text after the user stops typing for `ms`. */
function useDebounced(value, ms) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

const plural = (n, word) => `${countText(n)} ${word}${n === 1 ? "" : "s"}`;

/**
 * One game: when (opening it), mode and players, time, and its id. One
 * row on wider screens; on phones, date and time, then mode and id.
 */
function GameLine({ game: g }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        columnGap: 1.5,
        pb: { xs: 0.75, sm: 0 },
      }}
    >
      <GameLink game={g}>{dateTime(g.started_at)}</GameLink>
      <Typography
        component="span"
        sx={{
          order: { xs: 1, sm: 2 },
          fontFamily: "mono",
          fontSize: 14,
          color: g.durationMs == null ? "text.secondary" : undefined,
        }}
      >
        {g.durationMs == null ? "unfinished" : clock(g.durationMs)}
      </Typography>
      {/* Phones only: ends the first line. */}
      <Box
        aria-hidden="true"
        sx={{ order: 1, flexBasis: "100%", display: { sm: "none" } }}
      />
      <Typography
        variant="body2"
        component="span"
        sx={{ order: { xs: 2, sm: 1 } }}
      >
        {g.modeName}
        {g.n_players > 1 ? `, ${g.n_players} players` : ""}
      </Typography>
      <Typography
        variant="body2"
        component="span"
        sx={{
          order: 3,
          ml: "auto",
          color: "text.secondary",
          fontFamily: "mono",
          fontSize: 13,
          overflowWrap: "anywhere",
        }}
      >
        {g.game_id}
      </Typography>
    </Box>
  );
}

/**
 * One Play again series: its head game, and when more of the series
 * matched, a button that loads and lists them under it.
 */
function Series({ series, q }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const more = useApi(open ? "/games/search" : null, {
    q,
    series: series.base,
  });
  const others = more.data?.games.filter(
    (g) => g.game_id !== series.head.game_id,
  );
  return (
    <Box
      component="li"
      sx={{ "& + &": { borderTop: 1, borderColor: "divider" } }}
    >
      <GameLine game={series.head} />
      {series.more ? (
        <Box
          component="button"
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            minHeight: 44,
            mt: -0.5,
            p: 0,
            border: 0,
            bgcolor: "transparent",
            font: "inherit",
            fontSize: 14,
            fontWeight: 600,
            color: "primary.main",
            cursor: "pointer",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden="true"
            style={{
              transform: open ? "rotate(90deg)" : "none",
              transition: "transform 120ms",
            }}
          >
            <path
              d="M4 2 L8 6 L4 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {open ? "Hide" : "Show"} {plural(series.more, "more Play again game")}
        </Box>
      ) : null}
      {open ? (
        <Box
          id={listId}
          sx={{
            ml: 1,
            mb: 1,
            pl: 1.5,
            borderLeft: 2,
            borderColor: "divider",
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {more.error ? (
            <Alert severity="error">{more.error.message}</Alert>
          ) : !others ? (
            <Typography variant="body2" sx={{ py: 1 }}>
              Loading…
            </Typography>
          ) : (
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
              {others.map((g) => (
                <Box component="li" key={g.game_id}>
                  <GameLine game={g} />
                </Box>
              ))}
            </Box>
          )}
        </Box>
      ) : null}
    </Box>
  );
}

function Results({ data, q }) {
  if (!data.total)
    return (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        No started game&apos;s id contains &ldquo;{data.q || q}&rdquo;.
      </Typography>
    );
  const shown = data.series.length;
  return (
    <>
      <Typography variant="caption" component="p">
        {plural(data.total, "game")} with &ldquo;{data.q}&rdquo; in the id
        {data.total > 1
          ? `, in ${countText(data.seriesTotal)} Play again series`
          : ""}
        {data.seriesTotal > shown
          ? `. Showing the ${shown} with the newest games.`
          : "."}
      </Typography>
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
        {data.series.map((s) => (
          <Series key={s.base} series={s} q={data.q} />
        ))}
      </Box>
    </>
  );
}

export default function GameSearch() {
  const id = useId();
  const [text, setText] = useState("");
  const q = useDebounced(text.trim(), 250);
  const { data, error } = useApi(q ? "/games/search" : null, { q });
  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      <Typography variant="subtitle2" component="label" htmlFor={id}>
        Find a game by id or link
      </Typography>
      <TextField
        id={id}
        type="search"
        size="small"
        placeholder="e.g. tired-property"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
        sx={{ maxWidth: 420 }}
        slotProps={{ htmlInput: { spellCheck: false } }}
      />
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {/* Outlined, so the matches don't read as part of Recent games. */}
      <Box
        aria-live="polite"
        sx={
          q && data
            ? {
                px: 1.5,
                py: 1,
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
                bgcolor: "background.default",
              }
            : undefined
        }
      >
        {q && data ? <Results data={data} q={q} /> : null}
      </Box>
    </Stack>
  );
}
