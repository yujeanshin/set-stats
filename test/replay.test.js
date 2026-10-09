import assert from "node:assert/strict";
import { test } from "node:test";
import { findSets, hasSet } from "../lib/cards.js";
import { replayGame } from "../lib/replay.js";

// Real game "abandoned-tired-property".
const GAME = {
  game_id: "abandoned-tired-property",
  seed: "v1:ae558bcfbf58e6094261e2a6c56d9e70",
  started_at: 1786983711802,
};

const OPENING_BOARD = "0120 2210 0110 0111 0210 2011 1211 0220 1100 0112 1102 2022".split(" ");

// time c1 c2 c3 -> board_size, n_sets, positions of c1 c2 c3
const EXPECTED = `
1786983714427 0110 0112 0111 12 3 2,9,3
1786983748781 2200 1102 0001 12 2 2,10,9
1786983750434 2210 0211 1212 12 5 1,9,3
1786983755347 0200 0210 0220 12 2 2,4,7
1786983762863 2011 1100 0222 12 1 5,8,4
1786983765742 2020 1220 0120 12 1 4,1,0
1786983768013 1201 1121 1011 12 3 1,8,0
1786983771081 2100 2211 2022 12 2 7,0,11
1786983806811 1020 2001 0012 12 2 11,9,3
1786983808711 2201 2111 2021 12 2 8,4,11
1786983810433 1120 1002 1211 12 2 7,8,6
1786983817617 1210 2121 0002 12 3 6,9,2
1786983820143 2120 2101 2112 12 2 6,7,11
1786983828245 0000 2002 1001 12 1 4,8,0
1786983831441 1202 0122 2012 12 3 8,1,3
1786983844353 2122 0022 1222 12 2 0,6,11
1786983869782 2221 2010 2102 12 2 2,0,3
1786983873453 1111 1112 1110 12 3 10,0,1
1786983875523 0201 1200 2202 12 2 4,9,3
1786983879117 2220 0101 1012 12 3 7,9,3
1786983888319 0021 0100 0212 12 2 0,11,9
1786983928888 2110 1021 0202 12 1 6,2,3
1786983937210 2212 0121 1000 12 3 2,4,7
1786983939108 0010 0221 0102 12 4 4,7,3
1786983946588 2000 0011 1022  9 2 6,8,2
`
  .trim()
  .split("\n")
  .map((line) => {
    const [time, c1, c2, c3, size, nSets, pos] = line.trim().split(/\s+/);
    return { time: +time, c1, c2, c3, size: +size, nSets: +nSets, pos: pos.split(",").map(Number) };
  });

const EVENTS = EXPECTED.map((e, seq) => ({
  seq,
  time_ms: e.time,
  user_id: "me",
  c1: e.c1,
  c2: e.c2,
  c3: e.c3,
}));

const result = replayGame(GAME, EVENTS);

test("opening board matches the site", () => {
  assert.deepEqual(result.finds[0].board, OPENING_BOARD);
});

test("all 25 events are valid", () => {
  assert.equal(result.finds.length, 25);
  assert.deepEqual(result.finds.map((f) => f.seq), EVENTS.map((e) => e.seq));
});

test("board size, set count and click positions for every find", () => {
  for (const [i, exp] of EXPECTED.entries()) {
    const f = result.finds[i];
    const label = `event ${i} (${exp.time})`;
    assert.equal(f.board_size, exp.size, `${label} board_size`);
    assert.equal(f.board.length, exp.size, `${label} board length`);
    assert.equal(findSets(f.board).length, exp.nSets, `${label} n_sets`);
    assert.deepEqual(f.positions, exp.pos, `${label} positions`);
    assert.deepEqual(f.positions.map((p) => f.board[p]), [exp.c1, exp.c2, exp.c3], `${label} cards`);
  }
});

test("first elapsed_ms is measured from startedAt", () => {
  assert.equal(result.finds[0].elapsed_ms, 2625);
  assert.equal(result.finds[1].elapsed_ms, EXPECTED[1].time - EXPECTED[0].time);
});

test("6 cards are left at the end and contain no set", () => {
  assert.deepEqual(result.remaining.slice().sort(), "1221 1101 0020 1010 2222 1122".split(" ").sort());
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
  assert.deepEqual(finds.map((f) => f.seq), [0, 3]);
  assert.equal(finds[1].elapsed_ms, EVENTS[1].time_ms - EVENTS[0].time_ms);
});

test("an accepted event that doesn't fit the board throws, naming the game", () => {
  const notOnBoard = [{ ...EVENTS[1], seq: 0 }];
  assert.throws(() => replayGame(GAME, notOnBoard), /abandoned-tired-property.*not all on board/);
  const notASet = [{ ...EVENTS[0], seq: 0, c3: OPENING_BOARD[0] }];
  assert.throws(() => replayGame(GAME, notASet), /abandoned-tired-property.*not a set/);
});
