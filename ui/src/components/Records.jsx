// Records (brief-v3 item 5): each game that set a new best game time,
// newest first, with how much it beat the best before it. The same games
// as the diamonds on the trend chart, under the top-bar filters but no
// date range. About 8 rows show; the rest scroll inside the card.
// `summary` is useApi("/summary").
import {
  Alert,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { clock, dateOnly, secs } from "../format.js";
import { GameLink } from "./GameTable.jsx";

const num = { fontFamily: "mono", fontSize: 14, textAlign: "right", py: 0 };

/** "3.2 s" under a minute, "1:05.0" from there. */
const beatBy = (ms) => (ms < 60_000 ? `${secs(ms)} s` : clock(ms));

export default function Records({ summary }) {
  const records = summary.data?.records;
  return (
    <Paper
      component="section"
      aria-labelledby="records-title"
      sx={{ p: 2.5, flex: "1 1 420px", minWidth: 0 }}
    >
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 1,
          mb: 1.5,
        }}
      >
        <Typography id="records-title" variant="h2" component="h2">
          Records
        </Typography>
        <Typography variant="caption" component="span">
          {records ? `${records.length} new best game times` : "…"}
        </Typography>
      </Box>
      {summary.error ? (
        <Alert severity="error">{summary.error.message}</Alert>
      ) : null}
      {records && !records.length ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          No finished games match these filters.
        </Typography>
      ) : null}
      {records?.length ? (
        // Scrolls on its own, so it takes focus for the arrow keys.
        <Box
          role="region"
          aria-label="Records, newest first"
          tabIndex={0}
          sx={{
            maxHeight: 400,
            overflow: "auto",
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: "primary.main",
              outlineOffset: 2,
            },
          }}
        >
          <Table stickyHeader sx={{ minWidth: 320 }}>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell align="right">Time</TableCell>
                <TableCell align="right">Beat previous by</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.game_id}>
                  <TableCell sx={{ py: 0 }}>
                    <GameLink game={r}>{dateOnly(r.started_at)}</GameLink>
                  </TableCell>
                  <TableCell sx={num}>{clock(r.durationMs)}</TableCell>
                  <TableCell
                    sx={{
                      ...num,
                      color: r.beatByMs == null ? "text.secondary" : undefined,
                    }}
                  >
                    {r.beatByMs == null ? "first finish" : beatBy(r.beatByMs)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : null}
    </Paper>
  );
}
