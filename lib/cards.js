// Cards are 4-digit strings over 0-2: color, shape, shade, number.
// This will probably be replace later for new modes like 4set, which requires base 4.

export const ALL_CARDS = (() => {
  const cards = [];
  for (let i = 0; i < 81; i++) {
    let card = "";
    for (let n = i, k = 0; k < 4; k++, n = Math.floor(n / 3)) {
      card = (n % 3) + card;
    }
    cards.push(card);
  }
  return cards;
})();

export function thirdCard(a, b) {
  let c = "";
  for (let i = 0; i < a.length; i++) {
    c += (6 - +a[i] - +b[i]) % 3;
  }
  return c;
}

export function isSet(a, b, c) {
  return a !== b && thirdCard(a, b) === c;
}

export function sortedSet(cards) {
  return cards.slice().sort();
}

export function setId(cards) {
  return sortedSet(cards).join("-");
}

export function diffMask(a, b, c) {
  let mask = "";
  for (let i = 0; i < a.length; i++) {
    mask += a[i] === b[i] && b[i] === c[i] ? "0" : "1";
  }
  return mask;
}

/** All 1080 sets as { set_id, c1, c2, c3, diff_mask }, with c1 < c2 < c3. */
export const ALL_SETS = (() => {
  const sets = [];
  for (let i = 0; i < ALL_CARDS.length; i++) {
    for (let j = i + 1; j < ALL_CARDS.length; j++) {
      const c = thirdCard(ALL_CARDS[i], ALL_CARDS[j]);
      if (c <= ALL_CARDS[j]) continue;
      const [c1, c2, c3] = [ALL_CARDS[i], ALL_CARDS[j], c];
      sets.push({ set_id: `${c1}-${c2}-${c3}`, c1, c2, c3, diff_mask: diffMask(c1, c2, c3) });
    }
  }
  return sets;
})();
