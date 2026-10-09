# set stats web UI: design brief

Version 1 of a local web UI for the set-stats repo. This brief is the source of truth for what to build. The mockups in `docs/design/mockups/` show the intended layout and look; where a mockup and this brief disagree, this brief wins.

Suggested location in the repo:

```
docs/design/brief.md              this file
docs/design/mockups/dashboard.png screenshot, solo dashboard
docs/design/mockups/game.png      screenshot, single game view
docs/design/mockups/dashboard.html static HTML of the same screen (exact colors, sizes, spacing)
docs/design/mockups/game.html
```

All numbers in the dashboard mockup are sample data. The single game mockup uses the real game `abandoned-tired-property`.

## 1. Purpose

Answer, for my own games on Set with Forks:

- Am I getting faster or slower over time?
- How consistent am I, game to game and find to find?
- Within one game, where did the time go?

Questions about which kinds of sets I find or miss are out of scope for this version (see section 9).

## 2. Scope of version 1

In:

- Solo dashboard (one page)
- Single game view
- Multiplayer tab that exists but shows only an empty state

Out, for later: board viewer, set-type analysis, saved filter presets, multiplayer stats, dark theme, theme editor.

## 3. Constraints

- **Local only.** The UI and its API never contact setwithfriends.com or Firebase. Only `npm run sync` does that.
- **Read only.** The API opens `data/games.db` read-only and never writes.
- **Existing stack.** Node 22, ES modules, `better-sqlite3`. Follow the repo's Prettier and ESLint setup.
- **Frontend.** React, Material UI, Chart.js (via react-chartjs-2). Use the current stable major version of each at install time (`@mui/material`, not the site's older v4 `@material-ui/core`). Check the installed version's docs before writing component code, since the API differs from v4.
- **Forkable.** No hardcoded user id. Read it from `lib/config.js` / `meta.my_user_id`. The README needs a short section on running the UI.
- **How to work with me.** I type the code myself. Give small snippets with a short explanation of each, in build order, and wait for me between steps. Do not edit files directly.

## 4. Architecture

- `npm run ui` starts one local Node server that serves a small JSON API and the built React app.
- The API does all metric calculations. The React app only formats and draws.
- Put metric math in a pure module (suggested `lib/metrics.js`) with no database access, so it can be unit tested. Queries go in a separate module.
- Suggested endpoints (names are a suggestion, shapes are the point):
  - `GET /api/modes` : modes I have played, with game counts, most played first
  - `GET /api/summary?mode=&completedOnly=&hintsOff=` : headline tiles, by-window table
  - `GET /api/calendar?mode=&year=` : games per local day
  - `GET /api/games?mode=&from=&to=&lastN=&...` : per-game rows for the graph and list
  - `GET /api/games/:id` : one game with its per-find times
  - `GET /api/positions?mode=normal` : position heatmap counts
  - `GET /api/meta` : `last_sync_at`

## 5. Definitions

These must match `bin/stats.js`, which is the reference implementation for existing numbers.

**Which games count**

- Skip games with no `started_at` (never left the lobby).
- **Solo** = `n_players = 1`. Everything on the dashboard is solo only.
- **Hints off only** (default on) excludes games with `enable_hint = 1`.
- **Completed only** (default off) keeps only `status = 'done'`.
- One mode is always selected. Default is my most played mode.

**Find times**

- A find time (gap) is the time from the previous accepted set by anyone, or from `started_at` for the first, to my accepted set.
- For normal mode this equals `finds.elapsed_ms` where `user_id` is me.
- `finds` only has rows for normal mode. For other modes, get the accepted events the way `bin/stats.js` does, with `computeState` from `vendor/game.js`. One code path for all modes is fine if it gives identical results for normal mode. Add a test for that.

**Per game**

- `pace_ms` = mean of my find times in that game. For a solo game this is (time of last set minus `started_at`) / sets found.
- `duration_ms` = `ended_at - started_at - pause_time_ms` (treat NULL pause as 0), finished games only. NULL for unfinished games.
- **Unfinished games** are included in pace and in the games list. The open stretch after the last set found is ignored, which falls out of the definition above. A game with zero finds has no pace and is left out of pace stats.

**Aggregates**

- Standard deviation is the sample standard deviation (divide by n - 1). Show nothing for n < 2.
- "Last N games" for pace = the N most recent games with at least one find. For game time = the N most recent finished games.
- Days and "last 30 days" use the browser's local time zone. Times are stored as UTC milliseconds.

**Rolling average on the graph**

- **Mean** (default): mean of the last X games' values, with a band of one sample standard deviation either side.
- **Median**: median of the last X.
- **aoX**: csTimer style. Drop the best and worst `ceil(X * 0.05)` values, mean of the rest.
- Default X = 5. Options: 5, 10, 12, 50, 100. No value until X games are available.

## 6. Dashboard (solo tab)

See `mockups/dashboard.png`. Sections top to bottom:

**6.1 Header.** App name, tabs (Solo, Multiplayer), "Last synced" from `meta.last_sync_at` as relative time.

**6.2 Top bar.** Mode select, "Completed only" checkbox, "Hints off only" checkbox. These apply to every section. There is deliberately no date range here.

**6.3 Headline tiles (four).** These ignore the graph's date range.

| Tile | Definition |
| --- | --- |
| Games finished / started | counts in the selected mode |
| Fastest game | minimum `duration_ms` among finished games |
| Average pace, last 5 games | mean of the 5 games' `pace_ms`, ± the standard deviation across those 5 per-game values (not across individual finds) |
| Average game time, last 5 games | mean ± standard deviation of `duration_ms` over the last 5 finished games |

**6.4 Calendar.** GitHub-style grid, one cell per local day, colored by games started that day (5 levels). Headline: "N games in the past year". Year selector on the right, under the legend: "Past year" plus each calendar year that has games. Hovering a cell shows the date and count.

**6.5 Over time.** One card containing:

- Metric toggle: **Pace** (default) or **Game time**. Game time plots finished games only.
- Average type (Mean, Median, aoX) and window X.
- Date range: 7d, 30d, 90d, All time, Custom. Default 90d. This range applies only to this card.
- Last N games input. If both are set, apply the date range first, then keep the last N within it.
- Summary for the current selection: games in range, average ± standard deviation, best, and change over range (last rolling value minus first rolling value).
- Chart: one dot per game, the rolling line, the standard deviation band (mean only), and a diamond marker on each game that set a new best finished game time. Label the markers "New best time" so they are not read as pace records. Hovering a dot shows date, pace, time, sets. Clicking a dot opens that game.
- Histogram of the selected metric over the same selection.

**6.6 By window.** Compact table, half width. Rows: all time, last 30 days, last 10 finished. Columns: finished, unfinished, average time, pace. Pace here is pooled the way `bin/stats.js` does it (mean of every find time in the window), so it must reproduce the current `npm run stats` output.

**6.7 Where I pick from.** Half width, beside 6.6. A 3 by 4 grid matching the board in landscape layout: position `i` is at row `i % 3`, column `floor(i / 3)`. Each cell shows `(my picked cards at position i)/(my finds)` at that position, from `board_sets` rows with `is_chosen = 1` joined to my finds (`p1`, `p2`, `p3`). Normal mode only; hide the card for other modes. Positions 12 and above (boards with extra cards) are left out; say so in a tooltip. Caption: "Even spread would be 25% per position."

**6.8 Games.** Table, newest first: played (local date and time, links to the game view), sets, time ("n/a" if unfinished), pace, status. A "Best time" badge on the current fastest game. 20 rows, then "Load more".

## 7. Single game view

See `mockups/game.png`.

- Back link, date and time as the title, then a subtitle: mode, solo, status, total time, sets, game id.
- Four tiles: average pace, median pace, standard deviation of find times, range of find times (min to max).
- Bar chart, one bar per find in order, height = find time in seconds, linear scale, dashed line at the median find time (the median, not the average, even though the dashboard defaults to mean). Hover tooltip: "Find N · X s". No click action yet.

Expected values for `abandoned-tired-property`, for a test: 25 finds, duration 234786 ms, average 9.39 s, median 3.671 s, standard deviation 11.56 s, range 1.653 to 40.569 s.

## 8. Visual design

Light theme only. Inspired by the Set with Forks site (its `#fafafa` page background and card purple) but not a copy. Exact values are in the mockup HTML files.

| Token | Value |
| --- | --- |
| Page background | `#fafafa` |
| Surface (cards) | `#ffffff`, 1px border `#e4e0e8`, radius 10px |
| Control border | `#cfc9d6`, radius 8px |
| Text | `#1f1b24` |
| Muted text | `#5b5564` |
| Accent | `#800080` (hover/dark `#5c005c`) |
| Accent scale, light to dark | `#ebe8ee`, `#dcc3dc`, `#c08ac0`, `#a04da0`, `#800080` |
| Record marker | `#b25c00` outline, white fill |
| Text font | Figtree (400, 500, 600, 700) |
| Number font | IBM Plex Mono (400, 500, 600) for every statistic and axis label |

- Content width 1120px max, 24px gaps between cards.
- Controls at least 44px tall. Real buttons, selects, inputs and labels.
- Set the fonts and colors through the Material UI theme so components pick them up.
- Works at phone width: tiles wrap, the two half-width cards stack, tables scroll sideways inside their card.
- White text only on `#800080` and `#a04da0`. Lighter purples take dark text.

## 9. Not in this version

Recorded so the structure leaves room for them:

- Board viewer: click a find to see the board, the set taken, and the sets passed over.
- Set-type page: pick rate, frequency and time by type.
- Position heatmap adjusted for how often each position held a card from an available set.
- Multiplayer stats, saved presets, dark theme.

## 10. Build order

Stop after each step so I can review.

1. `lib/metrics.js` with tests (use the fixture game values in section 7)
2. Query module and API server, checked against `npm run stats` output
3. React app shell: theme, header, tabs, top bar
4. Headline tiles
5. Over time card
6. Calendar
7. By window and position heatmap
8. Games list and single game view
9. README section

## 11. Decisions log

Settled questions, kept here so the reasoning is not lost.

1. **Material UI version:** current stable major, not v4. The site's theme values are reused, not its component code.
2. **Standard deviation in the pace tile:** across the 5 per-game paces. Across individual finds it would be several times larger and mostly reflect stalls, which says little about game-to-game consistency.
3. **Dashed line in the single game chart:** stays at the median. Within one game a few stalls pull the average well above a typical find, so the median is the better reference line there.

There are no open questions.
