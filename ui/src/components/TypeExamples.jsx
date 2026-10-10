// Up to 6 recent finds of one pattern on the Set types page: the cards I
// took, the date and the find time, each linking to the full game page with
// the board replay opened at that find (?find=<seq>).
import { Alert, Box, Link, Typography } from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useApi } from "../api.js";
import { maskLabel } from "../cardFace.js";
import { dateOnly, secs } from "../format.js";
import { colors } from "../theme.js";
import DiffMarks from "./DiffMarks.jsx";
import SetCard from "./SetCard.jsx";

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

/** mask: the selected pattern. params: the page's filters and range. */
export default function TypeExamples({ mask, params }) {
  const location = useLocation();
  const { data, error } = useApi("/types/examples", { ...params, mask });
  const finds = data?.finds;
  return (
    <Box
      component="section"
      aria-label={`Recent finds: ${maskLabel(mask)}`}
      sx={{
        mt: 2,
        p: 2,
        borderRadius: "8px",
        bgcolor: colors.page,
        border: 1,
        borderColor: "divider",
      }}
    >
      <Typography
        variant="subtitle2"
        component="h3"
        sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}
      >
        Recent finds: <DiffMarks mask={mask} /> {maskLabel(mask)}
      </Typography>
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {!finds ? (
        <Typography variant="body2">{error ? null : "…"}</Typography>
      ) : !finds.length ? (
        <Typography variant="body2">
          No finds of this pattern in these games.
        </Typography>
      ) : (
        <Box
          component="ul"
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
                  <Box sx={{ display: "flex", gap: "4px", lineHeight: 0 }}>
                    {f.cards.map((c) => (
                      <SetCard key={c} card={c} width={28} />
                    ))}
                  </Box>
                  <Typography variant="caption" component="span">
                    {dateOnly(f.started_at)}
                  </Typography>
                  <Box
                    component="span"
                    sx={{ fontFamily: "mono", fontSize: 14 }}
                  >
                    {secs(f.elapsed_ms)} s
                  </Box>
                </Link>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
