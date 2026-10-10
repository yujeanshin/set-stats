// Step through my finds in one game, showing the board just before each
// (brief-v2). Full game page only. The board is in landscape layout, as in
// Positions.jsx: position i is at row i % 3, column floor(i / 3). The chosen
// set has a teal ring; with "Show other sets" on, the other sets are listed
// beside the board and hovering or focusing one outlines its cards.
import {
  Box,
  Button,
  FormControlLabel,
  Paper,
  Slider,
  Switch,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { DEFINITIONS } from "../definitions.js";
import { secs } from "../format.js";
import { colors } from "../theme.js";
import DiffMarks from "./DiffMarks.jsx";
import InfoTip from "./InfoTip.jsx";
import SetCard from "./SetCard.jsx";

const CARD = 64; // board card width, px

/** Arrow keys step the replay, unless focus is in a control that uses them. */
function useArrowKeys(onStep) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      // The slider's thumb is an <input>, and handles arrows itself.
      if (t.closest?.("input, textarea, select, [contenteditable=true]"))
        return;
      if (e.key === "ArrowLeft") onStep(-1);
      else if (e.key === "ArrowRight") onStep(1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStep]);
}

/** One label: value pair in the per-step stats row, with its definition. */
function Stat({ label, info, children }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
      <Typography variant="subtitle2" component="span">
        {label} <InfoTip title={info} label={label.toLowerCase()} />
      </Typography>
      <Box component="span" sx={{ fontFamily: "mono", fontSize: 17 }}>
        {children}
      </Box>
    </Box>
  );
}

/** The board, 3 rows, filled column by column. */
function Board({ find, hovered }) {
  const chosen = new Set(find.sets.find((s) => s.is_chosen).positions);
  const outlined = new Set(hovered?.positions ?? []);
  return (
    <Box
      role="group"
      aria-label={`Board before find, ${find.board_size} cards`}
      sx={{
        display: "grid",
        gridTemplateRows: "repeat(3, auto)",
        gridAutoFlow: "column",
        gap: "10px",
        justifyContent: "start",
        p: "6px",
      }}
    >
      {find.board.map((card, pos) => (
        <Box
          key={pos}
          title={`Position ${pos + 1}`}
          sx={{
            lineHeight: 0,
            borderRadius: "8px",
            boxShadow: chosen.has(pos) ? `0 0 0 4px ${colors.chosen}` : "none",
            outline: outlined.has(pos) ? `3px dashed ${colors.text}` : "none",
            outlineOffset: chosen.has(pos) ? "7px" : "3px",
          }}
        >
          <SetCard card={card} width={CARD} />
        </Box>
      ))}
    </Box>
  );
}

function ChosenTag() {
  return (
    <Box
      component="span"
      sx={{
        px: 0.75,
        py: 0.25,
        borderRadius: "4px",
        bgcolor: colors.chosen,
        color: "#ffffff",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      chosen
    </Box>
  );
}

/** Every set on the board, chosen first; hover or focus one to outline it. */
function SetList({ find, hovered, onHover }) {
  return (
    <Box
      component="ul"
      aria-label={`${find.n_sets} sets on board`}
      sx={{ listStyle: "none", m: 0, p: 0, minWidth: 260, flex: "1 1 260px" }}
    >
      {find.sets.map((s) => (
        <Box component="li" key={s.set_id}>
          <Box
            component="button"
            type="button"
            onMouseEnter={() => onHover(s.set_id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(s.set_id)}
            onBlur={() => onHover(null)}
            aria-label={`${s.is_chosen ? "Chosen set" : "Set"}: ${s.cards.join(" ")}`}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              width: "100%",
              minHeight: 44,
              px: 1,
              py: 0.5,
              border: 0,
              borderRadius: "8px",
              font: "inherit",
              color: "text.primary",
              textAlign: "left",
              cursor: "default",
              bgcolor: hovered === s.set_id ? colors.scale[0] : "transparent",
            }}
          >
            <Box sx={{ display: "flex", gap: "3px", lineHeight: 0 }}>
              {s.cards.map((c) => (
                <SetCard key={c} card={c} width={22} />
              ))}
            </Box>
            <DiffMarks mask={s.diff_mask} />
            <Typography
              variant="caption"
              component="span"
              sx={{ fontFamily: "mono" }}
            >
              {s.n_fresh == null ? "" : `fresh ${s.n_fresh}`}
            </Typography>
            {s.is_chosen ? <ChosenTag /> : null}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/**
 * finds: my finds from /games/:id/finds, oldest first. step: index into
 * finds; onStep(index) moves to another. breaksDropped: tag break finds,
 * which the stats leave out (the board is the same either way).
 * scrollIntoView: scroll to the replay once, when the page was opened at a
 * find (the game page's ?find=<seq>, which sets the starting step).
 */
export default function BoardReplay({
  finds,
  step,
  onStep,
  breaksDropped,
  scrollIntoView = false,
}) {
  const ref = useRef(null);
  useEffect(() => {
    if (scrollIntoView) ref.current?.scrollIntoView({ block: "start" });
  }, [scrollIntoView]);
  const [showSets, setShowSets] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const n = finds.length;
  const go = (i) => {
    setHoveredId(null);
    onStep(Math.min(n - 1, Math.max(0, i)));
  };
  useArrowKeys((d) => go(step + d));
  const find = finds[step];
  const chosen = find.sets.find((s) => s.is_chosen);
  const hovered = find.sets.find((s) => s.set_id === hoveredId) ?? null;
  return (
    <Paper
      ref={ref}
      component="section"
      aria-label="Board replay"
      sx={{ p: 2.5, scrollMarginTop: 16 }}
    >
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
        }}
      >
        <Typography variant="h2" component="h2">
          Board replay
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => go(step - 1)}
            disabled={step === 0}
            aria-label="Previous find"
          >
            ← Prev
          </Button>
          <Typography
            aria-live="polite"
            sx={{ fontFamily: "mono", minWidth: 96, textAlign: "center" }}
          >
            {step + 1} / {n}
          </Typography>
          <Button
            variant="outlined"
            onClick={() => go(step + 1)}
            disabled={step === n - 1}
            aria-label="Next find"
          >
            Next →
          </Button>
        </Box>
      </Box>
      <Box sx={{ px: 1, mt: 1 }}>
        <Slider
          value={step + 1}
          min={1}
          max={n}
          step={1}
          onChange={(e, v) => go(v - 1)}
          valueLabelDisplay="auto"
          aria-label="Find number"
        />
      </Box>
      <Box
        sx={{ display: "flex", flexWrap: "wrap", columnGap: 4, rowGap: 1.5 }}
      >
        <Stat label="Find" info={DEFINITIONS.find}>
          {step + 1}
        </Stat>
        <Stat label="Find time" info={DEFINITIONS.findTime}>
          {secs(find.elapsed_ms)} s
          {breaksDropped && find.break ? (
            <Typography variant="caption" component="span">
              {" "}
              break, left out of the stats
            </Typography>
          ) : null}
        </Stat>
        <Stat label="Sets on board" info={DEFINITIONS.setsOnBoard}>
          {find.n_sets}
        </Stat>
        <Stat label="Cards left in deck" info={DEFINITIONS.deckLeft}>
          {find.deck_left}
        </Stat>
        <Stat label="Fresh in chosen set" info={DEFINITIONS.fresh}>
          {chosen.n_fresh == null ? "–" : `${chosen.n_fresh} of 3`}
        </Stat>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: 3,
          mt: 2.5,
        }}
      >
        <Box sx={{ overflowX: "auto", maxWidth: "100%" }}>
          <Board find={find} hovered={hovered} />
        </Box>
        <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
          <FormControlLabel
            control={
              <Switch
                checked={showSets && find.n_sets > 1}
                disabled={find.n_sets < 2}
                onChange={(e) => {
                  setShowSets(e.target.checked);
                  setHoveredId(null);
                }}
              />
            }
            label={`Show other sets (${find.n_sets - 1})`}
            sx={{ minHeight: 44, ml: 0 }}
          />
          {showSets ? (
            <Typography variant="caption" component="p" sx={{ mb: 0.5 }}>
              Hover a set to outline it on the board.{" "}
              <InfoTip
                title={DEFINITIONS.diffMarks}
                label="the C S F N marks"
              />{" "}
              <InfoTip title={DEFINITIONS.fresh} label="fresh" />
            </Typography>
          ) : null}
          {showSets ? (
            <SetList find={find} hovered={hoveredId} onHover={setHoveredId} />
          ) : (
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1.25, mt: 1 }}
            >
              <DiffMarks mask={chosen.diff_mask} />
              <ChosenTag />
              <InfoTip
                title={DEFINITIONS.diffMarks}
                label="the C S F N marks"
              />
            </Box>
          )}
        </Box>
      </Box>
    </Paper>
  );
}
