// Vendored from ekzhang/setwithfriends at commit dcd104cca74b06e8ebc396876e8c7e0e97c5d805
// Lines 144-343 of src/util.js (the game logic), with generateName removed
// because it needs the animals list. Everything else is unmodified.

export function checkSet(a, b, c) {
  for (let i = 0; i < 4; i++) {
    if ((a.charCodeAt(i) + b.charCodeAt(i) + c.charCodeAt(i)) % 3 !== 0)
      return false;
  }
  return true;
}

/** Returns the unique card c such that {a, b, c} form a set. */
export function conjugateCard(a, b) {
  const zeroCode = "0".charCodeAt(0);
  let c = "";
  for (let i = 0; i < 4; i++) {
    const sum = a.charCodeAt(i) - zeroCode + b.charCodeAt(i) - zeroCode;
    const lastNum = (3 - (sum % 3)) % 3;
    c += String.fromCharCode(zeroCode + lastNum);
  }
  return c;
}

export function checkSetUltra(a, b, c, d) {
  if (conjugateCard(a, b) === conjugateCard(c, d)) return [a, b, c, d];
  if (conjugateCard(a, c) === conjugateCard(b, d)) return [a, c, b, d];
  if (conjugateCard(a, d) === conjugateCard(b, c)) return [a, d, b, c];
  return null;
}

export function findSet(deck, gameMode = "normal", old) {
  const deckSet = new Set(deck);
  const ultraConjugates = {};
  for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
      const c = conjugateCard(deck[i], deck[j]);
      if (
        gameMode === "normal" ||
        gameMode === "setjr" ||
        (gameMode === "setchain" && old.length === 0)
      ) {
        if (deckSet.has(c)) {
          return [deck[i], deck[j], c];
        }
      } else if (gameMode === "setchain") {
        if (old.includes(c)) {
          return [c, deck[i], deck[j]];
        }
      } else if (gameMode === "ultraset") {
        if (c in ultraConjugates) {
          return [...ultraConjugates[c], deck[i], deck[j]];
        }
        ultraConjugates[c] = [deck[i], deck[j]];
      }
    }
  }
  return null;
}

export function splitDeck(deck, gameMode = "normal", minBoardSize = 12, old) {
  let len = Math.min(deck.length, minBoardSize);
  while (len < deck.length && !findSet(deck.slice(0, len), gameMode, old))
    len += 3 - (len % 3);
  return [deck.slice(0, len), deck.slice(len)];
}

export function removeCard(deck, c) {
  let i = deck.indexOf(c);
  return [...deck.slice(0, i), ...deck.slice(i + 1)];
}


function hasDuplicates(used, cards) {
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cards[i] === cards[j]) return true;
    }
    if (used[cards[i]]) return true;
  }
  return false;
}

function removeCards(internalGameState, cards) {
  const { current, used } = internalGameState;
  let canPreserve = true;
  for (const c of cards) {
    if (current.indexOf(c) >= 12) canPreserve = false;
    used[c] = true;
  }
  if (current.length < 12 + cards.length) canPreserve = false;

  if (canPreserve) {
    // Try to preserve card locations, if possible
    const d = current.splice(12, cards.length);
    for (let i = 0; i < cards.length; i++) {
      current[current.indexOf(cards[i])] = d[i];
    }
  } else {
    // Otherwise, just remove the cards
    for (const card of cards) {
      current.splice(current.indexOf(card), 1);
    }
  }
}

function processValidEvent(internalGameState, event, cards) {
  const { scores, history } = internalGameState;
  scores[event.user] = (scores[event.user] || 0) + 1;
  history.push(event);
  removeCards(internalGameState, cards);
}

function processEventNormal(internalGameState, event) {
  const { current, used } = internalGameState;
  const cards = [event.c1, event.c2, event.c3];
  if (hasDuplicates(used, cards)) return;
  processValidEvent(internalGameState, event, cards);

  const minSize = Math.max(internalGameState.boardSize - 3, 12);
  const boardSize = splitDeck(current, "normal", minSize)[0].length;
  internalGameState.boardSize = boardSize;
}

function processEventChain(internalGameState, event) {
  const { used, history, current } = internalGameState;
  const { c1, c2, c3 } = event;

  let ok = c1 !== c2 && c2 !== c3 && c1 !== c3 && !used[c2] && !used[c3];
  if (history.length) {
    // One card (c1) should be taken from the previous set
    let prev = history[history.length - 1];
    ok &&= [prev.c1, prev.c2, prev.c3].includes(c1);
  } else {
    ok &&= !used[c1];
  }
  if (!ok) return;

  const cards = history.length === 0 ? [c1, c2, c3] : [c2, c3];
  processValidEvent(internalGameState, event, cards);

  const minSize = Math.max(internalGameState.boardSize - cards.length, 12);
  const old = [c1, c2, c3];
  const boardSize = splitDeck(current, "setchain", minSize, old)[0].length;
  internalGameState.boardSize = boardSize;
}

function processEventUltra(internalGameState, event) {
  const { used, current } = internalGameState;
  const cards = [event.c1, event.c2, event.c3, event.c4];
  if (hasDuplicates(used, cards)) return;
  processValidEvent(internalGameState, event, cards);

  const minSize = Math.max(internalGameState.boardSize - 4, 12);
  const boardSize = splitDeck(current, "ultraset", minSize)[0].length;
  internalGameState.boardSize = boardSize;
}

/**
 * Initialize the deck to its starting cards based on the game mode.
 *
 * It starts with a shuffled 81-card deck according to database state. Usually
 * this would be a no-op, but for Set Junior, we need to remove some subset of
 * the cards before the game starts.
 */
export function initializeDeck(deck, gameMode) {
  if (gameMode === "setjr") {
    // Remove all cards except those with solid shading.
    return deck.filter((card) => card[2] === "0");
  }
  return deck.slice();
}

export function computeState(gameData, gameMode = "normal") {
  const scores = {}; // scores of all users
  const used = {}; // set of cards that have been taken
  const history = []; // list of valid events in time order
  const current = initializeDeck(gameData.deck, gameMode); // remaining cards in the game
  const internalGameState = {
    used,
    current,
    scores,
    history,
    // Initial deck split
    boardSize: splitDeck(current, gameMode, 12, [])[0].length,
  };

  if (gameData.events) {
    const events = Object.values(gameData.events).sort(
      (e1, e2) => e1.time - e2.time,
    );
    for (const event of events) {
      if (gameMode === "normal" || gameMode === "setjr")
        processEventNormal(internalGameState, event);
      if (gameMode === "setchain") processEventChain(internalGameState, event);
      if (gameMode === "ultraset") processEventUltra(internalGameState, event);
    }
  }

  return { current, scores, history, boardSize: internalGameState.boardSize };
}
