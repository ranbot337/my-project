import { WORDS, type WordEntry } from "./words";

export const CHANCES_PER_TURN = 4;
export const TURN_SECONDS = 30;
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

// 사전에 물어본 결과. found는 표준어로 인정되었고 첫 뜻풀이가 meaning이다.
export type LookupResult =
  | { status: "found"; meaning: string }
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
};

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
  return { ...base, chances: 0, status: "lost", endedBy: "chances" };
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

export function submitWord(game: Game, input: string): Game {
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
    meaning: result.meaning,
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
  };
}
