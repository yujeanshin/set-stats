// What a card string means: which digit is which feature, and what each
// digit value is. Pure, so test/cardFace.test.js can check it in node.
//
// Cards are 4-digit strings over 0-2 in the order color, shape, shade,
// number (docs/schema.md). The values follow how ekzhang/setwithfriends
// decodes a card in src/components/SetCard.js at commit
// dcd104cca74b06e8ebc396876e8c7e0e97c5d805 (MIT), the commit vendored in
// vendor/setwithfriends/util.js:
//   color  = digit 0, COLORS = [purple, green, red]
//   shape  = digit 1, SHAPES = ["squiggle", "oval", "diamond"]
//   shade  = digit 2, SHADES = ["filled", "outline", "striped"]
//   number = digit 3, drawn as number + 1 symbols
// Set with Forks (eltoder/setwithfriends at the commit in vendor/game.js)
// decodes the same way through cardTraits; the test checks all 81 cards
// against that function.

export const FEATURES = ["color", "shape", "shade", "number"];

export const COLORS = ["purple", "green", "red"];
export const SHAPES = ["squiggle", "oval", "diamond"];
// Upstream calls these filled, outline and striped.
export const SHADES = ["solid", "empty", "striped"];

/** "2102" -> { color: "red", shape: "oval", shade: "solid", number: 3 }. */
export function cardFace(card) {
  if (!/^[0-2]{4}$/.test(card)) throw new Error(`not a card: ${card}`);
  return {
    color: COLORS[+card[0]],
    shape: SHAPES[+card[1]],
    shade: SHADES[+card[2]],
    number: +card[3] + 1,
  };
}

/** "2102" -> "3 red solid ovals", for screen readers and titles. */
export function describeCard(card) {
  const { color, shape, shade, number } = cardFace(card);
  return `${number} ${color} ${shade} ${shape}${number > 1 ? "s" : ""}`;
}

/**
 * A diff_mask ("0111") as [{ feature, differs }] in FEATURES order: "1"
 * means the feature differs across the set, "0" that it is the same.
 */
export function maskFeatures(mask) {
  return FEATURES.map((feature, i) => ({ feature, differs: mask[i] === "1" }));
}
