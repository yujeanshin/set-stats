// Set types tab (brief-v2 part 2): which kinds of sets I pick more or less
// often than chance, and how fast. Normal mode, solo games, my finds only.
// Broad to specific: the 4 n_diff groups, blind spots, the 15 patterns
// (hover one for its latest finds, click to expand it with more), then sets
// by how many cards are fresh.
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useApi } from "../api.js";
import { maskLabel, nDiffLabel } from "../cardFace.js";
import DiffMarks from "../components/DiffMarks.jsx";
import FilterBar from "../components/FilterBar.jsx";
import InfoTip from "../components/InfoTip.jsx";
import RangeControls, { rangeParams } from "../components/RangeControls.jsx";
import Tile from "../components/Tile.jsx";
import { ExampleFinds, ExamplePreview } from "../components/TypeExamples.jsx";
import TypeTable from "../components/TypeTable.jsx";
import { DEFINITIONS, INSTANT_GAP_MS } from "../definitions.js";
import { useFilters, useTypeRange } from "../filters.js";
import { countText, intervalText, ratioText } from "../format.js";

const FILTER_NOTES = {
  dropBreaks:
    "Leave breaks out of the Median find time columns only. Picks, Expected and Ratio count every find.",
  skipBadTiming: `Leave out games with two sets under ${INSTANT_GAP_MS} ms apart from this whole page: if those sets were queued during a dropped connection, the replayed board may not be what was on screen.`,
};

function Heading({ children, info, label }) {
  return (
    <Typography
      variant="h2"
      component="h2"
      sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
    >
      {children}
      {info ? <InfoTip title={info} label={label} /> : null}
    </Typography>
  );
}

/** a. The 4 n_diff groups: Ratio and its interval, at a glance. */
function Summary({ rows }) {
  return (
    <Box component="section" aria-label="Ratio by features that differ">
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
        <Typography variant="subtitle2" component="h2">
          Ratio to chance, by how many features differ
        </Typography>
        <InfoTip title={DEFINITIONS.ratio} label="ratio" />
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
        {rows.map((r) => (
          <Tile
            key={r.key}
            label={nDiffLabel(r.key)}
            value={ratioText(r.ratio)}
            suffix={r.ratio == null ? "" : `95% ${intervalText(r.low, r.high)}`}
            size={28}
          />
        ))}
      </Box>
    </Box>
  );
}

/** b. Up to 3 patterns I clearly under-pick, or a note that none qualify. */
function BlindSpots({ keys, patterns, minExpected, onSelect }) {
  const rows = keys.map((k) => patterns.find((p) => p.key === k));
  return (
    <Paper component="section" aria-label="Blind spots" sx={{ p: 2.5 }}>
      <Heading info={DEFINITIONS.blindSpots} label="blind spots">
        Blind spots
      </Heading>
      {!rows.length ? (
        <Typography variant="body2" sx={{ mt: 1 }}>
          None: no pattern with Expected of at least {minExpected} has its whole
          95% interval below 1.
        </Typography>
      ) : (
        <Box
          component="ol"
          sx={{
            m: 0,
            mt: 1,
            p: 0,
            listStyle: "none",
            display: "flex",
            flexWrap: "wrap",
            gap: 1.5,
          }}
        >
          {rows.map((r) => (
            <Box component="li" key={r.key} sx={{ flex: "1 1 240px" }}>
              <Button
                variant="outlined"
                onClick={() => onSelect(r.key)}
                sx={{
                  width: "100%",
                  justifyContent: "flex-start",
                  gap: 1.25,
                  py: 1,
                  color: "text.primary",
                  textAlign: "left",
                }}
              >
                <DiffMarks mask={r.key} />
                <Box
                  component="span"
                  sx={{ display: "flex", flexDirection: "column" }}
                >
                  <span>{maskLabel(r.key)}</span>
                  <Box
                    component="span"
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      fontFamily: "mono",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "text.secondary",
                    }}
                  >
                    <span>
                      ratio {ratioText(r.ratio)} ({intervalText(r.low, r.high)})
                    </span>
                    <span>E {countText(r.expected)}</span>
                  </Box>
                </Box>
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}

function Chevron({ open }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
      style={{
        flexShrink: 0,
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
  );
}

/**
 * The first column of the pattern table: a chevron, the marks and the
 * label, as a button that opens the row (the row's click does the work).
 */
const patternColumn = {
  label: "Pattern",
  info: DEFINITIONS.diffMarks,
  render: (r, open) => (
    <Box
      component="button"
      type="button"
      aria-expanded={open}
      aria-label={`${maskLabel(r.key)}: ${open ? "hide" : "show"} recent finds`}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        minHeight: 40,
        p: 0,
        border: 0,
        bgcolor: "transparent",
        font: "inherit",
        color: "inherit",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <Chevron open={open} />
      <DiffMarks mask={r.key} />
      {maskLabel(r.key)}
    </Box>
  ),
};

const freshColumn = {
  label: "Fresh cards",
  info: DEFINITIONS.nFreshGroup,
  render: (r) => (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        minHeight: 40,
        alignItems: "center",
        fontFamily: "mono",
      }}
    >
      {r.key} of 3
    </Box>
  ),
};

const N_DIFF_GROUPS = [1, 2, 3, 4].map((n) => ({
  key: n,
  label: nDiffLabel(n),
}));

export default function Types() {
  const [filters] = useFilters();
  const [range, setRange] = useTypeRange();
  const [expanded, setExpanded] = useState(null);
  // mode is always normal here; leave it out so the request is the same
  // whichever mode the dashboard had selected.
  const params = { ...filters, mode: undefined, ...rangeParams(range) };
  const { data, error } = useApi("/types", params);
  const ready = data && !data.needsRebuild;
  // Every pattern's latest finds in one request, once the tables are in, so
  // hovering a row shows them without waiting. Cached like any response.
  const examplesApi = useApi(ready ? "/types/examples" : null, params);
  const examples = examplesApi.data?.examples;
  // undefined while loading; [] for a pattern with no finds in scope.
  const findsOf = (key) => (examples ? (examples[key] ?? []) : undefined);
  // A blind spot opens its row in the table and scrolls to it.
  const openPattern = (key) => {
    setExpanded(key);
    document
      .getElementById(`pattern-${key}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <Stack spacing={3}>
      <FilterBar normalOnly notes={FILTER_NOTES} />
      <Paper component="section" aria-label="Range" sx={{ p: 2.5 }}>
        <RangeControls
          value={range}
          onChange={setRange}
          scope={ready ? data.scope : null}
          extra={ready ? `${countText(data.finds)} finds` : null}
        />
      </Paper>
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {data?.needsRebuild ? (
        <Alert severity="info">
          The set-type tables are empty or out of date. Run npm run rebuild
          (about a minute), then reload.
        </Alert>
      ) : null}
      {ready ? (
        <>
          <Summary rows={data.nDiff} />
          <BlindSpots
            keys={data.blindSpots}
            patterns={data.patterns}
            minExpected={data.minExpected}
            onSelect={openPattern}
          />
          <Paper component="section" aria-label="Patterns" sx={{ p: 2.5 }}>
            <Heading>All 15 patterns</Heading>
            <Typography variant="caption" component="p" sx={{ mt: 0.5 }}>
              Grouped by how many features differ. Hover a pattern for its
              latest finds; click it for more, each opening its game at that
              find. Greyed rows have Expected under {data.minExpected}.
            </Typography>
            <TypeTable
              label="Patterns"
              rows={data.patterns}
              first={patternColumn}
              groups={N_DIFF_GROUPS}
              group={(r) => r.nDiff}
              expanded={expanded}
              onToggle={setExpanded}
              preview={(r) => <ExamplePreview finds={findsOf(r.key)} />}
              renderExpanded={(r) => <ExampleFinds finds={findsOf(r.key)} />}
              rowId={(r) => `pattern-${r.key}`}
            />
          </Paper>
          <Paper component="section" aria-label="Set after set" sx={{ p: 2.5 }}>
            <Heading info={DEFINITIONS.nFreshGroup} label="fresh cards">
              Set after set
            </Heading>
            <Typography variant="caption" component="p" sx={{ mt: 0.5 }}>
              Sets on the board by how many of their cards are fresh, over{" "}
              {countText(data.freshFinds)} finds (each game&apos;s first find is
              left out). Sets with 0 fresh cards were already on the board at my
              previous find and I passed over them then, so a low ratio for 0 is
              partly expected.
            </Typography>
            <TypeTable
              label="Set after set"
              rows={data.fresh}
              first={freshColumn}
            />
          </Paper>
        </>
      ) : null}
    </Stack>
  );
}
