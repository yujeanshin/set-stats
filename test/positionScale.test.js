import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EVEN_SHARE,
  MIN_EXTENT,
  STEPS,
  heatExtent,
  heatLevel,
} from "../ui/src/positionScale.js";

test("heatExtent: at least MIN_EXTENT, else the farthest cell from 25%", () => {
  assert.equal(EVEN_SHARE, 0.25);
  // Near-even data keeps the minimum extent.
  assert.equal(heatExtent([0.24, 0.26, 0.25, null]), MIN_EXTENT);
  assert.equal(heatExtent([]), MIN_EXTENT);
  // A cell 10 points below sets the extent, below as well as above.
  assert.equal(heatExtent([0.15, 0.27]).toFixed(9), "0.100000000");
  assert.equal(heatExtent([0.25, 0.33]).toFixed(9), "0.080000000");
});

test("heatLevel: steps by distance from 25%, above and below", () => {
  const e = MIN_EXTENT; // 5 points for full color
  assert.equal(heatLevel(0.25, e), 0);
  assert.equal(heatLevel(0.255, e), 0); // half a point: neutral
  assert.equal(heatLevel(0.26, e), 1);
  assert.equal(heatLevel(0.24, e), -1);
  assert.equal(heatLevel(0.3, e), STEPS);
  assert.equal(heatLevel(0.2, e), -STEPS);
  // Past the extent stays at full color.
  assert.equal(heatLevel(0.5, e), STEPS);
  assert.equal(heatLevel(0, e), -STEPS);
  assert.equal(heatLevel(null, e), null);
  assert.ok(Object.is(heatLevel(0.249, e), 0), "not -0");
});
