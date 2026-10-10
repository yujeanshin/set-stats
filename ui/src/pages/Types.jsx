// Set types tab (brief-v2 part 2): which kinds of sets I pick more or less
// often than chance, and how fast. Normal mode, solo games, my finds only.
// Broad to specific: the 4 n_diff groups, blind spots, the 15 patterns
// (click one for recent examples), then sets by how many cards are fresh.
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useApi } from "../api.js";
import { maskLabel, nDiffLabel } from "../cardFace.js";
import DiffMarks from "../components/DiffMarks.jsx";
import FilterBar from "../components/FilterBar.jsx";
import InfoTip from "../components/InfoTip.jsx";
import RangeControls, { rangeParams } from "../components/RangeControls.jsx";
import Tile from "../components/Tile.jsx";
import TypeExamples from "../components/TypeExamples.jsx";
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
                      fontFamily: "mono",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "text.secondary",
                    }}
                  >
                    ratio {ratioText(r.ratio)} ({intervalText(r.low, r.high)}){" "}
                    <Box component="span" sx={{ whiteSpace: "nowrap" }}>
                      · E {countText(r.expected)}
                    </Box>
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

/** The first column of the pattern table: marks, label, and a button to show examples. */
const patternColumn = {
  label: "Pattern",
  info: DEFINITIONS.diffMarks,
  render: (r, selected) => (
    <Box
      component="button"
      type="button"
      aria-pressed={selected}
      aria-label={`${maskLabel(r.key)}: ${selected ? "hide" : "show"} recent finds`}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1.25,
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
  const [selected, setSelected] = useState(null);
  // mode is always normal here; leave it out so the request is the same
  // whichever mode the dashboard had selected.
  const params = { ...filters, mode: undefined, ...rangeParams(range) };
  const { data, error } = useApi("/types", params);
  const ready = data && !data.needsRebuild;
  // A blind spot opens its examples under the pattern table.
  const select = (key) => {
    setSelected(key);
    document
      .getElementById("patterns")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <Stack spacing={3}>
      <FilterBar normalOnly notes={FILTER_NOTES} />
      <Paper component="section" aria-label="Games" sx={{ p: 2.5 }}>
        <Stack
          direction="row"
          useFlexGap
          spacing={2.5}
          sx={{ flexWrap: "wrap", alignItems: "flex-end" }}
        >
          <RangeControls value={range} onChange={setRange} idPrefix="types-" />
          <Typography
            sx={{
              ml: "auto",
              fontFamily: "mono",
              fontSize: 15,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
            }}
          >
            {ready
              ? `${countText(data.games)} games · ${countText(data.finds)} finds`
              : "…"}
          </Typography>
        </Stack>
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
            onSelect={select}
          />
          <Paper
            component="section"
            aria-label="Patterns"
            id="patterns"
            sx={{ p: 2.5, scrollMarginTop: 16 }}
          >
            <Heading>All 15 patterns</Heading>
            <Typography variant="caption" component="p" sx={{ mt: 0.5 }}>
              Grouped by how many features differ. Click a pattern for recent
              finds of it. Greyed rows have Expected under {data.minExpected}.
            </Typography>
            <TypeTable
              label="Patterns"
              rows={data.patterns}
              first={patternColumn}
              groups={N_DIFF_GROUPS}
              group={(r) => r.nDiff}
              onSelect={setSelected}
              selected={selected}
            />
            {selected ? <TypeExamples mask={selected} params={params} /> : null}
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
              takeRate={false}
            />
          </Paper>
        </>
      ) : null}
    </Stack>
  );
}
