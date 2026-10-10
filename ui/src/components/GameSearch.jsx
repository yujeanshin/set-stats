// Find a game by its id (brief-v3 item 5): any part of the three-word id,
// or a pasted game URL. Searches every started game on the server,
// whatever the top-bar filters and mode, and lists the newest matches,
// each opening its game as a dialog.
import { useEffect, useId, useState } from "react";
import { Alert, Box, Stack, TextField, Typography } from "@mui/material";
import { useApi } from "../api.js";
import { clock, dateTime } from "../format.js";
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

function Results({ data, q }) {
  if (!data.total)
    return (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        No started game&apos;s id contains &ldquo;{data.q || q}&rdquo;.
      </Typography>
    );
  return (
    <>
      <Typography variant="caption" component="p">
        {data.total === 1
          ? "1 game"
          : data.total > data.games.length
            ? `The ${data.games.length} newest of ${data.total} games`
            : `${data.total} games`}{" "}
        with &ldquo;{data.q}&rdquo; in the id
      </Typography>
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
        {data.games.map((g) => (
          <Box
            component="li"
            key={g.game_id}
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              columnGap: 1.5,
              "& + &": { borderTop: 1, borderColor: "divider" },
            }}
          >
            <GameLink game={g}>{dateTime(g.started_at)}</GameLink>
            <Typography variant="body2" component="span">
              {g.modeName}
              {g.n_players > 1 ? `, ${g.n_players} players` : ""}
            </Typography>
            <Typography
              component="span"
              sx={{
                fontFamily: "mono",
                fontSize: 14,
                color: g.durationMs == null ? "text.secondary" : undefined,
              }}
            >
              {g.durationMs == null ? "unfinished" : clock(g.durationMs)}
            </Typography>
            <Typography
              variant="body2"
              component="span"
              sx={{
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
