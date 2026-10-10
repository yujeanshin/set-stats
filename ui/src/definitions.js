// Short definitions for the info tooltips, in one place so the wording
// stays the same everywhere. Taken from docs/design/brief.md (section 5),
// docs/schema.md and docs/design/brief-v2.md; change them together. The
// break and bad-timing thresholds come from lib/metrics.js (pure, no
// imports), so the wording follows the code if they change.
import { BREAK_FACTOR, INSTANT_GAP_MS } from "../../lib/metrics.js";
import { MIN_EXPECTED } from "../../lib/setTypes.js";

export { BREAK_FACTOR, INSTANT_GAP_MS, MIN_EXPECTED };

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
  // Set types page (brief-v2 part 2)
  picks: "Finds where the set I took is of this type.",
  expected:
    "How many picks this type would get if I took a set at random from the board each time: for each find, the share of the board's sets that are of this type, added up.",
  ratio:
    "Picks ÷ Expected. 1.0 is chance; above 1 I favor this type, below 1 I under-pick it. The bar is a 95% interval around the ratio (exact Poisson for Picks, Expected fixed); the line marks 1.0.",
  takeRate:
    "Of the finds where at least one set of this type was on the board, the share where I took one. It depends on how many other sets were on the board, which is why Ratio is the main measure.",
  typeMedian:
    "Median find time over the finds where I took this type, with how many finds that is (n). A find time covers the whole board, not only this type. With Drop breaks on, breaks are left out of this column only.",
  lowData: `Expected is under ${MIN_EXPECTED}: too few chances for the ratio to mean much.`,
  blindSpots: `The patterns with the lowest Ratio whose whole 95% interval is below 1, among those with Expected of at least ${MIN_EXPECTED}.`,
  nFreshGroup:
    "Sets on the board grouped by how many of their cards are fresh: dealt since my previous find. Each game's first find is left out, since it has no previous find.",
};
