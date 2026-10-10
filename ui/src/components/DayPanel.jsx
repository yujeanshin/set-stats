// One calendar day's games, opened by clicking a day (brief-v3 item 3):
// a summary line, then every game that day, oldest first. Shown inside the
// calendar card, under the grid.
import { Alert, Box, IconButton, Typography } from "@mui/material";
import { useApi } from "../api.js";
import { useFilters } from "../filters.js";
import { clock, localTimeZone, secs } from "../format.js";
import { CloseIcon } from "./GameDialog.jsx";
import GameTable, { GameLink } from "./GameTable.jsx";

/** "Saturday, October 10, 2026" for a "YYYY-MM-DD" key. */
function dayTitle(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    dateStyle: "full",
  });
}

const timeOnly = (ms) =>
  new Date(ms).toLocaleTimeString(undefined, { timeStyle: "short" });

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The summary line: games, average pace, best time (linked to its game). */
function Summary({ summary: s }) {
  const parts = [
    <span key="games">
      {plural(s.games, "game")}
      {s.games ? `, ${s.finished} finished` : ""}
    </span>,
  ];
  if (s.paceMs != null)
    parts.push(
      <span key="pace">
        average pace{" "}
        <Box component="span" sx={{ fontFamily: "mono", fontWeight: 600 }}>
          {secs(s.paceMs)} s
        </Box>
      </span>,
    );
  if (s.bestMs != null)
    parts.push(
      <span key="best">
        best time{" "}
        <GameLink
          game={{ game_id: s.bestGameId }}
          aria-label={`Best time ${clock(s.bestMs)}: open this game`}
          sx={{ minHeight: 0, fontFamily: "mono", fontWeight: 600 }}
        >
          {clock(s.bestMs)}
        </GameLink>
      </span>,
    );
  return (
    <Typography variant="body2" component="p" sx={{ mt: 0.5 }}>
      {parts.flatMap((p, i) => {
        // Each part on one line; the line breaks between them.
        const part = (
          <Box component="span" key={i} sx={{ whiteSpace: "nowrap" }}>
            {p}
          </Box>
        );
        return i ? [" · ", part] : [part];
      })}
      {s.leftOut ? (
        <Box component="span" sx={{ color: "text.secondary" }}>
          {" "}
          ({plural(s.leftOut, "game")} with bad timing left out of the times)
        </Box>
      ) : null}
    </Typography>
  );
}

/** day: "YYYY-MM-DD". onClose: closes the panel. */
export default function DayPanel({ day, onClose, id }) {
  const [filters] = useFilters();
  const { data, error } = useApi("/day", {
    ...filters,
    date: day,
    tz: localTimeZone(),
  });
  return (
    <Box
      component="section"
      id={id}
      aria-labelledby="day-panel-title"
      sx={{ mt: 2.5, pt: 2, borderTop: 1, borderColor: "divider" }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id="day-panel-title" variant="h2" component="h3">
            {dayTitle(day)}
          </Typography>
          {data ? <Summary summary={data.summary} /> : null}
        </Box>
        <IconButton
          aria-label="Close this day"
          onClick={onClose}
          sx={{ width: 44, height: 44, mt: -1 }}
        >
          <CloseIcon />
        </IconButton>
      </Box>
      {error ? (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error.message}
        </Alert>
      ) : null}
      {data?.games.length ? (
        <Box sx={{ mt: 1, maxHeight: 480, overflowY: "auto" }}>
          <GameTable
            games={data.games}
            best={data.bestGameId}
            played={timeOnly}
            playedLabel="Started"
          />
        </Box>
      ) : null}
      {!data && !error ? (
        <Typography variant="body2" sx={{ mt: 1 }}>
          Loading…
        </Typography>
      ) : null}
    </Box>
  );
}
