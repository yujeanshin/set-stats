# set stats web UI: version 2

Version 2 adds card-level views on top of version 1 ([brief.md](brief.md)), in three parts. This file records what each part built, the definitions it added and the decisions behind it, in the same style as the version 1 decisions log. Where this file and brief.md disagree about version 2, this file wins.

1. **Cards** (this part): card rendering, the chosen set on hover, and a board replay.
2. Set-type analysis page.
3. The model.

Since version 2, Claude writes and commits the code directly. This replaces the "I type the code myself" rule and the stop-after-each-step build order in brief.md sections 3 and 10.

## Part 1: cards

### What was built

- **Card component** (`ui/src/components/SetCard.jsx`). It draws any card string as a vertical card, sized by a `width` prop (height is 1.6 × width), and is used in the chart tooltip (28px), the set list (22px) and on the board (64px). It draws the card exactly the way Set with Friends does and turns it a quarter turn, stripes included.
- **Card mapping** (`ui/src/cardFace.js`). This is the one place that says which digit is which feature and what each value means. `test/cardFace.test.js` checks it.
- **Hover cards in the find times chart**, in both the game dialog and the full page. The tooltip shows the find number, the find time, the three cards of the chosen set and four difference marks.
- **Board replay** on the full game page only (`ui/src/components/BoardReplay.jsx`). It shows the board just before each of my finds in landscape layout (3 rows; position `i` at row `i % 3`, column `floor(i / 3)`, as in the position heatmap), for boards of 12, 15 or 18 cards, or fewer near the end of a game. The chosen set has a teal ring. A "Show other sets" switch (off by default) lists every set on the board; hovering or focusing one outlines its cards on the board.
  - **Moving between finds:** Prev / Next, a slider, the left and right arrow keys, or clicking a bar in the chart.
  - **Shown for each find:** find number, find time, sets on board, cards left in deck, and how many of the chosen set's cards are fresh.
- **Definition tooltips:** an info button beside each term listed under Definitions below. The wording is in `ui/src/definitions.js`.
- **API:** `GET /api/games/:id/finds` returns every find in a game with its board and the sets on it. `GET /api/games/:id` gains `findSeqs`.

These only work for **normal mode**, because `finds` and `board_sets` only have rows for normal games. For other modes, the chart says "Cards on hover and the board replay are for normal mode only." **Multiplayer** games say they are coming later. A normal game whose rows haven't been derived yet says to run `npm run rebuild:new`.

### Definitions

These add to brief.md section 5 and match `ui/src/definitions.js`.

- **Find:** a set the site accepted from me (a `finds` row). Selections the site ignored, because they used a taken card or repeated a card, are not finds.
- **Find time:** as in brief.md: from the previous set anyone found, or from `started_at` for a game's first find, to this one. In the replay it is `finds.elapsed_ms`.
- **Break:** a gap over 10× its game's median gap (`breakFlags`, `lib/metrics.js`). With Drop breaks on, the stats leave breaks out; the board replay doesn't.
- **Sets on board:** every set on the board just before the find (`finds.n_sets`), including the ones I didn't take.
- **Cards left in deck:** cards not yet dealt to the board (`finds.deck_left`).
- **Fresh:** how many of a set's cards were not on the board at the previous find (`board_sets.n_fresh`). The previous find is anyone's; in a solo game that is my own previous find. It is shown as – for a game's first find.
- **Difference marks:** four squares in card order: C color, S shape, F fill (shade), N number. Filled means the feature differs across the three cards (`1` in `diff_mask`); hollow means it is the same on all three (`0`). The shade is F so the letter doesn't clash with S for shape.

### Card mapping and colors

Cards are 4-digit strings in the order color, shape, shade, number (schema.md). The digit values come from `src/components/SetCard.js` in ekzhang/setwithfriends at commit `dcd104cca74b06e8ebc396876e8c7e0e97c5d805` (the commit vendored in `vendor/setwithfriends/util.js`, MIT):

| digit | feature | 0        | 1               | 2       |
| ----- | ------- | -------- | --------------- | ------- |
| 1st   | color   | purple   | green           | red     |
| 2nd   | shape   | squiggle | oval            | diamond |
| 3rd   | shade   | solid    | empty (outline) | striped |
| 4th   | number  | 1        | 2               | 3       |

Set with Forks (eltoder/setwithfriends at the commit in `vendor/game.js`) decodes cards the same way through `cardTraits`, which is vendored. `test/cardFace.test.js` checks all 81 cards against it.

The card colors are `#800080`, `#008002` and `#ff0101`, from `lightTheme.custom.setCard` in upstream `src/themes.js`. The oval and diamond paths, the stripe pattern and the mask come from upstream `index.html`, and the card layout from `SetCard.js`. The red, green and purple in `vendor/game.js` are mode badge colors, not card colors.

### Decisions log

1. **Bars are matched to finds by seq, not by index.** With Drop breaks on, `gameTiming` leaves break gaps out of `findTimes`, so the i-th bar is not always my i-th find. `gameTiming` now returns `findSeqs`, the events `seq` of each find time, and the UI matches bars to `/games/:id/finds` rows by seq. Bars are labelled with my true find number. With breaks off, the two always agree for normal mode: `findTimes` comes from the site's `computeState` and `finds` from the replay, and `crosscheck.test.js` checks that they accept the same events.
2. **Breaks only change the stats.** The replay always steps through every find. On the full page the chart has one bar per find; with Drop breaks on, break bars are grey and cut at the top so they don't flatten the scale. The game dialog keeps the version 1 chart, with breaks left out.
3. **The chosen set is teal (`#2f7f86`, `colors.chosen`), not the accent.** The accent `#800080` is also the purple card color. White text on the teal passes AA (4.7:1).
4. **Other sets are listed, not all drawn at once.** With "Show other sets" on, the sets are listed beside the board, chosen first, each with its mini cards, marks and fresh count. Hovering or focusing a row draws a dashed outline around its cards, one set at a time. The chosen set's teal ring stays on.
5. **Difference marks are lettered squares** (C S F N, filled = differs), not unlabelled dots or words: compact enough for the tooltip, and readable without remembering an order.
6. **Vertical cards are the site's card turned a quarter turn**, so the symbols and stripes look as they do on the site's vertical layout, not a redrawn layout.
7. **The replay is on the full game page only.** The dialog gets hover cards but no replay, so it stays a quick look.
8. **Multiplayer is a placeholder.** `/games/:id/finds` already returns every player's finds with a `mine` flag, but the UI shows the replay and hover cards for solo games only, until the multiplayer design decides how to show other people's finds.
9. **The arrow keys don't step while focus is in an input.** This includes the slider's thumb, which handles arrows itself, so one key press never moves two steps.
10. **`fresh` counts from the previous find by anyone**, as in schema.md. This only differs from "since my previous find" in multiplayer games, which don't have the replay yet.

### Version 1 terms that could be misread (not changed)

Listed for a later decision; nothing here was changed.

- **"Std dev of pace"** and **"Median pace"** (game tiles): these are the standard deviation and median of the game's find times. "Pace" elsewhere means a per-game mean.
- **"Average pace"** on the game page versus **"Average pace, last 5 games"** on the dashboard: the first is the mean of one game's find times, the second the mean of 5 per-game paces.
- **"N sets"** in the game subtitle and the **Sets** column of the games list: these count my finds, not every set in the game, which matters in multiplayer.
- **"Drop breaks"** explains itself only in a native `title` tooltip, which touch screens never show. The game page has no filter bar, so there it is only visible as the `dropBreaks=1` URL parameter.
- **"Where I pick from"**: the shares add up to about 300%, not 100% (three cards per find), and the caption "Even spread would be 25%" relies on that.
- **"Range of find times"** includes breaks unless Drop breaks is on, while the dashboard pace tiles change with the same filter. The interaction isn't stated anywhere.
