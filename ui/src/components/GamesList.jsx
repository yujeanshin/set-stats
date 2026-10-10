// Games table (brief 6.8): newest first, 20 rows at a time, each linking to
// its single game view. The current fastest game gets a "Best time" badge.
import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Paper, Typography } from "@mui/material";
import { getJson } from "../api.js";
import { useFilters } from "../filters.js";
import GameTable from "./GameTable.jsx";

const PAGE = 20;

export default function GamesList() {
  const [filters] = useFilters();
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
      <GameTable
        games={games}
        best={best}
        empty={total === 0 ? "No games match these filters." : null}
      />
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
