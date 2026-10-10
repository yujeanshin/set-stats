// Finding games by id for the web UI's search (brief-v3 item 5). Pure: no
// database access. lib/queries.js runs the match; this reads what was
// typed and groups the matches into Play again series.
import { SITES } from "./config.js";

/**
 * What to search game ids for (brief-v3 item 5), lowercased: the text as
 * typed, or for a pasted game URL, the local id it names. A site's own
 * URL (https://setwithfriends.com/game/<id>) gets that site's prefix; any
 * other URL ending in /game/<id> or /games/<id>, such as this UI's, is
 * taken as a local id.
 */
export function gameIdQuery(text) {
  const q = text.trim();
  const m = q.match(/^(?:https?:\/\/)?([^/\s]+)\/games?\/([^/?#\s]+)/i);
  if (!m) return q.toLowerCase();
  const host = m[1].toLowerCase().replace(/^www\./, "");
  const site = Object.values(SITES).find((s) => new URL(s.url).host === host);
  let id;
  try {
    id = decodeURIComponent(m[2]);
  } catch {
    id = m[2];
  }
  return ((site?.idPrefix ?? "") + id).toLowerCase();
}

/**
 * The series a game id belongs to. "Play again" on either site starts a
 * new game whose id is the first game's id plus "-1", "-2" and so on, so
 * "abandoned-tired-property-12" is in the series "abandoned-tired-property",
 * as is "abandoned-tired-property" itself. Ids end in a word otherwise.
 */
export function seriesBase(id) {
  const m = id.match(/^(.+)-\d+$/);
  return m ? m[1] : id;
}

/**
 * Matching games (newest first) grouped by series, ordered by each
 * series' newest match: [{ base, head, games }]. `games` are the series'
 * matches, newest first. `head` is the one the results show for the
 * series: the first game, when it matched, otherwise the oldest match.
 */
export function groupSeries(games) {
  const groups = new Map();
  for (const g of games) {
    const base = seriesBase(g.game_id);
    if (!groups.has(base)) groups.set(base, { base, games: [] });
    groups.get(base).games.push(g);
  }
  return [...groups.values()].map(({ base, games }) => ({
    base,
    head: games.find((g) => g.game_id === base) ?? games.at(-1),
    games,
  }));
}
