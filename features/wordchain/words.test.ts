import { describe, expect, test } from "vitest";

import {
  WORDS,
  createGame,
  playAiTurn,
  submitWord,
  type Game,
} from "@/features/wordchain";

describe("단어장", () => {
  test("약 200개 이상의 단어가 있고 같은 단어가 두 번 들어 있지 않다", () => {
    const words = WORDS.map((entry) => entry.word);

    expect(words.length).toBeGreaterThanOrEqual(200);
    expect(new Set(words).size).toBe(words.length);
  });

  test("모든 단어는 두 글자 이상이고 뜻풀이, 예문, 이모지가 있다", () => {
    for (const entry of WORDS) {
      expect([...entry.word].length, entry.word).toBeGreaterThanOrEqual(2);
      expect(entry.meaning.trim(), entry.word).not.toBe("");
      expect(entry.emoji.trim(), entry.word).not.toBe("");
      expect(entry.example, entry.word).toContain(entry.word);
    }
  });

  test("두음법칙으로 이어지는 단어가 있다", () => {
    const endsWithRi = WORDS.some((entry) => entry.word.endsWith("리"));
    const startsWithI = WORDS.some((entry) => entry.word.startsWith("이"));

    expect(endsWithRi && startsWithI).toBe(true);
  });

  test("끝장단어가 되는 단어가 있다", () => {
    // 끝장단어는 첫 단어로 쓰면 안내와 함께 거절된다.
    const rejectedAsFirst = WORDS.filter(
      (entry) =>
        submitWord(createGame(), entry.word).notice ===
        "처음부터 끝장단어는 쓸 수 없어요. 다른 단어를 써 주세요"
    );

    expect(rejectedAsFirst.length).toBeGreaterThan(0);
  });
});

// 고정된 순서로 난수를 만드는 간단한 생성기(mulberry32).
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function playRandomGame(random: () => number): Game {
  let game = createGame();
  for (let guard = 0; guard < 1000; guard += 1) {
    if (game.status === "child-turn") {
      const used = new Set(game.turns.map((turn) => turn.entry.word));
      const choices = WORDS.filter((entry) => {
        if (used.has(entry.word)) return false;
        return submitWord(game, entry.word).turns.length > game.turns.length;
      });
      if (choices.length === 0) return { ...game, status: "lost" };
      // 끝장단어를 모르는 아이처럼, 이어 갈 수 있는 단어를 우선 고른다.
      const safe = choices.filter(
        (entry) => submitWord(game, entry.word).status === "ai-turn"
      );
      const pool = safe.length > 0 ? safe : choices;
      game = submitWord(game, pool[Math.floor(random() * pool.length)].word);
    } else if (game.status === "ai-turn") {
      game = playAiTurn(game, random);
    } else {
      return game;
    }
  }
  throw new Error("판이 끝나지 않았다");
}

describe("실제 단어장으로 한 판", () => {
  test("끝장단어를 피해 이어 가면 판은 승패로 끝나고, 어느 정도 이어진다", () => {
    const random = seeded(2026);
    const lengths: number[] = [];

    for (let i = 0; i < 300; i += 1) {
      const game = playRandomGame(random);
      expect(["won", "lost"]).toContain(game.status);
      lengths.push(game.turns.length);
    }

    const average = lengths.reduce((sum, n) => sum + n, 0) / lengths.length;
    expect(average).toBeGreaterThanOrEqual(5);
  });
});
