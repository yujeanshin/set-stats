import assert from "node:assert/strict";
import { test } from "node:test";
import { ALL_CARDS } from "../lib/cards.js";
import {
  COLORS,
  SHADES,
  SHAPES,
  cardFace,
  describeCard,
  maskFeatures,
} from "../ui/src/cardFace.js";
import { cardTraits } from "../vendor/game.js";

test("cardFace decodes every card the way the site's cardTraits does", () => {
  for (const card of ALL_CARDS) {
    const face = cardFace(card);
    const t = cardTraits(card);
    assert.equal(COLORS.indexOf(face.color), t.color, card);
    assert.equal(SHAPES.indexOf(face.shape), t.shape, card);
    assert.equal(SHADES.indexOf(face.shade), t.shade, card);
    assert.equal(face.number, t.number + 1, card);
  }
});

test("value names match upstream SetCard.js", () => {
  // COLORS [purple, green, red], SHAPES [squiggle, oval, diamond],
  // SHADES [filled, outline, striped], number + 1 symbols.
  assert.deepEqual(cardFace("0000"), {
    color: "purple",
    shape: "squiggle",
    shade: "solid",
    number: 1,
  });
  assert.deepEqual(cardFace("2102"), {
    color: "red",
    shape: "oval",
    shade: "solid",
    number: 3,
  });
  assert.deepEqual(cardFace("1221"), {
    color: "green",
    shape: "diamond",
    shade: "striped",
    number: 2,
  });
  assert.equal(cardFace("0010").shade, "empty");
  assert.equal(describeCard("2102"), "3 red solid ovals");
  assert.equal(describeCard("1110"), "1 green empty oval");
  assert.throws(() => cardFace("0003"), /not a card/);
  assert.throws(() => cardFace("012"), /not a card/);
});

test("maskFeatures reads a diff_mask in feature order", () => {
  // The example set from docs/schema.md: 0012-0120-0201 has mask 0111.
  assert.deepEqual(maskFeatures("0111"), [
    { feature: "color", differs: false },
    { feature: "shape", differs: true },
    { feature: "shade", differs: true },
    { feature: "number", differs: true },
  ]);
});
