# set stats web UI: version 3

Version 3 reworks the Solo page on top of version 1 ([brief.md](brief.md)) and version 2 ([brief-v2.md](brief-v2.md)) in seven changes, then the Set types page in an eighth. This file records what each change built, why, and the decisions behind it, in the same style as the earlier decisions logs. Where this file and an earlier brief disagree, this file wins.

1. **Headline tiles**: averages first, with a change against the 5 games before.
2. **Data updated**: when the data on screen last changed, in the header.
3. **Calendar days**: click a day to list its games.
4. **Trend card**: a plain title, and one Range control.
5. **Recent games, search and Records**: in place of one long games list.
6. **Layout**: the position heatmap moves to the Set types page; Records takes its place.
7. **Drop breaks on by default.**
8. **Set types: blind spots, position heatmap and a trend**: blind spots in words, the heatmap over the page's games, and a trend of ratio and find time.

The working conventions are unchanged: metric math lives in `lib/` and is unit tested, the React app only formats and draws, and filters live in the URL. Everything new is a real button, link or input with a label and can be reached by keyboard. Existing components were not audited; that is a separate accessibility pass.

## 1. Headline tiles

Motivation: I glance at these after refreshing. The averages matter most, then the fastest game; the game count barely changes.

### What was built

- **Order:** Average game time (last 5 games), Average pace (last 5 games), Fastest game, Games finished / started. No tile has the accent border.
- **Change against the 5 before** under each average: "0.2 s faster than the 5 before", "12 s slower than the 5 before", or "Same as the 5 before". `recentAverage` in `lib/metrics.js` returns the tile's mean ± standard deviation as before, plus `delta`: the mean of the last 5 minus the mean of the 5 before them, using the tile's own rule for "last 5" (games with at least one find for pace, finished games for game time). No delta with fewer than 10 such games.

### Decisions log

1. **Words, not a sign or a color.** Lower is better, so "−0.2" or a green number is ambiguous. The note is muted text with no color: the palette (brief.md section 8) has no good or bad colors, and the words carry the meaning on their own.
2. **Precision matches the value above it.** Pace changes have one decimal ("0.2 s"). Game time changes are whole seconds under a minute ("12 s") and m:ss from a minute ("1:05"). A change that rounds to zero at that precision reads "Same as the 5 before", so the note never says "0.0 s faster".
3. **The standard deviation is unchanged**: still across the last 5 per-game values (brief.md decision 2).
4. **Game time first, and no accent.** A first version led with pace and kept the accent border brief.md's mockup gave the pace tile. Game time is now the headline number, and with the averages leading the row, no tile needs calling out.

## 2. Data updated

Motivation: when I sync several times in a row I want to confirm that the data on the site actually changed. What I see changes when rebuild runs, not when sync runs, and nothing recorded that.

### What was built

- `bin/rebuild.js` saves `meta.last_rebuild_at` (ms) when it finishes, in both modes. `GET /api/meta` returns it beside `last_sync_at`.
- **Header:** "Data updated 2:41 PM (3 minutes ago)"; on another day "Oct 8, 2:41 PM", and in another year "Dec 30, 2025, 2:41 PM". This replaces "Last synced". Its tooltip gives the full time to the second, says it is when `npm run rebuild` or `rebuild:new` last finished, and gives the last sync time.
- A database with no `last_rebuild_at` yet shows "Last synced …" as before, until the next rebuild.

### Decisions log

1. **Written even when some games failed to replay.** Rebuild reports those and carries on, and the load step has already changed what the UI shows.
2. **"3 minutes ago", not "3 min ago":** the long relative-time style the header already used. The relative part updates every minute while the page is open.
3. **The label is a button** (styled as text, with a dotted underline) so its tooltip can be opened by keyboard and touch, like the info buttons.
4. **The UI still keeps API responses until the page reloads** (`ui/src/api.js`). After a rebuild, reload the page; the new time in the header confirms the data on screen is the new data.

## 3. Calendar: click a day

Motivation: like GitHub's contribution graph, click a day and see that day's games and times without changing the chart's date range.

### What was built

- **Each day cell is a button.** Clicking one opens a panel inside the calendar card, under the grid. Clicking the selected day again, or the panel's close button, closes it. A caption under the heading says "Select a day to list its games."
- **The panel:** the full date as a heading; a summary line ("10 games, 9 finished · average pace 3.7 s · best time 1:01.9", the best time linking to its game); and every game that day in a table like Recent games (start time, sets, time, pace, status, with the Best time and Bad timing tags). Each game opens the game dialog. After about 10 games the table scrolls inside the panel.
- **URL:** the selected day is the `day` param ("YYYY-MM-DD"), so closing a game dialog, or reloading, comes back to it. Days are local, as in the calendar.
- **API:** `GET /api/day?date&tz` plus the top-bar filters returns `games` (every game that day in the mode, as the calendar counts them), `summary` and `bestGameId`. `onDay` and `daySummary` are in `lib/metrics.js`, and `fastestGame` is shared with the headline tile.
- **Keyboard:** the grid is one tab stop. Up and down move a day, left and right a week (the columns are weeks), Home and End go to the first and last day shown, and Enter or Space opens or closes the day. Each day's tooltip shows while it has focus.

### Definitions

- **Day summary:** games is every game listed. Average pace is the mean of the per-game paces, as on the headline tile, and best time is the fastest finished game. Both leave out bad-timing games while Skip bad timing is on, and follow Drop breaks; the line says how many games were left out.

### Decisions log

1. **Pace is the mean of the per-game paces, not pooled.** By window pools every find to match `npm run stats`. The panel instead matches the table under it: its pace is the average of the Pace column, as the headline tile's is of the last 5 games.
2. **Oldest first in the panel.** A day reads as a session, and the first column shows only the start time. Recent games stays newest first.
3. **Days with no games can be selected too.** The arrow keys move over every day, and skipping empty days would make up and down jump unpredictably. The panel says "0 games".
4. **Selected and focused look different.** Selected is a white gap and a dark ring (`#1f1b24`), which shows on every color level. Keyboard focus is the accent outline outside that ring, so both can show at once. Hover draws a thin dark outline.
5. **The URL change replaces the history entry**, as the filters do, so the back button doesn't step through days. The day is kept when a filter changes, and when the year selector changes; the panel stays open for a day the grid doesn't show.
6. **Closing the panel returns focus to its day**, so keyboard users don't lose their place.

## 4. Trend card

Motivation: "Over time" is a phrase, not a thing, and it wasn't clear how Date range and Last N games interact when both were set.

### What was built

- **Title:** "Trend", followed by the Game time / Pace toggle. **The card opens on Game time** (brief.md section 6.5 had Pace as the default).
- **One Range control** (`RangeControls.jsx`, shared with the Set types page) in place of Date range and Last N games: two groups of preset toggle buttons, **Dates** (7d, 30d, 90d, All time, Custom) and **Most recent games** (50, 100, 500, Custom), with one button pressed across both groups. Custom dates shows From and To; a custom number shows a "Number of games" input. A choice is one or the other, never both.
- **Scope line** under the control: "2,392 games, Jul 12 to Oct 9", the number of games in the selection and the days of the first and last of them. Years are shown when either day isn't in the current year. `/series` and `/types` return it as `scope` (`gameSpan` in `lib/metrics.js`). The Set types page adds its finds: "· 472,353 finds".
- **Defaults are unchanged:** 90 days on Solo, All time on Set types.

### Decisions log

1. **Preset buttons, in two labelled groups.** A first version used one select with grouped options, so that "one or the other" was plain and nine choices fit at phone width. It was changed back to toggle buttons: switching between presets is one click instead of two, and the selection is visible at a glance. Only one button is pressed across both groups, so picking 500 releases 90d. The groups sit side by side on wide screens and stack on phones.
2. **The title is just "Trend".** An earlier version named the metric ("Pace trend", "Game time trend"), which repeated the toggle beside it.
3. **Buttons are named by their visible text.** The group headings (Dates, Most recent games) give the context, so "7d" and "50" have no separate `aria-label`, and what a screen reader or voice control uses matches what is shown.
4. **The scope line counts the games plotted**, so on Game time it counts finished games only, and it names the first and last game's days rather than the range's bounds. "Last 30 days" with no games in its first week then says so.
5. **"Games in range" is gone** from the trend's stats, since the scope line says it. Average, best and change over range stay.
6. **URL parameters (Set types).** Dates: `range` (absent for All time) with `from` and `to` for custom dates, as before. Games: `range=games` and `lastN`. An older link with `lastN` and no `range=games` still opens as Most recent games. An older link with both a date range and `lastN` now gets the last N games and ignores the dates, since the two can no longer combine.
7. **Custom number of games** keeps the number from the preset it was chosen from, so the scope doesn't jump; an empty box means all games, and the scope line says how many that is. A typed 100 stays under Custom rather than turning into the 100 preset.
8. **The trend card keeps its Range in local state**, as in version 2. The Set types page keeps it in the URL.
9. **Game time is the default metric and comes first in the toggle**, matching the headline tiles, which now lead with game time. The metric is local state like the Range, so it opens on Game time on each load.

## 5. Recent games, search and Records

Motivation: one long pageable list of 17,000 games was clunky. What I actually do is look up a day (now the calendar), find a game by its three-word id, or jump to my records. Not a filterable table.

### What was built

- **Recent games** (`GamesList.jsx`): 10 rows, newest first, with Load more adding 10 at a time. Columns and tags as before. The table is now `GameTable.jsx`, shared with the day panel.
- **Search** (`GameSearch.jsx`), at the top of that card: "Find a game by id or link". It searches on the server for any started game whose id contains the text, case-insensitive, whatever the top-bar filters and mode, solo or not. It searches 250 ms after typing stops.
- **Play again series:** matches are grouped by series and shown one row per series (`seriesBase`, `groupSeries` in `lib/search.js`). "Play again" starts a game whose id is the first game's id plus `-1`, `-2` and so on, so `abandoned-tired-property` and `abandoned-tired-property-1` … `-16` are one series. Each row shows the series' head game (date and time, mode, players when more than one, time or "unfinished", and the id) and, when more of the series matched, a "Show 16 more Play again games" button that lists them under it, newest first. Every game opens the game dialog. The 10 series with the newest matches are shown, with how many games and series matched in all.
- **Pasted URLs:** `gameIdQuery` (`lib/search.js`) reads `…/game/<id>` on either site as that game's local id, with `swf:` for setwithfriends, and `…/games/<id>` (this UI's own game page) as a local id.
- **API:** `GET /api/games/search?q` returns `q` as searched, `total` (games), `seriesTotal` and `series` (`base`, `head`, `more`). With `&series=<base>` it returns `games`, every match in that series.
- **Records** (`Records.jsx`): every game that set a new best game time, newest first: the date (opening the game), the time, and how much it beat the previous best ("4.1 s"; the first is "first finish"). About 8 rows show and the rest scroll inside the card. It follows the top-bar filters and not the trend's Range. `/summary` returns `records`, from `records()` in `lib/metrics.js`, which `recordGameIds` (the chart's diamonds and the Best time badge) now uses, so the two always agree.

### Decisions log

1. **Play again games are collapsed under their series.** 80% of started games (18,164 of 22,777, in 3,009 series, the longest 230 games) are Play again games. Searching a first game's id matched every game in its series, and since results were newest first and capped at 10, the first game itself was never shown, even when its id or URL was pasted exactly. Ranking exact matches first was the alternative; grouping was chosen so one series takes one row, whatever is searched.
2. **The head is the series' first game when it matched**, otherwise its oldest match: searching `public-pumped-purpose-12` matches `-12` and `-120` to `-129`, and `-12` heads them. A series is listed by its newest match, so a head's date can be older than the row below it.
3. **The other matches load when the series is opened** (`series=`), so a search that matches thousands of games stays one small response.
4. **The id shown in search results** is the full local id, so it's clear why each matched.
5. **On phones each result is two lines**, date and time, then mode and id, so the time doesn't wrap onto a line of its own.
6. **Results sit in an outlined box** above the Recent games table. Without it the matches read as the first rows of Recent games.
7. **Ties are not records**, as before: a game equal to the best time doesn't get a diamond or a row.
8. **The Records table is a focusable region**, so it can be scrolled with the keyboard, as well as by tabbing through its links.

## 6. Layout

Motivation: the position heatmap is analysis, not a summary, and under the chart it was unclear which time range it covers.

### What was built

- **Solo page**, top to bottom: filters, headline tiles, calendar (with its day panel), trend, By window beside Records, Recent games.
- **Where I pick from** moves, unchanged, to the bottom of the Set types page. It follows the top-bar filters but not that page's Range. Item 8 reworks it.

### Decisions log

1. **ByWindow lost its `alone` prop**, which kept it half width when the heatmap was hidden for non-normal modes. Records is always beside it now.
2. **On the Set types page the heatmap sits in a plain box**, because its card's row sizing (`flex: 1 1 420px`) would otherwise make it 420px tall in that page's column.

## 7. Drop breaks on by default

### What was built

- **Drop breaks is ticked by default** on every page, and the full game page's switch starts on too. `dropBreaks=0` in the URL turns it off. The API defaults to on as well, so a URL without the parameter means the same in the browser and the API. `npm run stats` is unchanged: breaks are only dropped with `--drop-breaks`.
- **Sets counts every set I found**, breaks included. It came from the number of find times, which leaves breaks out, so with breaks dropped a game with 10 sets showed 9. `gameTiming` now also returns `myFinds`, and `sets` in the API uses it.

### Decisions log

1. **The break rule itself is unchanged** (brief-v2 decision 11). A long gap in a game with very few gaps can still escape it, because it pulls up the median it is measured against; a fix for that was looked at and set aside for now.

## 8. Set types: blind spots, position heatmap and a trend

Motivation, per change:

- **Blind spots:** "E 2,438" means nothing without the number of picks beside it.
- **Position heatmap:** I want to know whether I'm biased toward noticing cards in certain board positions, over the same games as the rest of this page.
- **Trend:** the ratios have no basis for comparison. I want to see whether they have changed, and whether I've improved.

### What was built

- **Blind spots** read "picked 1,639, expected 2,438", then "ratio 0.67 (95% 0.64–0.70)" on the next line. No "E", and no count of how often the type appeared (brief-v2 part 2 decision 5).
- **Where I pick from** stays last on the page and now covers the page's games: the top filters, the Range, and Skip bad timing. `GET /api/types/positions` uses the same scope as `/types` (`typeScope`) and returns `finds`, `beyond` and `shares`; the old `GET /api/positions`, which only took the top filters, is gone. The caption reads "Share of finds that used each position. A find uses 3 cards, so an even spread is 25%."
  - **Color by distance from 25%**, above in purple and below in teal, 4 steps each way (`ui/src/positionScale.js`, tested in `test/positionScale.test.js`). Full color is at least 5 points from 25% (`MIN_EXTENT`), or as far as the farthest cell when one is farther. A key under the grid shows the steps and the two ends (≤20.0%, ≥30.0%).
  - Every cell keeps its percentage. Its accessible name adds the distance: "Position 8: 27.1%, 2.1 points above even".
- **Trend** (`TypeTrend.jsx`), between the four summary tiles and Blind spots: four lines, one per `n_diff` group, over the page's games, oldest to newest.
  - **Buckets of games, not of days** (`trendBuckets`, `lib/setTypes.js`): size = max(200, ceil(games / 30)), counted back from the newest game so the latest point is full. The oldest games left over, fewer than a bucket, are dropped. With fewer than 2 buckets (400 games), the card says "A trend needs at least 400 games, two points of 200. This range has 350." instead of a chart.
  - **A toggle, Find time or Ratio**, over the same buckets. Find time: the median find time of the finds where I took that kind of set, without breaks when Drop breaks is on, as in the tables' median column. Ratio: picks / expected per bucket on a log scale, its 95% interval as a band, and a dashed line at 1.0. Each bucket's numbers come from `typeRow`, so the ratio, interval and median are worked out exactly as in the tables (`typeTrend`).
  - **X axis:** points evenly spaced, each labelled with its last game's day. **Tooltip:** the bucket's first and last day and its number of games, then per group the ratio, its interval, picks and expected, or the median and its n.
  - Under the chart: "Each point is 702 games, oldest to newest; the oldest 675 games are left out, too few for a point."
  - `GET /api/types/trend` (same filters as `/types`) returns `games`, `size`, `dropped`, `minGames` and `points`: each with `from`, `to`, `games` and four `nDiff` rows (`picks`, `expected`, `ratio`, `low`, `high`, `medianMs`, `medianN`). It reads the saved per-game `ndiff` rows of `game_set_types` and `my_find_types`, so there is no schema change.

On my data (21,033 games, all time), the trend answers the motivation: "1 feature differs" fell from 1.50 in the first point to 1.21 in the latest, and "All 4 features differ" rose from 0.69 to 0.82. The median find time of every group fell, most for all four differing (9.2 s to 3.3 s).

### Decisions log

1. **Picks and expected come before the ratio** on a blind spot, since the ratio is one divided by the other. The two lines are in words, matching the table's column names.
2. **The heatmap counts per request, with no saved table.** `/types/positions` joins my `my_find_types` rows to their chosen `board_sets` row and counts the three positions in JS: about 1.1 s on my data (0.6 s of it the query), where `/positions` took 3.5–5 s. Grouping the three columns in SQL took about 2 s. Saving per-game counts at derive time, as for the set types (brief-v2 part 2 decision 1), would be faster, but needs a schema change and a full rebuild; it can follow if the page feels slow.
3. **Bad-timing games are now left out of the heatmap** while Skip bad timing is on. This replaces the heatmap part of brief-v2 decision 12: the replayed board positions of those games may not be what was on screen, as for the rest of the page (brief-v2 part 2 decision 6).
4. **Teal for below, purple for above, grey at 25%.** Purple was already the heatmap's color and the accent. Teal (`colors.chosen` and its neighbors) is a second hue at about the same lightness per step, so the two sides look equally strong. Neutral is `#ecebee`. Each side has 4 steps, with dark text on the first two and white on the last two, and every step keeps its text at 4.5:1 or more.
5. **Full color at 5 points from 25%, at the least.** On my data every cell is between 21% and 28% (3.7 points at most), and the last 50 and last 500 games look the same. With the scale stretched from the lowest to the highest cell, a 1-point difference looked as strong as a 4-point one. At 5 points, a cell within about 0.6 points of 25% is grey, today's 3–4 point cells are clearly but not fully colored, and a range where one cell is farther than 5 points stretches the scale to it.
6. **The heatmap waits for `/types`.** It isn't drawn until the page's data has loaded, so on a database that needs a rebuild the page shows one message, not an empty grid.
7. **The trend is titled "Trend"**, with its toggle beside it, like the Solo page's card (item 4). It opens on **Find time**, which comes first in the toggle, matching the Solo page's trend, which opens on Game time (item 4 decision 9). A first version opened on Ratio. The choice is local state, as on the Solo page.
8. **Both views come in one response.** Switching between them doesn't wait for the server, and the medians are cheap next to reading the finds they come from.
9. **The trend has its own request** rather than joining `/types`, so the tiles and tables don't wait for it. On my data, with breaks dropped, `/types/trend` takes 1.2–1.5 s (0.75–1.0 s without, about 0.6 s for the last 500 games): about 0.3 s per pass over the scope's games (two with breaks dropped), 0.35–0.5 s reading 472k finds from `my_find_types`, 50 ms for the per-game totals, and about 70 ms for the buckets. `/types` takes 1.3–1.8 s. Per-request aggregation over the raw tables was too slow (brief-v2 part 2 decisions 1 and 4), but this reads the saved tables like `/types` does. `typeScope` now only works out the break-free finds for routes that need medians, which saves about 0.3 s on `/types/positions` and `/types/examples`.
10. **Each request works out the scope again.** The page makes four requests with the same filters (`/types`, `/types/examples`, `/types/trend`, `/types/positions`). A cache of the scope between requests was considered and left out: the cost is about 0.3–0.6 s a request, and a cache would have to be invalidated on rebuild.
11. **A ratio of 0, or a band reaching 0, leaves a gap** on the log scale rather than being drawn at the bottom. A group never on the board in a bucket has no ratio, as in the tables.
12. **Ratio ticks come from a fixed list** symmetric on the log scale (0.5, 0.67, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 2 and so on), within bounds that cover every line, band and 1.0. Find time starts at 0 s.
13. **X labels are each point's last day**, as "Jul 2024" when the scope spans more than about 300 days, or "Jul 12" when it doesn't. The tooltip gives the exact span.
14. **The lines don't depend on color.** Each is labelled at its end ("1 differs", "2 differ", "3 differ", "All 4"), the labels nudged apart so they never overlap, and each has its own marker: circle, triangle, square, diamond. The legend under the chart shows the line with its marker and the full name. The colors (`colors.nDiff`: `#2a78d6`, `#b85c00`, `#0f7f5e`, `#a0349b`) are each 3:1 or more against the card, and pass the dataviz validator's color-vision checks with all pairs compared, since any two lines can cross (worst pair ΔE 8.3 under protanopia, 19.8 with full color vision).
15. **The chart is one tab stop.** It is a labelled group that names the view and how many points it has. Left and right step through the points, Home and End jump to the ends; each step shows the tooltip and a live region reads it ("Aug 3, 2026 to Aug 30, 2026 · 702 games. 1 differs: median 1.8 s, n 1,802. …"). Leaving the chart hides the tooltip, and switching view starts the chart afresh, so a tooltip from one view never shows in the other.
16. **Tooltip lines are short enough for a phone**: the group and its ratio, then the interval, then picks and expected, each on its own line. At 390px a single line per group ran off the card.
17. **Not in this change:** per-pattern lines and sparklines in the pattern table.

## Not changed, noted for later

- The `day` param is kept when switching tabs, as the filters are. The Set types page ignores it.
- The Data updated time only changes on reload, since API responses are kept for the session.
