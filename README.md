# set-stats

tracker for your Set games on setwithforks (the site's source code can be found [here](https://github.com/eltoder/setwithfriends)).

the profile page shows up to 100 of your most recent games and a few all-time stats. this tool downloads your full game history to a local database and computes additional stats.

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
- a resumed game can produce a huge gap and skew the pace
- sets found in unfinished games will count toward pace in the all-time and 30-day windows, but not in the last 10 finished games window. time after the last set is not included.

## setup
### 0. requirements
- node.js 20 or newer
- some games played on setwithforks
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
open your profile page on setwithforks.com. your user ID is the last part of the url:
```
https://setwithforks.com/profile/<your-user-id>
```
open `lib/config.js` and replace the value of `UID` with your user ID. leave the `API_KEY` and `DB_URL` as they are. (i haven't tried fetching from the original setwithfriends.com database. at minimum, that would require that site's config values, token, and `game.js`.)
### 3. add sign-in token
the site's database only answers requests that carry a sign-in token, so the tool borrows the one your browser already has. this works whether you log in to an account or play as a guest.
1. go to setwithforks.com in the browser you usually play in
2. open dev tools
3. (in Chrome) go to Application > IndexedDB > `firebaseLocalStorageDb` > `firebaseLocalStorage`.
4. copy the value at `value.stsTokenManager.refreshToken`
5. in the project's `data` folder (create it if needed), create a file named `token.json`:
```json
{ "refreshToken": "paste-your-token-here" }
```
treat this file like a password; anyone with this token can act as you on the site. the `data` folder is included in `.gitignore` so git will not commit it. don't share it or paste it anywhere else.
### 4. check it works
run 
```bash
npm run check
```
you should see `200` followed by your display name. if not, see **troubleshooting** below.

## usage
run
```bash
npm run sync    # download any games you don't have yet
npm run stats   # print your stats
```
the first sync will download all of your game history and may take a few minutes. subsequent syncs only fetch games played since the last sync. run them whenever you want up-to-date stats.

avoid syncing while you have a game in progress. it will be saved as unfinished, and unfinished games are only rechecked and updated in the local database if you sync again within a day of when the game was created.

## where is my game data?
your games are stored in `data/games.db`, an SQLite file. it is not committed to git. to back it up, copy the file. if you delete it, the next sync downloads everything again.

the downloaded JSON for each game is kept as-is in the `sync_raw` table. the `cards` and `sets` lookup tables are filled automatically whenever the database is opened.

to inspect directly with SQL queries, try commands like
```bash
sqlite3 data/games.db "SELECT status, COUNT(*) FROM sync_raw GROUP BY status"
```

## troubleshooting
| what you see | possible cause |
| --- | --- |
| error starting with `auth:` that mentions an invalid or expired token | the token was copied incompletely, or with extra quotes or spaces. copy it again. this can also happen after signing out of the site. |
| `npm run check` prints `200 null` | the `UID` in `lib/config.js` does not match any user. recheck your profile URL. |
| `401` or `Permission denied` | the token is not being accepted. repeat setup step 3. |
| stats look wrong for a new game mode | the copy of the site's game logic is out of date. see **keeping up with the site** below. |

## keeping up with the site
`vendor/game.js` is a copy of the site's game logic, used to replay each game and work out which sets counted. the commit it was copied from is noted at the top of the file.

to update the copy:
1. download the latest `src/game.js` from eltoder/setwithfriends into `vendor/game.js`.
2. replace its first line (the import from `./util`) with the two stub functions found at the top of the current copy.
3. update the commit hash in the comment.

## BE CONSIDERATE
this tool reads from a database maintained by someone else, so i tried to keep its load small: it fetches each finished game once and limits how many requests run at the same time. if you modify it, keep that property. don't remove the local cache, raise the batch size by a lot, or run it in a tight loop.

game data on the site is readable by any signed-in user, so this tool can technically read other players' games. it is meant for looking at your own.

## credits
game logic in `vendor` comes from [Set with Forks](https://github.com/eltoder/setwithfriends), a fork of [Set with Friends](https://github.com/ekzhang/setwithfriends) built by Eric Zhang and Cynthia Du and used under the MIT license (see `vendor/LICENSE.txt`).

this project is not affiliated with Set with Forks, Set with Friends, Set Enterprises, Inc., or the SET® card game.