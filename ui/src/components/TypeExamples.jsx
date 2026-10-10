// Recent finds of one pattern on the Set types page, from /api/types/examples
// (preloaded for all 15 patterns). ExamplePreview is the hover tooltip: the
// latest few, cards and find time. ExampleFinds is the row expanded on
// click: up to 6, each linking to the full game page with the board replay
// opened at that find (?find=<seq>). finds is undefined while loading.
import { Box, Link, Typography } from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { dateOnly, secs } from "../format.js";
import SetCard from "./SetCard.jsx";

const PREVIEW = 3;

/** The game page link for one find; the game page's back link returns here. */
function findLink(f, location) {
  const params = new URLSearchParams(location.search);
  for (const k of ["range", "from", "to", "lastN"]) params.delete(k);
  params.set("find", f.seq);
  return {
    to: {
      pathname: `/games/${encodeURIComponent(f.game_id)}`,
      search: `?${params}`,
    },
    state: {
      back: {
        pathname: location.pathname,
        search: location.search,
        label: "Set types",
      },
    },
  };
}

function Cards({ cards, width }) {
  return (
    <Box sx={{ display: "flex", gap: "3px", lineHeight: 0 }}>
      {cards.map((c) => (
        <SetCard key={c} card={c} width={width} />
      ))}
    </Box>
  );
}

const EMPTY = "No finds of this pattern in these games.";

/** Tooltip body: the latest few finds, on the tooltip's dark background. */
export function ExamplePreview({ finds }) {
  if (!finds) return "Loading recent finds…";
  if (!finds.length) return EMPTY;
  return (
    <Box sx={{ py: 0.5 }}>
      <Box sx={{ fontWeight: 600, mb: 0.75 }}>Latest finds</Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        {finds.slice(0, PREVIEW).map((f) => (
          <Box
            key={`${f.game_id} ${f.seq}`}
            sx={{ display: "flex", alignItems: "center", gap: 1.25 }}
          >
            <Cards cards={f.cards} width={20} />
            <Box component="span" sx={{ fontFamily: "mono" }}>
              {secs(f.elapsed_ms)} s
            </Box>
            <Box component="span" sx={{ opacity: 0.8 }}>
              {dateOnly(f.started_at)}
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 0.75, opacity: 0.8 }}>Click for more.</Box>
    </Box>
  );
}

/** The expanded row: up to 6 finds, each opening its game at that find. */
export function ExampleFinds({ finds }) {
  const location = useLocation();
  if (!finds || !finds.length)
    return (
      <Typography variant="body2">
        {finds ? EMPTY : "Loading recent finds…"}
      </Typography>
    );
  return (
    <Box
      component="ul"
      aria-label="Recent finds"
      sx={{
        listStyle: "none",
        m: 0,
        p: 0,
        display: "flex",
        flexWrap: "wrap",
        gap: 1.5,
      }}
    >
      {finds.map((f) => {
        const { to, state } = findLink(f, location);
        return (
          <Box component="li" key={`${f.game_id} ${f.seq}`}>
            <Link
              component={RouterLink}
              to={to}
              state={state}
              underline="hover"
              aria-label={`${dateOnly(f.started_at)}, find time ${secs(f.elapsed_ms)} s: open the game at this find`}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.75,
                p: 1,
                minWidth: 112,
                borderRadius: "8px",
                bgcolor: "background.paper",
                border: 1,
                borderColor: "divider",
                color: "text.primary",
                "&:hover, &:focus-visible": { borderColor: "primary.main" },
              }}
            >
              <Cards cards={f.cards} width={28} />
              <Typography variant="caption" component="span">
                {dateOnly(f.started_at)}
              </Typography>
              <Box component="span" sx={{ fontFamily: "mono", fontSize: 14 }}>
                {secs(f.elapsed_ms)} s
              </Box>
            </Link>
          </Box>
        );
      })}
    </Box>
  );
}
