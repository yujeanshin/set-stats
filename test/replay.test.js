import assert from "node:assert/strict";
import { test } from "node:test";
import { findSets, hasSet } from "../lib/cards.js";
import { replayGame } from "../lib/replay.js";
import { EVENTS, EXPECTED, GAME, LEFTOVER, OPENING_BOARD } from "./fixture.js";

const result = replayGame(GAME, EVENTS);

test("opening board matches the site", () => {
  assert.deepEqual(result.finds[0].board, OPENING_BOARD);
});

test("all 25 events are valid", () => {
  assert.equal(result.finds.length, 25);
  assert.deepEqual(
    result.finds.map((f) => f.seq),
    EVENTS.map((e) => e.seq),
  );
});

test("board size, set count and click positions for every find", () => {
  for (const [i, exp] of EXPECTED.entries()) {
    const f = result.finds[i];
    const label = `event ${i} (${exp.time})`;
    assert.equal(f.board_size, exp.size, `${label} board_size`);
    assert.equal(f.board.length, exp.size, `${label} board length`);
    assert.equal(findSets(f.board).length, exp.nSets, `${label} n_sets`);
    assert.deepEqual(f.positions, exp.pos, `${label} positions`);
    assert.deepEqual(
      f.positions.map((p) => f.board[p]),
      [exp.c1, exp.c2, exp.c3],
      `${label} cards`,
    );
  }
});

test("first elapsed_ms is measured from startedAt", () => {
  assert.equal(result.finds[0].elapsed_ms, 2625);
  assert.equal(result.finds[1].elapsed_ms, EXPECTED[1].time - EXPECTED[0].time);
});

test("6 cards are left at the end and contain no set", () => {
  assert.deepEqual(result.remaining.slice().sort(), LEFTOVER.slice().sort());
  assert.equal(hasSet(result.remaining), false);
  assert.equal(result.boardSize, 6);
});

test("deck_left counts cards not yet on the board", () => {
  assert.equal(result.finds[0].deck_left, 81 - 12);
  assert.equal(result.finds.at(-1).deck_left, 0);
});

test("duplicate and already-taken cards are skipped", () => {
  const events = [
    { ...EVENTS[0], seq: 0 },
    { ...EVENTS[0], seq: 1, time_ms: EVENTS[0].time_ms + 1 },
    { ...EVENTS[1], seq: 2, c3: EVENTS[1].c1 },
    { ...EVENTS[1], seq: 3 },
  ];
  const { finds } = replayGame(GAME, events);
  assert.deepEqual(
    finds.map((f) => f.seq),
    [0, 3],
  );
  assert.equal(finds[1].elapsed_ms, EVENTS[1].time_ms - EVENTS[0].time_ms);
});

test("an accepted event that doesn't fit the board throws, naming the game", () => {
  const notOnBoard = [{ ...EVENTS[1], seq: 0 }];
  assert.throws(
    () => replayGame(GAME, notOnBoard),
    /abandoned-tired-property.*not all on board/,
  );
  const notASet = [{ ...EVENTS[0], seq: 0, c3: OPENING_BOARD[0] }];
  assert.throws(
    () => replayGame(GAME, notASet),
    /abandoned-tired-property.*not a set/,
  );
});
