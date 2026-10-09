# database schema

everything lives in one SQLite file, `data/games.db`. the tables are created by `lib/schema.js` (current `schema_version`: 3) whenever any command opens the database.

tables fall into four groups:

| group          | tables                     | written by                      | can be rebuilt?              |
| -------------- | -------------------------- | ------------------------------- | ---------------------------- |
| sync cache     | `sync_raw`, `sync_skipped` | `npm run sync`                  | only by re-downloading       |
| raw            | `games`, `events`          | `npm run rebuild` (load step)   | yes, from `sync_raw`         |
| static lookups | `cards`, `sets`            | automatically on open           | yes, generated from scratch  |
| derived        | `finds`, `board_sets`      | `npm run rebuild` (derive step) | yes, from `games` + `events` |

plus `meta` (key/value settings) and the `my_finds` view.

all new tables are `STRICT`, so SQLite rejects values of the wrong type (for example a fractional timestamp). all times are integer milliseconds since the epoch.

foreign keys are enforced (`PRAGMA foreign_keys = ON`). deleting a game cascades to its events, deleting an event cascades to its find, and deleting a find cascades to its board sets.

## cards and sets

a **card** is a 4-character string of digits `0`-`2`, in the order color, shape, shade, number. for example `2102` is color 2, shape 1, shade 0, number 2.

three cards form a **set** when, in each position, the digits are all equal or all different. given two cards, the third is `(6 - a - b) % 3` per digit.

- **set_id**: the three cards sorted as strings and joined with `-`, e.g. `0012-0120-0201`
- **diff_mask**: one character per feature, `1` if the feature differs across the set, `0` if it is the same. `0012-0120-0201` has mask `0111`

## sync cache

### `sync_raw`

the exact JSON downloaded from the site, one row per game. this is the source of truth for everything else; `npm run sync` writes only here.

| column       | type    | notes                                                             |
| ------------ | ------- | ----------------------------------------------------------------- |
| `id`         | TEXT PK | game id, with the site's prefix (`swf:` for setwithfriends)       |
| `created_at` | INTEGER | from `userGames/{uid}`                                            |
| `status`     | TEXT    | copied out of `game_json` so sync can tell which games to refetch |
| `game_json`  | TEXT    | `games/{id}` from Firebase                                        |
| `data_json`  | TEXT    | `gameData/{id}` from Firebase (seed or deck, and events)          |
| `source`     | TEXT    | `forks` (setwithforks) or `swf` (setwithfriends)                  |

### `sync_skipped`

games sync has given up on, so it never fetches them again. today that means setwithfriends games for which the site has no archived data. they are not in `sync_raw` or any table below. delete rows here to have sync try those games again.

| column       | type    | notes                           |
| ------------ | ------- | ------------------------------- |
| `id`         | TEXT PK | game id, with the site's prefix |
| `source`     | TEXT    | `forks` or `swf`                |
| `reason`     | TEXT    | why, e.g. `no archived data`    |
| `skipped_at` | INTEGER | when sync gave up on it (ms)    |

## raw tables

parsed from `sync_raw` by `lib/load.js`. every game mode is kept.

### `games`

| column          | type         | from            | notes                                                                             |
| --------------- | ------------ | --------------- | --------------------------------------------------------------------------------- |
| `game_id`       | TEXT PK      | key             | same as `sync_raw.id`, so setwithfriends ids start with `swf:`                    |
| `mode`          | TEXT         | `mode`          | `normal`, `puzzle`, `setchain`, `ultraset`, ... (defaults to `normal` if missing) |
| `status`        | TEXT         | `status`        | `waiting`, `ingame`, `done`                                                       |
| `access`        | TEXT         | `access`        | `private` or `public`                                                             |
| `enable_hint`   | INTEGER      | `enableHint`    | 0 or 1                                                                            |
| `host_id`       | TEXT         | `host`          | user id                                                                           |
| `created_at`    | INTEGER      | `createdAt`     |                                                                                   |
| `started_at`    | INTEGER NULL | `startedAt`     | NULL for games that never left the lobby                                          |
| `ended_at`      | INTEGER NULL | `endedAt`       | NULL for unfinished games                                                         |
| `pause_time_ms` | INTEGER NULL | `pauseTime`     |                                                                                   |
| `n_players`     | INTEGER      | `users`         | number of keys in `users`                                                         |
| `seed`          | TEXT         | `gameData.seed` | `v1:` + 32 hex chars; determines the deck order (setwithforks)                    |
| `source`        | TEXT         | `sync_raw`      | `forks` or `swf`; picks the board refill rule and my user id                      |
| `deck`          | TEXT NULL    | `gameData.deck` | JSON array of the 81 cards in deck order (setwithfriends, which has no seed)      |

### `events`

one row per card selection submitted to the site, valid or not.

| column           | type      | notes                                                                                    |
| ---------------- | --------- | ---------------------------------------------------------------------------------------- |
| `game_id`        | TEXT      | FK to `games`                                                                            |
| `seq`            | INTEGER   | 0-based position after sorting the game's events by `time_ms`, ties broken by `push_key` |
| `push_key`       | TEXT      | Firebase key of the event; unique within a game                                          |
| `time_ms`        | INTEGER   |                                                                                          |
| `user_id`        | TEXT      | who submitted it                                                                         |
| `c1`, `c2`, `c3` | TEXT      | cards in the order they were clicked                                                     |
| `c4`, `c5`, `c6` | TEXT NULL | only used by modes with bigger sets (ultraset, 4set, ...)                                |

primary key `(game_id, seq)`.

## static lookups

generated by `lib/lookups.js` from `lib/cards.js`. independent of your games.

### `cards` (81 rows)

| column                              | type    | notes                               |
| ----------------------------------- | ------- | ----------------------------------- |
| `card`                              | TEXT PK | `0000` ... `2222`                   |
| `color`, `shape`, `shade`, `number` | INTEGER | generated from digits 1-4 of `card` |

### `sets` (1080 rows)

| column           | type    | notes                                    |
| ---------------- | ------- | ---------------------------------------- |
| `set_id`         | TEXT PK | `c1-c2-c3`                               |
| `c1`, `c2`, `c3` | TEXT    | FK to `cards`, sorted so `c1 < c2 < c3`  |
| `diff_mask`      | TEXT    | e.g. `0111`                              |
| `n_diff`         | INTEGER | generated: number of `1`s in `diff_mask` |

`n_diff` counts: 108 sets differ in 1 feature, 324 in 2, 432 in 3, 216 in all 4.

## derived tables

built by replaying each **normal-mode** game (`lib/replay.js`, `lib/derive.js`). other modes have no rows here. see [architecture.md](architecture.md) for how the replay works.

### `finds`

one row per **valid** event, i.e. an event the site accepted as a set. events that reused a taken card or repeated a card are skipped.

| column           | type    | notes                                                                                                           |
| ---------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `game_id`, `seq` |         | PK, FK to `events`                                                                                              |
| `user_id`        | TEXT    | who found it                                                                                                    |
| `elapsed_ms`     | INTEGER | `time_ms` minus the previous valid event's `time_ms` (anyone's), or minus `games.started_at` for the first find |
| `board`          | TEXT    | JSON array of the cards on the board just before the event; array index = board position                        |
| `board_size`     | INTEGER | length of `board` (usually 12; 15 or 18 when the site added cards, fewer near the end)                          |
| `n_sets`         | INTEGER | number of sets on `board`                                                                                       |
| `deck_left`      | INTEGER | cards not yet dealt to the board                                                                                |

### `board_sets`

one row per set available on the board of each find.

| column           | type         | notes                                                                                                |
| ---------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| `game_id`, `seq` |              | FK to `finds`                                                                                        |
| `set_id`         | TEXT         | FK to `sets`                                                                                         |
| `p1`, `p2`, `p3` | INTEGER      | board positions of `sets.c1`, `c2`, `c3`, in that order                                              |
| `is_chosen`      | INTEGER      | 1 for the set taken in this event, otherwise 0. exactly one per find                                 |
| `n_fresh`        | INTEGER NULL | how many of the set's cards were not on the board at the previous find. NULL for a game's first find |

primary key `(game_id, seq, set_id)`.

## meta and views

### `meta`

| key              | written by | meaning                                                                                                                                                           |
| ---------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `my_user_id`     | every open | my user id on setwithforks (`SITES.forks.uid` in `lib/config.js`)                                                                                                 |
| `my_user_id:swf` | every open | my user id on setwithfriends (`SITES.swf.uid`)                                                                                                                    |
| `schema_version` | every open | version of the table layout in `lib/schema.js`                                                                                                                    |
| `derive_version` | rebuild    | version of the derive logic that produced `finds` and `board_sets`. cleared at the start of a full rebuild, so if it is missing the derived tables are incomplete |
| `last_sync_at`   | sync       | time of the last successful sync (ms)                                                                                                                             |

### `my_finds` (view)

`finds` filtered to my finds: `user_id` equals `meta.my_user_id` for setwithforks games and `meta.my_user_id:swf` for setwithfriends games.

## migrations

schema v2 added `sync_raw.source`, `games.source` and `games.deck`. an older database gets them on its next open, with `source = 'forks'` for every existing row, so nothing is downloaded again. schema v3 added the `sync_skipped` table.
