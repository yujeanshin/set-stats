// A table of games, one row each: when it was played (a link that opens
// the game as a dialog over the page, App.jsx), sets, time, pace, status
// and tags. Used by Recent games and the calendar's day panel.
import {
  Box,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { clock, dateTime, secs } from "../format.js";
import { colors } from "../theme.js";

const num = { fontFamily: "mono", fontSize: 14, textAlign: "right", py: 0 };

export function BestBadge() {
  return (
    <Box
      component="span"
      sx={{
        ml: 0.75,
        px: 1,
        py: "2px",
        border: `1.5px solid ${colors.record}`,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        // Darker than the record orange so the text passes 4.5:1 on white.
        color: "#8a4700",
        whiteSpace: "nowrap",
      }}
    >
      Best time
    </Box>
  );
}

/** On a game whose timestamps are off; the time stats skip it by default. */
export function BadTimingTag() {
  return (
    <Box
      component="span"
      title="Two sets in this game are under 100 ms apart, which no one can do, so its times are off. Skip bad timing leaves it out of the stats."
      sx={{
        ml: 0.75,
        px: 1,
        py: "2px",
        border: `1.5px solid ${colors.controlBorder}`,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: "text.secondary",
        whiteSpace: "nowrap",
        cursor: "help",
      }}
    >
      Bad timing
    </Box>
  );
}

/** A link to a game that opens it as a dialog over the current page. */
export function GameLink({ game, children, ...props }) {
  const location = useLocation();
  return (
    <Link
      component={RouterLink}
      to={{ pathname: `/games/${game.game_id}`, search: location.search }}
      state={{ backgroundLocation: location }}
      underline="hover"
      {...props}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 44,
        fontWeight: 500,
        ...props.sx,
      }}
    >
      {children}
    </Link>
  );
}

/**
 * games: rows from the API (gameRow in lib/api.js). best: the id that gets
 * the Best time badge. played: how the first column shows started_at.
 * empty: the text for no rows.
 */
export default function GameTable({
  games,
  best,
  played = dateTime,
  playedLabel = "Played",
  empty,
}) {
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table sx={{ minWidth: 560 }}>
        <TableHead>
          <TableRow>
            <TableCell>{playedLabel}</TableCell>
            <TableCell align="right">Sets</TableCell>
            <TableCell align="right">Time</TableCell>
            <TableCell align="right">Pace</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {games.map((g) => {
            const done = g.status === "done";
            return (
              <TableRow key={g.game_id}>
                <TableCell sx={{ py: 0 }}>
                  <GameLink game={g}>{played(g.started_at)}</GameLink>
                </TableCell>
                <TableCell sx={num}>{g.sets}</TableCell>
                <TableCell
                  sx={{ ...num, color: done ? undefined : "text.secondary" }}
                >
                  {done ? clock(g.durationMs) : "n/a"}
                </TableCell>
                <TableCell sx={num}>
                  {g.paceMs == null ? "–" : `${secs(g.paceMs)} s`}
                </TableCell>
                <TableCell
                  sx={{ py: 0, color: done ? undefined : "text.secondary" }}
                >
                  {done ? "Done" : "Unfinished"}
                  {g.game_id === best ? <BestBadge /> : null}
                  {g.bad_timing ? <BadTimingTag /> : null}
                </TableCell>
              </TableRow>
            );
          })}
          {empty && !games.length ? (
            <TableRow>
              <TableCell colSpan={5} sx={{ color: "text.secondary" }}>
                {empty}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </Box>
  );
}
