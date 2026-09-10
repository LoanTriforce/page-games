import assert from "node:assert/strict";
import { test } from "node:test";
import { createRound, DURATION, flip, pairScore, tick } from "./engine";

test("board contains exactly twelve distinct pairs", () => {
  const round = createRound(0);
  assert.equal(round.cards.length, 24);
  assert.equal(new Set(round.cards.map((card) => card.id)).size, 24);
  for (let symbol = 0; symbol < 12; symbol++) {
    assert.equal(round.cards.filter((card) => card.symbol === symbol).length, 2);
  }
});
test("faster matches earn more points", () => {
  assert.equal(pairScore(5000), 155);
  assert.equal(pairScore(55000), 105);
  assert.equal(pairScore(DURATION), 100);
});
test("matching cards score only once and cannot be selected twice", () => {
  let round = flip(createRound(0), 0, 1000);
  round = flip(round, 0, 1000);
  assert.equal(round.selected.length, 1);
  round = flip(round, 1, 2000);
  assert.equal(round.score, 158);
  assert.equal(round.matched.length, 2);
  round = flip(round, 0, 3000);
  assert.equal(round.score, 158);
  assert.deepEqual(round.selected, []);
});
test("mismatches lock third card until the reveal delay has elapsed", () => {
  let round = flip(flip(createRound(0), 0, 1000), 2, 1100);
  assert.equal(round.score, 0);
  round = flip(round, 4, 1200);
  assert.deepEqual(round.selected, [0, 2]);
  round = tick(round, 1900);
  assert.deepEqual(round.selected, []);
  assert.deepEqual(flip(round, 4, 2000).selected, [4]);
});
test("deadline is enforced on clicks even if the interval was delayed", () => {
  const round = flip(flip(createRound(0), 0, 1000), 1, DURATION);
  assert.equal(round.ended, true);
  assert.equal(round.score, 0);
  assert.equal(tick(createRound(0), 90000).now, DURATION);
});
test("finding every pair ends the round early and freezes the timer", () => {
  let round = createRound(0);
  for (let id = 0; id < 24; id++) round = flip(round, id, 1000 + id * 100);
  assert.equal(round.ended, true);
  assert.equal(round.matched.length, 24);
  assert.equal(round.now, 3300);
  assert.equal(tick(round, 10000).now, 3300);
});
