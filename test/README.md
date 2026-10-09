# tests

```bash
npm test
```

runs every `test/*.test.js` file with node's built-in test runner (`node:test`); no extra packages. takes about a second.

the tests never write to `data/games.db`. each one builds its own in-memory database. the cross-check test only reads your local database, and is skipped if there isn't one.

## files

| file                 | what it checks                                               |
| -------------------- | ------------------------------------------------------------ |
| `fixture.js`         | not a test: shared data and helpers (see below)              |
| `replay.test.js`     | the replay reproduces a real game exactly                    |
| `lookups.test.js`    | the `cards` and `sets` tables                                |
| `load.test.js`       | parsing `sync_raw` into `games` and `events`                 |
| `derive.test.js`     | the `finds` and `board_sets` tables, and both rebuild modes  |
| `crosscheck.test.js` | the replay agrees with the site's own code on all your games |

### `replay.test.js`

uses the real game `abandoned-tired-property`, with values taken from the site:

- the opening board, positions 0-11
- for all 25 events: they are all valid, plus the board size, number of sets on the board, and board positions of the clicked cards
- the first `elapsed_ms` is 2625 (measured from `startedAt`)
- the 6 cards left at the end contain no set
- events that repeat a card or reuse a taken card are skipped
- an accepted event that doesn't fit the board throws an error naming the game

this is the most important test. if it fails, nothing built on the replay can be trusted.

### `lookups.test.js`

- 81 cards and 1080 sets
- `n_diff` counts are 108, 324, 432, 216 for 1-4 differing features
- every set is valid, sorted, has the right `diff_mask`, and every card appears in exactly 40 sets
- the example set from the schema docs
- filling the lookups again adds no duplicates and repairs a missing row

### `load.test.js`

uses the fixture game plus two made-up games: an ultraset game (with `c4`, a pause time, hints and 2 players) and a `waiting` game with no events or start time.

- every mode is loaded, and each game field is mapped to the right column
- events are numbered by time with ties broken by push key, even when the JSON lists them in another order; cards keep click order
- times are stored as integers; a fractional time is rejected
- loading twice adds no rows
- reloading an unchanged game keeps its derived rows
- a re-synced game gets its new events, and its stale derived rows are removed

### `derive.test.js`

loads the fixture game and a copy of it marked `shuffle` mode, then rebuilds.

- only the normal game gets derived rows
- every `finds` row matches the fixture: board size, number of sets, positions, `elapsed_ms`, `deck_left`
- every `board_sets` row's positions point at its cards on the board
- exactly one set per find is marked chosen, and it's the one clicked
- `n_fresh` is NULL on the first find, and correct on the second
- `derive_version` is written; `my_finds` follows `meta.my_user_id`
- rebuilding again gives identical rows
- `rebuild:new` derives only games without finds, re-derives re-synced games, and falls back to a full rebuild when `derive_version` doesn't match
- a replay mismatch fails the rebuild and leaves `derive_version` unset

### `crosscheck.test.js`

replays every normal game in `data/games.db` with both `lib/replay.js` and the site's `computeState` from `vendor/game.js`, and checks they agree on the valid events, the cards left at the end, and the final board size. this covers thousands of real games instead of one, and catches the replay drifting from the site after `vendor/game.js` is updated.

it needs `npm run rebuild` to have loaded `games` and `events` first. without `data/games.db` it is skipped.

## `fixture.js`

- `GAME`, `EXPECTED`, `EVENTS`, `OPENING_BOARD`, `LEFTOVER`: the fixture game and the values expected from it
- `fixtureRaw()`: the fixture as a `sync_raw` row, shaped the way `bin/sync.js` stores it
- `insertRaw(db, row)`: insert or update a `sync_raw` row
- `memoryDb()`: a fresh in-memory database with the full schema and lookups
- `count(db, sql)`: shorthand for `SELECT COUNT(*) FROM ...`

## adding tests

- name new files `something.test.js` so `npm test` picks them up
- build data with `memoryDb()` and `insertRaw()`. don't import `lib/db.js`, which opens your real database
- if you change the replay or derive logic, the fixture values in `fixture.js` come from the real site and should not be edited to make a test pass
