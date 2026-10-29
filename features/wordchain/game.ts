import { WORDS, type WordEntry } from "./words";

export const CHANCES_PER_TURN = 4;
export const TURN_SECONDS = 30;
// 한 판에 힌트 도우미를 열 수 있는 횟수와, 도우미 목록에 보여 주는 단어 수의 상한.
export const HINTS_PER_GAME = 3;
const MAX_HINT_ITEMS = 12;
// AI가 끝장단어를 쓸 수 있을 때 실제로 쓰는 확률.
export const AI_DEAD_END_RATE = 0.5;

// 사전에서 확인된 단어에 붙이는 그림. 사전은 단어별 그림을 주지 않는다.
const DICTIONARY_EMOJI = "📖";

export type Turn = { by: "child" | "ai"; entry: WordEntry };

export type GameStatus =
  | "child-turn"
  | "checking"
  | "ai-turn"
  | "won"
  | "lost"
  | "abandoned";

export type EndedBy = "chances" | "child-dead-end" | "ai-dead-end" | "gave-up";

export type DueumHint = { from: string; to: string };

// 사전에 물어본 결과. found는 표준어로 인정되었고, 철자가 같은 단어마다 첫 뜻풀이를
// 최대 3개까지 순서대로 담는다(1개 이상).
export type LookupResult =
  | { status: "found"; meanings: string[] }
  | { status: "not-found" }
  | { status: "failed" };

export type Game = {
  bank: WordEntry[];
  turns: Turn[];
  status: GameStatus;
  endedBy: EndedBy | null;
  chances: number;
  notice: string | null;
  hint: DueumHint | null;
  // 단어장에 없어 사전 확인을 기다리는 단어(status가 checking일 때만 있다).
  pending: string | null;
  // 힌트 도우미: 남은 횟수, 열려 있는지, 힌트를 쓴 차례(그때의 turns.length).
  hintsLeft: number;
  hintOpen: boolean;
  hintTurn: number | null;
};

export type HintItem = { entry: WordEntry; deadEnd: boolean };
export type HintList = { letters: string[]; items: HintItem[] };

// 표준 두음법칙: 단어 끝 글자가 앞의 글자이면 뒤의 글자로 시작하는 단어도 이을 수 있다.
const DUEUM: Record<string, string> = {
  녀: "여", 뇨: "요", 뉴: "유", 니: "이",
  랴: "야", 려: "여", 례: "예", 료: "요", 류: "유", 리: "이",
  라: "나", 래: "내", 로: "노", 뢰: "뇌", 루: "누", 르: "느",
};

export function createGame(bank: WordEntry[] = WORDS): Game {
  return {
    bank,
    turns: [],
    status: "child-turn",
    endedBy: null,
    chances: CHANCES_PER_TURN,
    notice: null,
    hint: null,
    pending: null,
    hintsLeft: HINTS_PER_GAME,
    hintOpen: false,
    hintTurn: null,
  };
}

const lastLetter = (word: string) => [...word].at(-1) as string;

function nextLetters(word: string): string[] {
  const last = lastLetter(word);
  const changed = DUEUM[last];
  return changed ? [last, changed] : [last];
}

function startsWithAny(word: string, letters: string[]) {
  return letters.some((letter) => word.startsWith(letter));
}

function unusedFollowers(
  word: string,
  usedWords: string[],
  bank: WordEntry[]
): WordEntry[] {
  const letters = nextLetters(word);
  return bank.filter(
    (candidate) =>
      !usedWords.includes(candidate.word) &&
      startsWithAny(candidate.word, letters)
  );
}

// 끝장단어: 이 단어 뒤에 이을 수 있는, 아직 쓰지 않은 단어장 단어가 하나도 없는 단어.
function isDeadEnd(entry: WordEntry, usedWords: string[], bank: WordEntry[]) {
  return unusedFollowers(entry.word, usedWords, bank).length === 0;
}

function hintFor(word: string): DueumHint | null {
  const from = lastLetter(word);
  const to = DUEUM[from];
  return to ? { from, to } : null;
}

function spendChance(game: Game, notice: string): Game {
  const chances = game.chances - 1;
  const base: Game = { ...game, status: "child-turn", pending: null, notice };
  if (chances > 0) return { ...base, chances };
  return {
    ...base,
    chances: 0,
    status: "lost",
    endedBy: "chances",
    hintOpen: false,
  };
}

const usedWordsOf = (game: Game) => game.turns.map((turn) => turn.entry.word);

// 이을 수 있는 단어로 확인된 entry를 판에 넣는다. 첫 단어가 끝장단어이면 거절한다.
function acceptEntry(game: Game, entry: WordEntry): Game {
  const deadEnd = isDeadEnd(
    entry,
    [...usedWordsOf(game), entry.word],
    game.bank
  );

  if (game.turns.length === 0 && deadEnd) {
    return spendChance(
      game,
      "처음부터 끝장단어는 쓸 수 없어요. 다른 단어를 써 주세요"
    );
  }

  const turns: Turn[] = [...game.turns, { by: "child", entry }];
  const base: Game = { ...game, turns, pending: null, notice: null, hint: null };
  if (deadEnd) {
    return { ...base, status: "won", endedBy: "child-dead-end" };
  }
  return { ...base, status: "ai-turn" };
}

// 입력을 내면(이을 수 없는 입력이어도) 힌트 도우미가 닫힌다. 빈 입력은 무시한다.
export function submitWord(game: Game, input: string): Game {
  const result = submitInput(game, input);
  return result === game ? game : { ...result, hintOpen: false };
}

function submitInput(game: Game, input: string): Game {
  if (game.status !== "child-turn") return game;

  const word = input.trim();
  if (word === "") return game;
  if ([...word].length < 2) return spendChance(game, "두 글자 이상 써 주세요");

  if (usedWordsOf(game).includes(word)) {
    return spendChance(game, "이미 사용한 단어입니다");
  }

  const previous = game.turns.at(-1);
  if (previous) {
    const letters = nextLetters(previous.entry.word);
    if (!startsWithAny(word, letters)) {
      const quoted = letters.map((letter) => `'${letter}'`).join(" 또는 ");
      return spendChance(game, `${quoted}로 시작하는 단어를 써 주세요`);
    }
  }

  const entry = game.bank.find((candidate) => candidate.word === word);
  if (entry) return acceptEntry(game, entry);

  return { ...game, status: "checking", pending: word, notice: null };
}

// 사전에 물어본 결과를 반영한다. 확인을 기다리는 중이 아니면 아무것도 바꾸지 않는다.
export function resolveLookup(game: Game, result: LookupResult): Game {
  if (game.status !== "checking" || game.pending === null) return game;

  if (result.status === "failed") {
    return {
      ...game,
      status: "child-turn",
      pending: null,
      notice: "사전에 연결하지 못했어요. 다시 입력해 주세요",
    };
  }
  if (result.status === "not-found") {
    return spendChance(game, "사전에 없는 단어예요");
  }

  return acceptEntry(game, {
    word: game.pending,
    emoji: DICTIONARY_EMOJI,
    meaning: result.meanings[0],
    meanings: result.meanings,
    example: "",
  });
}

export function timeOut(game: Game): Game {
  if (game.status !== "child-turn") return game;
  return spendChance(game, "시간이 지났어요");
}

const pickFrom = (pool: WordEntry[], random: () => number) =>
  pool[Math.floor(random() * pool.length)];

export function playAiTurn(game: Game, random: () => number): Game {
  if (game.status !== "ai-turn") return game;

  const previous = game.turns.at(-1) as Turn;
  const used = usedWordsOf(game);
  const candidates = unusedFollowers(previous.entry.word, used, game.bank);
  const isEnd = (candidate: WordEntry) =>
    isDeadEnd(candidate, [...used, candidate.word], game.bank);
  const deadEnds = candidates.filter(isEnd);
  const normals = candidates.filter((candidate) => !isEnd(candidate));

  const useDeadEnd =
    deadEnds.length > 0 &&
    (normals.length === 0 || random() < AI_DEAD_END_RATE);
  const entry = pickFrom(useDeadEnd ? deadEnds : normals, random);
  const turns: Turn[] = [...game.turns, { by: "ai", entry }];

  if (useDeadEnd) {
    return {
      ...game,
      turns,
      status: "lost",
      endedBy: "ai-dead-end",
      notice: null,
      hint: null,
    };
  }
  return {
    ...game,
    turns,
    status: "child-turn",
    chances: CHANCES_PER_TURN,
    notice: null,
    hint: hintFor(entry.word),
  };
}

export function giveUp(game: Game): Game {
  if (game.status === "won" || game.status === "lost") return game;
  return {
    ...game,
    status: "abandoned",
    endedBy: "gave-up",
    pending: null,
    hint: null,
    hintOpen: false,
  };
}

// 힌트 도우미는 아이 차례이고 첫 단어가 아닐 때만 열 수 있다. 남은 횟수가 있거나
// 이번 차례에 이미 쓴 힌트이면(다시 열기) 열 수 있다.
export function canOpenHint(game: Game): boolean {
  if (game.status !== "child-turn" || game.turns.length === 0) return false;
  return (
    game.hintOpen ||
    game.hintTurn === game.turns.length ||
    game.hintsLeft > 0
  );
}

export function openHint(game: Game): Game {
  if (!canOpenHint(game) || game.hintOpen) return game;
  if (game.hintTurn === game.turns.length) return { ...game, hintOpen: true };
  return {
    ...game,
    hintOpen: true,
    hintsLeft: game.hintsLeft - 1,
    hintTurn: game.turns.length,
  };
}

export function closeHint(game: Game): Game {
  return game.hintOpen ? { ...game, hintOpen: false } : game;
}

// 도우미 목록: 이어 갈 수 있는 쓰지 않은 단어장 단어. 끝장단어를 먼저, 나머지는
// 단어장 순서로 놓고 전체 12개까지만 보여 준다.
export function hintList(game: Game): HintList {
  const previous = game.turns.at(-1);
  if (!previous) return { letters: [], items: [] };

  const used = usedWordsOf(game);
  const items = unusedFollowers(previous.entry.word, used, game.bank).map(
    (entry) => ({
      entry,
      deadEnd: isDeadEnd(entry, [...used, entry.word], game.bank),
    })
  );
  return {
    letters: nextLetters(previous.entry.word),
    items: [
      ...items.filter((item) => item.deadEnd),
      ...items.filter((item) => !item.deadEnd),
    ].slice(0, MAX_HINT_ITEMS),
  };
}
