// Games table (brief 6.8): newest first, 20 rows at a time, each linking to
// its single game view. The current fastest game gets a "Best time" badge.
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { getJson } from "../api.js";
import { useFilters } from "../filters.js";
import { clock, dateTime, secs } from "../format.js";
import { colors } from "../theme.js";

const PAGE = 20;

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

export default function GamesList() {
  const [filters] = useFilters();
  const { search } = useLocation();
  const [state, setState] = useState({ games: [], total: null, best: null });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(filters);
  const { games, total, best } = state;

  // The filters the rows on screen belong to, so a "Load more" answer that
  // arrives after the filters changed is dropped.
  const current = useRef(key);
  current.current = key;

  function loadMore() {
    const asked = key;
    setLoading(true);
    getJson("/games", { ...filters, offset: games.length, limit: PAGE }).then(
      (body) => {
        if (current.current !== asked) return;
        setState((s) => ({ ...s, games: [...s.games, ...body.games] }));
        setLoading(false);
      },
      (e) => {
        if (current.current !== asked) return;
        setError(e);
        setLoading(false);
      },
    );
  }

  // Start over whenever the top-bar filters change. A newer request wins.
  useEffect(() => {
    let live = true;
    setLoading(true);
    getJson("/games", { ...filters, offset: 0, limit: PAGE }).then(
      (body) => {
        if (!live) return;
        setState({
          games: body.games,
          total: body.total,
          best: body.bestGameId,
        });
        setError(null);
        setLoading(false);
      },
      (e) => {
        if (!live) return;
        setError(e);
        setLoading(false);
      },
    );
    return () => {
      live = false;
    };
  }, [key]);

  return (
    <Paper component="section" aria-label="Games" sx={{ p: 2.5 }}>
      <Typography variant="h2" component="h2" sx={{ mb: 1.5 }}>
        Games
      </Typography>
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      <Box sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 600 }}>
          <TableHead>
            <TableRow>
              <TableCell>Played</TableCell>
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
                    <Link
                      component={RouterLink}
                      to={{ pathname: `/games/${g.game_id}`, search }}
                      underline="hover"
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        minHeight: 44,
                        fontWeight: 500,
                      }}
                    >
                      {dateTime(g.started_at)}
                    </Link>
                  </TableCell>
                  <TableCell sx={num}>{g.sets}</TableCell>
                  <TableCell
                    sx={{
                      ...num,
                      color: done ? undefined : "text.secondary",
                    }}
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
                  </TableCell>
                </TableRow>
              );
            })}
            {total === 0 ? (
              <TableRow>
                <TableCell colSpan={5} sx={{ color: "text.secondary" }}>
                  No games match these filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Box>
      {total != null && games.length < total ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Button
            variant="outlined"
            disabled={loading}
            onClick={loadMore}
            sx={{ px: 3 }}
          >
            {loading ? "Loading…" : "Load more"}
          </Button>
        </Box>
      ) : null}
    </Paper>
  );
}
