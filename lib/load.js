const EVENT_COLS = ["push_key", "time_ms", "user_id", "c1", "c2", "c3", "c4", "c5", "c6"];

function int(value, what) {
  if (value == null) return null;
  if (!Number.isInteger(value)) throw new Error(`${what}: expected integer, got ${value}`);
  return value;
}

/** Convert one sync_raw row into a games row and its events, sorted by (time_ms, push_key). */
export function parseRaw({ id, created_at, game_json, data_json }) {
  const game = JSON.parse(game_json);
  const data = JSON.parse(data_json) ?? {};
  if (!game) throw new Error(`${id}: game_json is empty`);

  const row = {
    game_id: id,
    mode: game.mode ?? "normal",
    status: game.status,
    access: game.access ?? null,
    enable_hint: game.enableHint ? 1 : 0,
    host_id: game.host ?? null,
    created_at: int(game.createdAt ?? created_at, `${id} createdAt`),
    started_at: int(game.startedAt, `${id} startedAt`),
    ended_at: int(game.endedAt, `${id} endedAt`),
    pause_time_ms: int(game.pauseTime, `${id} pauseTime`),
    n_players: Object.keys(game.users ?? {}).length,
    seed: data.seed ?? null,
  };

  const events = Object.entries(data.events ?? {})
    .map(([pushKey, e]) => ({
      push_key: pushKey,
      time_ms: int(e.time, `${id}/${pushKey} time`),
      user_id: e.user,
      c1: e.c1,
      c2: e.c2,
      c3: e.c3,
      c4: e.c4 ?? null,
      c5: e.c5 ?? null,
      c6: e.c6 ?? null,
    }))
    .sort((a, b) =>
      a.time_ms - b.time_ms || (a.push_key < b.push_key ? -1 : a.push_key > b.push_key ? 1 : 0)
    )
    .map((e, seq) => ({ game_id: id, seq, ...e }));

  return { game: row, events };
}

const sameEvents = (a, b) =>
  a.length === b.length && a.every((e, i) => EVENT_COLS.every((k) => e[k] === b[i][k]));

/**
 * Parse every sync_raw row into games and events. Safe to rerun: games are
 * upserted, and a game's events are only replaced when they changed (which
 * also cascades away that game's derived rows).
 */
export function loadAll(db) {
  const upsertGame = db.prepare(`
    INSERT INTO games (game_id, mode, status, access, enable_hint, host_id,
                       created_at, started_at, ended_at, pause_time_ms, n_players, seed)
    VALUES (@game_id, @mode, @status, @access, @enable_hint, @host_id,
            @created_at, @started_at, @ended_at, @pause_time_ms, @n_players, @seed)
    ON CONFLICT(game_id) DO UPDATE SET
      mode = excluded.mode, status = excluded.status, access = excluded.access,
      enable_hint = excluded.enable_hint, host_id = excluded.host_id,
      created_at = excluded.created_at, started_at = excluded.started_at,
      ended_at = excluded.ended_at, pause_time_ms = excluded.pause_time_ms,
      n_players = excluded.n_players, seed = excluded.seed
  `);
  const selectEvents = db.prepare(
    `SELECT ${EVENT_COLS.join(", ")} FROM events WHERE game_id = ? ORDER BY seq`
  );
  const deleteEvents = db.prepare("DELETE FROM events WHERE game_id = ?");
  const insertEvent = db.prepare(`
    INSERT INTO events (game_id, seq, ${EVENT_COLS.join(", ")})
    VALUES (@game_id, @seq, ${EVENT_COLS.map((c) => "@" + c).join(", ")})
  `);

  const stats = { games: 0, events: 0, gamesWithNewEvents: 0 };
  db.transaction(() => {
    for (const raw of db.prepare("SELECT * FROM sync_raw ORDER BY created_at, id").all()) {
      const { game, events } = parseRaw(raw);
      upsertGame.run(game);
      stats.games++;
      stats.events += events.length;
      if (sameEvents(selectEvents.all(game.game_id), events)) continue;
      deleteEvents.run(game.game_id);
      for (const e of events) insertEvent.run(e);
      stats.gamesWithNewEvents++;
    }
  })();
  return stats;
}
