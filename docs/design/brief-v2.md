# set stats web UI: version 2

Version 2 adds card-level views on top of version 1 ([brief.md](brief.md)), in three parts. This file records what each part built, the definitions it added and the decisions behind it, in the same style as the version 1 decisions log. Where this file and brief.md disagree about version 2, this file wins. Version 3, a rework of the Solo page, is in [brief-v3.md](brief-v3.md).

1. **Cards**: card rendering, the chosen set on hover, and a board replay.
2. **Set types**: which kinds of sets I pick more or less often than chance, and how fast.
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
- **Break:** a gap over 50× its game's median gap (`BREAK_FACTOR`), where the median ignores gaps under 100 ms (`breakFlags`, `lib/metrics.js`). With Drop breaks on, the stats leave breaks out; the board replay doesn't.
- **Bad timing:** a solo game with any gap under 100 ms between accepted sets (`badTiming`, `lib/metrics.js`). In a solo game every gap is my own find, and no one finds a set that fast, so its timestamps are off.
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
11. **Breaks: 50× the median, and the median ignores gaps under 100 ms.** At 10×, ordinary slow finds counted as breaks; 100× was tried next, then settled at 50×. The UI labels read `BREAK_FACTOR` from `lib/metrics.js`, so they follow it. About 100 games (mostly setwithfriends) have bursts of sets under 100 ms apart, most likely sets that reached the site together after a dropped connection. In a few of them the median gap was 1–6 ms, so every ordinary gap counted as a break, nearly the whole game was subtracted, and the fastest game showed 0:00.0. No one finds a set in under 100 ms, so those gaps are left out of the median. They still count as find times.
12. **Bad-timing games are left out of the time stats, behind a filter.** 266 of about 22,000 solo games (240 of them setwithfriends normal games) have a gap under 100 ms. The rule is any one such gap rather than a burst of three or more (115 games), because in a solo game even one means the timestamps are off. Skip bad timing (on by default, `skipBadTiming`) leaves them out of the headline tiles, Over time, By window and the best time badge; `npm run stats` skips them too, so By window still matches it. They stay in the games list (tagged), the calendar and the position heatmap, since they were played and positions don't depend on timing. Multiplayer games are never flagged: two players can find sets 50 ms apart.
13. **The full game page has its own Drop breaks switch.** It sets the same URL filter as the dashboard checkbox, so the choice carries back to the list, and it says how much break time it left out, or that there was none.
14. **The Fastest game tile names the game.** It shows the game's date, which links to the game and opens it as a dialog like the games list. On a tie it is the older game, matching the best time badge.
15. **Game page tiles: Total time, Average pace ± stdev, Median pace, Range of find times.** This replaces brief.md section 7's four tiles. The standard deviation moves into the pace tile as ±, as on the dashboard, and Total time takes its place: `duration_ms`, without breaks when they are dropped, and "– unfinished" for an unfinished game.
16. **Games that never started are skipped by derive and the cross-check, not failed.** 50 normal games (49 setwithfriends, 1 setwithforks) never left the lobby: no `started_at`, no events, and no deck on setwithfriends, because the site only shuffles at the start. Nothing is missing or corrupt. One SQL condition, `STARTED` in `lib/derive.js`, is used by `rebuildDerived`, `deriveNew` and `test/crosscheck.test.js`. `replayGame` still fails with "missing seed" for a started game. The web UI already left these games out: every query requires `started_at`, and `/games/:id` is a 404 for them.

### Version 1 terms that could be misread (not changed)

Listed for a later decision; nothing here was changed.

- **"Median pace"** and the **±** on "Average pace" (game tiles): these are the median and standard deviation of the game's find times, while the dashboard's ± is across per-game paces. "Pace" elsewhere means a per-game mean.
- **"Average pace"** on the game page versus **"Average pace, last 5 games"** on the dashboard: the first is the mean of one game's find times, the second the mean of 5 per-game paces.
- **"N sets"** in the game subtitle and the **Sets** column of the games list: these count my finds, not every set in the game, which matters in multiplayer.
- **"Drop breaks"** explains itself only in a native `title` tooltip, which touch screens never show. The game page has no filter bar, so there it is only visible as the `dropBreaks=1` URL parameter.
- **"Where I pick from"**: the shares add up to about 300%, not 100% (three cards per find), and the caption "Even spread would be 25%" relies on that.
- **"Range of find times"** includes breaks unless Drop breaks is on, while the dashboard pace tiles change with the same filter. The interaction isn't stated anywhere.

## Part 2: set types

### What was built

- **Set types tab** (`/types`, `ui/src/pages/Types.jsx`), between Solo and Multiplayer in the header. Normal mode, solo games, my finds only, games that started. No model is fitted; that is part 3. From broad to specific:
  - **Summary:** the 4 `n_diff` groups as tiles, each with its Ratio and 95% interval.
  - **Blind spots:** up to 3 patterns with the lowest Ratio whose upper interval bound is below 1 and whose Expected is at least 30 (`MIN_EXPECTED`). If none qualify, the card says so. Clicking one opens its row in the pattern table and scrolls to it.
  - **All 15 patterns** (`TypeTable.jsx`), grouped by `n_diff` (4 + 6 + 4 + 1). Each pattern is shown with its difference marks and a label such as "color + shape differ". Columns: Picks, Expected, Ratio with a small interval bar around 1.0 (`RatioBar.jsx`), and Median find time (n). Every column sorts. Rows with Expected under 30 are greyed, and a tooltip says why.
  - **Examples** (`TypeExamples.jsx`): hovering a pattern shows its 3 latest finds (cards, find time, date) in a tooltip that follows the cursor. Clicking the row expands it in place, with up to 6 finds; each links to the full game page with the replay opened at that find. A chevron shows which row is open, and the open row stays with its pattern when the table is sorted.
  - **Set after set:** the same table grouped by the `n_fresh` of the available sets (0 to 3), leaving out each game's first find.
- **Filters:** the existing filter bar, with the mode shown as fixed. Its Drop breaks and Skip bad timing tooltips say what those filters do on this page. Below it are the date range and Last N games controls, moved out of `OverTime.jsx` into `RangeControls.jsx`. Over time keeps them in local state as before. The Set types page keeps them in the URL (`range`, `from`, `to`, `lastN`), defaulting to all time.
- **Game page `?find=<seq>`:** opens the board replay at that find and scrolls to it. Opened from the Set types page, the back link reads "Set types" and returns there with its filters.
- **Saved set-type tables:** `game_set_types` and `my_find_types` (schema v4, `DERIVE_VERSION` 2), filled by derive. See [schema.md](../schema.md#set-types).
- **API:**
  - `GET /api/types?completedOnly&hintsOff&skipBadTiming&dropBreaks&from&to&lastN` returns `nDiff`, `patterns`, `blindSpots` and `fresh` rows, plus `games`, `finds`, `freshFinds` and `minExpected`. Until the saved tables are current, it returns `needsRebuild`.
  - `GET /api/types/examples` (same filters) returns up to 6 recent finds for every pattern at once. The page requests it as soon as `/types` has loaded, so hover previews don't wait.
- **Math** in `lib/setTypes.js` (pure).

### Definitions

These match `ui/src/definitions.js` and `lib/setTypes.js`. A **type** G is a group of sets: an `n_diff` (how many features differ), a `diff_mask` (which ones), or the `n_fresh` of a set. All of the following are over my finds in scope.

- **Picks (O):** finds where the chosen set is in G.
- **Expected (E):** the sum over finds of (sets in G on the board / all sets on the board). This is how many picks G would get if I chose uniformly at random among the available sets.
- **Ratio:** O / E. 1.0 is chance; above 1 I favor this type, below 1 I under-pick it. With E = 0 (G was never on the board) it is "–".
- **95% interval for the ratio:** the exact (Garwood) Poisson interval for O, divided by E, with E treated as fixed: [Γ⁻¹(0.025; O), Γ⁻¹(0.975; O + 1)] / E, with 0 as the lower bound when O = 0.
- **Median find time (n):** the median `finds.elapsed_ms` over the finds where I picked G, with how many finds that is. A find time covers the whole board, not only the type.
- **Fresh group:** a set's `n_fresh`, the number of its cards dealt since my previous find. The first find of a game has none and is left out, so the set-after-set table covers fewer finds.
- **Blind spot:** a pattern with E ≥ 30 whose whole 95% interval is below 1. The page shows the 3 with the lowest Ratio.

Invariant, tested on the fixture and true on my data: over a full partition (the 4 `n_diff` groups, the 15 patterns, or the 4 fresh groups), total E = total O = the number of finds (minus first finds for fresh).

### Decisions log

1. **Set-type totals are saved at derive time.** Summing `board_sets` per request took 2.3–2.7 s for the totals, and about 11 s with the medians, on ~22,000 games. Covering indexes on `finds` and `board_sets`, and a clustered (`WITHOUT ROWID`) `board_sets`, made no difference. The cost is joining 478k finds to 1.25M board sets and grouping them by type, not the lookups. Picks and expected add up across games, so derive saves them per game (`game_set_types`) and a request only sums them. A full rebuild went from about 52 s to 60 s. An in-memory cache in the server was the alternative; the saved tables were chosen so the totals persist between runs and the first request is as fast as the rest.
2. **No view defines them.** The definition is the `INSERT … SELECT` in `lib/derive.js`. A view would be recomputed on every read (SQLite has no materialized views), and a test comparing a table with a view of itself would check nothing. The tests use values worked out by hand instead. On my data, the saved totals and every chosen row also matched the per-request query from before exactly.
3. **`finds` keeps its board JSON.** A narrow copy of `finds` without it saved about 40 ms on selecting my finds. The board is 85 to 125 bytes and fits in the row, so it isn't worth moving.
4. **Medians come from `my_find_types` and are taken in JS.** Medians don't add up across games. SQL window medians took about 1.9 s for the three groupings. Reading the narrow rows (about 0.2 s) and sorting typed arrays is faster.
5. **No take rate.** An earlier version also showed a take rate: of the finds where a set of the type was on the board, the share where I took one. It wasn't noisy (tens of thousands of finds per type), but it was confounded: it depends on how many other sets shared the board, so a type that turns up on crowded boards looks under-picked even when I favor it. On my data, sets where 2 features differ had a higher take rate than sets where 1 differs (58% against 54%), with a clearly lower Ratio (1.14 against 1.32). Ratio already allows for the rest of the board, so the take rate was removed, along with the `present` count it needed. Without `present`, derive no longer groups each find by type: each set adds 1 / n_sets to its type.
6. **Bad-timing games are left out of the whole page** while Skip bad timing is on, not only the time column. If their sets were queued during a dropped connection, the replayed board may not match what was on screen. It is about 1% of games.
7. **Drop breaks only changes the median column.** Which games and finds count is the same either way, so Picks, Expected and Ratio don't move.
8. **Last N** is the N most recent games in the date range with at least one find, after the other filters, as in Over time's pace.
9. **The date range defaults to All time** here, not 90 days as in Over time. Over 90 days, many patterns would have E < 30 and be greyed.
10. **Sorting stays within the `n_diff` groups.** The grouping is the point of the table; the blind spots already give the overall ranking.
11. **Labels say "fill" for shade**, to match the F mark. All four differing reads "all four differ".
12. **The interval bar is on a log scale from 1/3 to 3**, so 0.5 and 2 are the same distance from the line at 1.0. Bounds past the ends get an arrow. On my data the intervals are narrow (often ±0.01), so most bars are little more than the dot.
13. **The interval is computed in house** (a regularized incomplete gamma and bisection, `lib/setTypes.js`) rather than adding a statistics package. The test checks it against scipy.
14. **Examples are newest game first, latest find first within a game.** They open the full page, not the dialog, so the replay is there. The back link knows where it came from through history state. `useFilters` now keeps that state when a filter changes the URL, so toggling Drop breaks on the game page doesn't lose it.
15. **The tables say to rebuild instead of failing.** On a database from before schema v4, or before the next full rebuild, `/types` answers `needsRebuild`. The statements are prepared on first use, so an older database still serves the rest of the UI.
16. **The fresh tooltip** now says "a set's cards", since fresh is shown for every set in the replay's other-sets list.
17. **The filter bar's checkboxes now wrap** at phone width. `flexWrap` was passed to `Stack` as a prop, which current MUI no longer reads, so Skip bad timing ran off the right edge on the dashboard too.
18. **Recent finds open under their own row, with a hover preview**, not in a panel below the table. Below the table they were out of sight when clicking an upper row, and seemed to belong to the last pattern. Considered: a side panel (the six-column table would need to slim down), a popover (covers neighboring rows, awkward on touch), a drawer (covers the table, so comparing patterns means opening and closing it) and leaving the panel but scrolling to it (still looks attached to the last row). Hover isn't available on touch screens; there, a tap expands the row.
19. **All 15 patterns' examples come in one request, read newest games first.** Ranking every find per pattern with a window function took about 0.85 s on ~22,000 games. The query now reads the newest 64 games, then 128, 256 and so on, and stops once every pattern has 6: about 2 ms on my data. On real data it gives the same finds as the one-query version; a pattern rare in recent games would only make it read more batches.
