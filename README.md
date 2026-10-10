# set-stats

tracker for your Set games on setwithforks (the site's source code can be found [here](https://github.com/eltoder/setwithfriends)) and the original setwithfriends (source [here](https://github.com/ekzhang/setwithfriends)).

the profile page shows up to 100 of your most recent games and a few all-time stats. this tool downloads your full game history from either site, or both, to one local database and computes additional stats.

making this public in case anyone finds it useful!

## current stats available

for each game mode, split into solo and multiplayer:

- number of finished and unfinished games
- average game time
- pace

across three windows:

- all-time history
- last 30 days
- last 10 finished games

some definitions:

- **finished**: the game was completed
- **unfinished**: the game started but was not completed
- **solo**: you were the only player
- **multiplayer**: anything else
- **pace**: average time from the previous accepted set (by any player) to each set you found. the first set of a game is timed from the start of the game.

things to keep in mind:

- games that never left the lobby are excluded from stats
- practice games are excluded from stats (matching the site's own convention)
- average game time covers finished games only
- multiplayer game avg time is the length of the game for everyone, not a measure of your own speed
- multiplayer pace only counts sets that you won
- a resumed game can produce a huge gap and skew the pace. to leave such breaks out, use `npm run stats -- --drop-breaks` or the **Drop breaks** checkbox in the web UI (see **breaks** below)
- games from both sites are counted together
- sets found in unfinished games will count toward pace in the all-time and 30-day windows, but not in the last 10 finished games window. time after the last set is not included.

## setup

### 0. requirements

- node.js 22 or newer
- some games played on setwithforks or setwithfriends
- a browser with developer tools to get your sign-in token

### 1. get the code

fork this repo. then, run

```bash
git clone https://github.com/<your-username>/set-stats.git
cd set-stats
npm install
```

in command line.

### 2. set user ID

the two sites are separate, so you have a different user ID on each. `lib/config.js` has one profile per site: `forks` for setwithforks.com and `swf` for setwithfriends.com. commands that talk to a site use the one named by the `SET_SITE` environment variable, which defaults to `forks`.

open your profile page on each site you play on. your user ID is the last part of the url:

```
https://setwithforks.com/profile/<your-user-id>
https://setwithfriends.com/profile/<your-user-id>
```

open `lib/config.js` and replace the `uid` of each site's profile with your user ID on that site. leave the other values as they are.

### 3. add sign-in token

the site's database only answers requests that carry a sign-in token, so the tool borrows the one your browser already has. this works whether you log in to an account or play as a guest.

1. go to the site in the browser you usually play in
2. open dev tools
3. (in Chrome) go to Application > IndexedDB > `firebaseLocalStorageDb` > `firebaseLocalStorage`.
4. copy the value at `value.stsTokenManager.refreshToken`
5. in the project's `data` folder (create it if needed), create a file named `token.json` for setwithforks, or `token-swf.json` for setwithfriends:

```json
{ "refreshToken": "paste-your-token-here" }
```

treat these files like passwords; anyone with this token can act as you on the site. the `data` folder is included in `.gitignore` so git will not commit it. don't share it or paste it anywhere else.

the tool exchanges the refresh token for a short-lived access token, and gets a new one every hour during a long sync. setwithfriends may refuse that exchange from outside its website (you would see an `auth:` error mentioning a referer). in that case, copy `value.stsTokenManager.accessToken` instead and use it directly:

```json
{ "accessToken": "paste-your-access-token-here" }
```

an access token lasts about an hour and can't be renewed by the tool. when it runs out, the command stops with a message saying so; paste a fresh one from the browser (reloading the site gives you a new one) and run the command again. sync continues where it stopped.

### 4. check it works

run

```bash
npm run check                 # setwithforks
SET_SITE=swf npm run check    # setwithfriends
```

you should see `200` followed by your display name. if not, see **troubleshooting** below.

## usage

run

```bash
npm run sync               # download any setwithforks games you don't have yet
SET_SITE=swf npm run sync  # same for setwithfriends
npm run stats              # print your stats
npm run rebuild:new        # update the database tables with newly synced games
```

the first sync will download all of your game history and may take a few minutes. subsequent syncs only fetch games played since the last sync. run them whenever you want up-to-date stats.

`npm run sync -- --limit 20` fetches at most 20 games, newest first. use it for a trial run; running sync again picks up the rest.

### syncing from setwithfriends

setwithfriends moves a game's moves out of its database two weeks after the game, so for most games there is nothing to read at first. sync asks the site to bring each started game back (the same thing the site's own pages do when you open an old game) and then reads it. if the site says it has no copy at all (opening the game on the site then shows "not found"), the game is left out and recorded in the `sync_skipped` table, and sync never asks for it again. if the site says it restored a game but there is still no data, the game is not saved and the next sync tries again. sync lists both kinds at the end.

to have sync try the skipped games again, run `sqlite3 data/games.db "DELETE FROM sync_skipped"`.

to go easy on the site, sync fetches 2 games at a time from setwithfriends with at most 2 requests in flight, so a first sync of thousands of games takes a long time. it saves each game as soon as it arrives, so you can stop it with Ctrl+C and run it again later.

games from setwithfriends are stored with ids starting with `swf:`, so they can't clash with setwithforks ids.

### breaks

if you took a break in the middle of a game, the gap before the next set can be many minutes and drags the average up. with `npm run stats -- --drop-breaks`, or the **Drop breaks** checkbox in the web UI, any gap longer than 50 times the median gap of its own game counts as a break: it is left out of pace, and subtracted from the game's time. gaps under 100 ms (sets that reached the site in a burst, e.g. after a dropped connection) don't count toward that median. this is off by default. the full game page has its own **Drop breaks** switch.

### bad timing

no one finds a set in under 100 ms, so a solo game with such a gap has timestamps that are off. `npm run stats` and the web UI's time stats skip these games by default; `npm run stats -- --keep-bad-timing`, or unticking **Skip bad timing** in the web UI, keeps them. the web UI still lists them, tagged "Bad timing".

avoid syncing while you have a game in progress. it will be saved as unfinished, and unfinished games are only rechecked and updated in the local database if you sync again within a day of when the game was created.

### web UI

```bash
npm run ui
```

builds the web app and starts a local server at http://localhost:3000 (set `PORT` to use another port). open it in your browser for:

- a solo dashboard per game mode:
  - headline numbers: your average pace and game time over your last 5 games, each saying how it compares with the 5 before, your fastest game, and how many games you've finished
  - an activity calendar. click a day to list that day's games and times
  - a pace or game time trend with a rolling mean, median or aoX. its **Range** is either a date range or a number of recent games, and the line under it says how many games that covers
  - a by-window table (the same numbers as `npm run stats`) and your records: every new best game time, with how much it beat the last one
  - your most recent games, and a search box that finds any game by part of its id, or by a link to it pasted from the site. "Play again" games are grouped under the game they followed
- a page per game with the time you took for each set, and a step-through replay of the board at each of your finds (normal mode)
- a set types page (normal mode): which kinds of sets you take more or less often than chance would, by how many features differ and by which ones, with recent examples, whether you take sets with newly dealt cards, and where on the board you pick cards from

run `npm run sync` and `npm run rebuild:new` first; the UI reads the database tables, not the raw downloads. the header says when the data last changed: "Data updated" is when `npm run rebuild` or `rebuild:new` last finished. the UI keeps what it has loaded until you reload the page, so reload after a rebuild. it opens `data/games.db` read-only, only listens on your own computer, and never contacts the site. stop it with Ctrl+C.

to work on the UI itself, run `node bin/ui.js` in one terminal and `npm run ui:dev` in another. the second serves the app with hot reload and forwards API calls to the first.

### all commands

| command               | what it does                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`       | check that your token and user ID work on the site named by `SET_SITE`                                                                                                                |
| `npm run sync`        | download new games from the site named by `SET_SITE` (default `forks`; `swf` for setwithfriends). `-- --limit N` fetches at most N games                                              |
| `npm run stats`       | print summary stats for both sites together. `-- --drop-breaks` leaves breaks out, `-- --keep-bad-timing` keeps bad-timing games (see above)                                          |
| `npm run rebuild:new` | turn synced games into database tables, replaying only games that haven't been processed yet. fast; use this after every sync                                                         |
| `npm run rebuild`     | same, but rebuilds the board tables for every game from scratch (about a minute for 20,000 games). use it after updating the code or `vendor/`, or if `rebuild:new` reports a problem |
| `npm run ui`          | build and start the web UI at http://localhost:3000 (see **web UI** above)                                                                                                            |
| `npm test`            | run the tests (see [test/README.md](test/README.md))                                                                                                                                  |

only `sync` and `check` contact a site. everything else, the web UI included, works offline from your local copy.

if you change the code, `npm run format` formats it with Prettier and `npm run lint` checks it with ESLint. GitHub Actions runs the format check, lint and tests on every pull request and every push to `main` (see `.github/workflows/ci.yml`).

## where is my game data?

your games are stored in `data/games.db`, an SQLite file. it is not committed to git. to back it up, copy the file (along with `games.db-wal` and `games.db-shm` if they exist), ideally while no command is running. if you delete it, the next sync downloads everything again.

the database has:

- the downloaded JSON for each game, kept as-is, and which site it came from (`sync_raw`)
- every game and every selection anyone made in it, for all modes (`games`, `events`)
- lookup tables of all 81 cards and 1080 sets (`cards`, `sets`)
- for normal-mode games, the board at every set found and every set that was available on it (`finds`, `board_sets`, and `my_finds` for just yours)
- for the set types page, totals per game and the type of each set you took, saved so the page is quick (`game_set_types`, `my_find_types`)

see [docs/schema.md](docs/schema.md) for every table and column.

to inspect directly with SQL queries, try commands like

```bash
sqlite3 data/games.db "SELECT mode, status, COUNT(*) FROM games GROUP BY mode, status"
```

## documentation

- [docs/schema.md](docs/schema.md): tables, columns and what they mean
- [docs/architecture.md](docs/architecture.md): how data flows from the site to the tables, how games are replayed, and how rebuilds work
- [test/README.md](test/README.md): what the tests cover and how to add more

## troubleshooting

| what you see                                                          | possible cause                                                                                                                                       |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| error starting with `auth:` that mentions an invalid or expired token | the token was copied incompletely, or with extra quotes or spaces. copy it again. this can also happen after signing out of the site.                |
| `npm run check` prints `200 null`                                     | the `UID` in `lib/config.js` does not match any user. recheck your profile URL.                                                                      |
| `401` or `Permission denied`                                          | the token is not being accepted. repeat setup step 3.                                                                                                |
| stats look wrong for a new game mode                                  | the copy of the site's game logic is out of date. see **keeping up with the site** below.                                                            |
| `rebuild` prints `failed (...): replay <game id>: ...`                | the replay disagrees with the site for that game. it is skipped and the rest still build. run `npm test` and check whether `vendor/` is out of date. |
| `auth:` error mentioning a referer                                    | setwithfriends refuses to renew tokens from outside its website. use an `accessToken` instead (setup step 3).                                        |
| `the accessToken in ... expired`                                      | access tokens last about an hour. paste a fresh one from the browser and run the command again.                                                      |
| sync says some games have no data on the site                         | the site has no archived copy of them (the site shows "not found" for them too). they are left out and not tried again; nothing to do.               |
| sync says some games were restored but still had no data              | probably temporary. they are tried again on the next sync.                                                                                           |

## keeping up with the site

`vendor/game.js` is a copy of setwithforks' game logic, and `vendor/setwithfriends/util.js` a copy of the game logic part of setwithfriends' `src/util.js`. they are used to work out which sets counted, and to check this project's replay. the commit each was copied from is noted at the top of the file.

to update the setwithforks copy:

1. download the latest `src/game.js` from eltoder/setwithfriends into `vendor/game.js`.
2. replace its first line (the import from `./util`) with the two stub functions found at the top of the current copy.
3. update the commit hash in the comment.
4. run `npm test`. one test replays all your games with both this project's replay and the new copy of the site's code, and fails if they disagree.
5. run `npm run rebuild`.

to update the setwithfriends copy, copy the functions from `checkSet` through `computeState` in its `src/util.js` (leaving out `generateName`) into `vendor/setwithfriends/util.js`, update the commit hash, and run `npm test`. if its `removeCards` changed, port the change to `removeCardsSwf` in `lib/replay.js`.

## BE CONSIDERATE

this tool reads from databases maintained by other people, so i tried to keep its load small: it fetches each finished game once and limits how many requests run at the same time. setwithfriends is a hobby project, and restoring an archived game costs it more than a plain read, so sync is slower there on purpose. if you modify it, keep that property. don't remove the local cache, raise the batch size by a lot, or run it in a tight loop.

game data on the site is readable by any signed-in user, so this tool can technically read other players' games. it is meant for looking at your own.

## credits

game logic in `vendor` comes from [Set with Forks](https://github.com/eltoder/setwithfriends), a fork of [Set with Friends](https://github.com/ekzhang/setwithfriends) built by Eric Zhang and Cynthia Du, and from Set with Friends itself (`vendor/setwithfriends`), both used under the MIT license (see `vendor/LICENSE.txt` and `vendor/setwithfriends/LICENSE.txt`).

the squiggle in the web UI's logo and favicon uses the squiggle path from Set with Friends (`public/index.html`), also under the MIT license (`vendor/setwithfriends/LICENSE.txt`).

this project is not affiliated with Set with Forks, Set with Friends, Set Enterprises, Inc., or the SET® card game.
