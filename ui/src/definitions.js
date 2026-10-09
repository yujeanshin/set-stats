// Short definitions for the info tooltips, in one place so the wording
// stays the same everywhere. Taken from docs/design/brief.md (section 5),
// docs/schema.md and docs/design/brief-v2.md; change them together. The
// break and bad-timing thresholds come from lib/metrics.js (pure, no
// imports), so the wording follows the code if they change.
import { BREAK_FACTOR, INSTANT_GAP_MS } from "../../lib/metrics.js";

export { BREAK_FACTOR, INSTANT_GAP_MS };

export const DEFINITIONS = {
  find: "A set the site accepted from me. Selections it ignored (a taken or repeated card) don't count.",
  findTime: `Time from the previous set anyone found to this one; the first find is timed from the game's start. With Drop breaks on, a gap over ${BREAK_FACTOR}× the game's median gap is a break: the stats leave it out, the board replay doesn't.`,
  setsOnBoard:
    "Every set on the board just before this find, including the ones I didn't take.",
  deckLeft: "Cards not yet dealt to the board.",
  fresh:
    "How many of the chosen set's cards weren't on the board at the previous find, i.e. were dealt since then. Shown as – for a game's first find.",
  diffMarks:
    "C color, S shape, F fill (shade), N number. Filled: that feature differs across the three cards. Hollow: it's the same on all three.",
};
