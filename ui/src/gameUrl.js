// Links to a game on the site it was played on. Site names, urls and id
// prefixes come from lib/config.js, passed in by vite.config.js.
/* global __SITES__ */

/** The site a game was played on: { source, name, url, idPrefix }. */
export function gameSite(game) {
  // TODO: the API doesn't send games.source yet. Until it does, tell the
  // sites apart by the id prefix (Set with Forks ids have none).
  return (
    __SITES__.find((s) => s.source === game.source) ??
    __SITES__.find((s) => s.idPrefix && game.game_id.startsWith(s.idPrefix)) ??
    __SITES__.find((s) => !s.idPrefix)
  );
}

/** The game's page on its site, /game/:id with the site's own id. */
export function gameUrl(game) {
  const site = gameSite(game);
  const id = game.game_id.slice(site.idPrefix.length);
  return `${site.url}/game/${encodeURIComponent(id)}`;
}
