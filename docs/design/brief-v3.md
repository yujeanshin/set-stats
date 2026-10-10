# set stats web UI: version 3

Version 3 reworks the Solo page on top of version 1 ([brief.md](brief.md)) and version 2 ([brief-v2.md](brief-v2.md)), in six changes. This file records what each change built, why, and the decisions behind it, in the same style as the earlier decisions logs. Where this file and an earlier brief disagree, this file wins.

1. **Headline tiles**: averages first, with a change against the 5 games before.
2. **Data updated**: when the data on screen last changed, in the header.
3. **Calendar days**: click a day to list its games.
4. **Trend card**: a title that says what it shows, and one Range control.
5. **Recent games, search and Records**: in place of one long games list.
6. **Layout**: the position heatmap moves to the Set types page; Records takes its place.

The working conventions are unchanged: metric math lives in `lib/` and is unit tested, the React app only formats and draws, and filters live in the URL. Everything new is a real button, link or input with a label and can be reached by keyboard. Existing components were not audited; that is a separate accessibility pass.

## 1. Headline tiles

Motivation: I glance at these after refreshing. The averages matter most, then the fastest game; the game count barely changes.

### What was built

- **Order:** Average pace (last 5 games), Average game time (last 5 games), Fastest game, Games finished / started.
- **Change against the 5 before** under each average: "0.2 s faster than the 5 before", "12 s slower than the 5 before", or "Same as the 5 before". `recentAverage` in `lib/metrics.js` returns the tile's mean ± standard deviation as before, plus `delta`: the mean of the last 5 minus the mean of the 5 before them, using the tile's own rule for "last 5" (games with at least one find for pace, finished games for game time). No delta with fewer than 10 such games.

### Decisions log

1. **Words, not a sign or a color.** Lower is better, so "−0.2" or a green number is ambiguous. The note is muted text with no color: the palette (brief.md section 8) has no good or bad colors, and the words carry the meaning on their own.
2. **Precision matches the value above it.** Pace changes have one decimal ("0.2 s"). Game time changes are whole seconds under a minute ("12 s") and m:ss from a minute ("1:05"). A change that rounds to zero at that precision reads "Same as the 5 before", so the note never says "0.0 s faster".
3. **The standard deviation is unchanged**: still across the last 5 per-game values (brief.md decision 2).

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

- **Title** follows the metric toggle: "Pace trend" or "Game time trend".
- **One Range control** (`RangeControls.jsx`, shared with the Set types page) in place of Date range and Last N games: a select with two groups, Dates (Last 7 days, Last 30 days, Last 90 days, All time, Custom dates) and Most recent games (Last 50, 100 or 500 games, Custom number of games). Custom dates shows From and To; a custom number shows a "Number of games" input. A choice is one or the other, never both.
- **Scope line** under the control: "2,392 games, Jul 12 to Oct 9", the number of games in the selection and the days of the first and last of them. Years are shown when either day isn't in the current year. `/series` and `/types` return it as `scope` (`gameSpan` in `lib/metrics.js`). The Set types page adds its finds: "· 472,353 finds".
- **Defaults are unchanged:** 90 days on Solo, All time on Set types.

### Decisions log

1. **A select, not toggle buttons.** Nine choices in one row of toggle buttons don't fit at phone width, and two rows of buttons (dates and games) would look as if both could be set. One select with labelled groups makes "one or the other" plain.
2. **The scope line counts the games plotted**, so on Game time it counts finished games only, and it names the first and last game's days rather than the range's bounds. "Last 30 days" with no games in its first week then says so.
3. **"Games in range" is gone** from the trend's stats, since the scope line says it. Average, best and change over range stay.
4. **URL parameters (Set types).** Dates: `range` (absent for All time) with `from` and `to` for custom dates, as before. Games: `range=games` and `lastN`. An older link with `lastN` and no `range=games` still opens as Most recent games. An older link with both a date range and `lastN` now gets the last N games and ignores the dates, since the two can no longer combine.
5. **Custom number of games** keeps the number from the preset it was chosen from, so the scope doesn't jump; an empty box means all games, and the scope line says how many that is. A typed 100 stays under Custom rather than turning into the Last 100 games preset.
6. **The trend card keeps its Range in local state**, as in version 2. The Set types page keeps it in the URL.

## 5. Recent games, search and Records

Motivation: one long pageable list of 17,000 games was clunky. What I actually do is look up a day (now the calendar), find a game by its three-word id, or jump to my records. Not a filterable table.

### What was built

- **Recent games** (`GamesList.jsx`): 10 rows, newest first, with Load more adding 10 at a time. Columns and tags as before. The table is now `GameTable.jsx`, shared with the day panel.
- **Search** (`GameSearch.jsx`), at the top of that card: "Find a game by id or link". It searches on the server for any started game whose id contains the text, case-insensitive, whatever the top-bar filters and mode, solo or not. It lists the 10 newest matches (date and time, mode, players when more than one, time or "unfinished", and the id), each opening the game dialog, with how many matched in all. It searches 250 ms after typing stops.
- **Pasted URLs:** `gameIdQuery` (`lib/config.js`) reads `…/game/<id>` on either site as that game's local id, with `swf:` for setwithfriends, and `…/games/<id>` (this UI's own game page) as a local id.
- **API:** `GET /api/games/search?q` returns `q` as searched, `total` and `games`.
- **Records** (`Records.jsx`): every game that set a new best game time, newest first: the date (opening the game), the time, and how much it beat the previous best ("4.1 s"; the first is "first finish"). About 8 rows show and the rest scroll inside the card. It follows the top-bar filters and not the trend's Range. `/summary` returns `records`, from `records()` in `lib/metrics.js`, which `recordGameIds` (the chart's diamonds and the Best time badge) now uses, so the two always agree.

### Decisions log

1. **The id shown in search results** is the full local id, so it's clear why each matched.
2. **Results sit in an outlined box** above the Recent games table. Without it the matches read as the first rows of Recent games.
3. **Ties are not records**, as before: a game equal to the best time doesn't get a diamond or a row.
4. **The Records table is a focusable region**, so it can be scrolled with the keyboard, as well as by tabbing through its links.

## 6. Layout

Motivation: the position heatmap is analysis, not a summary, and under the chart it was unclear which time range it covers.

### What was built

- **Solo page**, top to bottom: filters, headline tiles, calendar (with its day panel), trend, By window beside Records, Recent games.
- **Where I pick from** moves, unchanged, to the bottom of the Set types page. It follows the top-bar filters but not that page's Range. The next change reworks it.

### Decisions log

1. **ByWindow lost its `alone` prop**, which kept it half width when the heatmap was hidden for non-normal modes. Records is always beside it now.
2. **On the Set types page the heatmap sits in a plain box**, because its card's row sizing (`flex: 1 1 420px`) would otherwise make it 420px tall in that page's column.

## Not changed, noted for later

- The `day` param is kept when switching tabs, as the filters are. The Set types page ignores it.
- "Where I pick from" on the Set types page doesn't follow the Range above it.
- The Data updated time only changes on reload, since API responses are kept for the session.
