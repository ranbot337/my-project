import { describe, expect, test } from "vitest";

import {
  createGame,
  giveUp,
  playAiTurn,
  resolveLookup,
  submitWord,
  timeOut,
  type Game,
  type WordEntry,
} from "@/features/wordchain";

const bankOf = (...words: string[]): WordEntry[] =>
  words.map((word) => ({
    word,
    emoji: "⭐",
    meaning: `${word}의 뜻`,
    example: `${word} 예문`,
  }));

describe("판 시작과 첫 단어", () => {
  test("새 판은 아이 차례에서 기회 4번으로 시작한다", () => {
    const game = createGame(bankOf("사과", "과자"));

    expect(game.status).toBe("child-turn");
    expect(game.chances).toBe(4);
    expect(game.turns).toEqual([]);
    expect(game.notice).toBeNull();
  });

  test("맞는 첫 단어를 내면 그 단어가 기록되고 AI 차례가 된다", () => {
    const game = submitWord(createGame(bankOf("사과", "과자")), "사과");

    expect(game.status).toBe("ai-turn");
    expect(game.turns.map((t) => [t.by, t.entry.word])).toEqual([
      ["child", "사과"],
    ]);
    expect(game.notice).toBeNull();
  });

  test("앞뒤 공백은 무시하고 단어로 받아들인다", () => {
    const game = submitWord(createGame(bankOf("사과", "과자")), "  사과 ");

    expect(game.turns[0]?.entry.word).toBe("사과");
  });

  test("빈 입력은 무시하고 기회를 쓰지 않는다", () => {
    const start = createGame(bankOf("사과", "과자"));
    const game = submitWord(start, "   ");

    expect(game).toEqual(start);
  });
});

describe("이을 수 없는 입력", () => {
  test("한 글자 단어는 기회 1번을 쓰고 안내가 나온다", () => {
    const game = submitWord(createGame(bankOf("사과", "과자")), "사");

    expect(game.notice).toBe("두 글자 이상 써 주세요");
    expect(game.chances).toBe(3);
    expect(game.status).toBe("child-turn");
    expect(game.turns).toEqual([]);
  });

  test("단어장에 없는 단어는 기회를 쓰지 않고 사전 확인을 기다린다", () => {
    const game = submitWord(createGame(bankOf("사과", "과자")), "하하");

    expect(game.status).toBe("checking");
    expect(game.pending).toBe("하하");
    expect(game.chances).toBe(4);
    expect(game.turns).toEqual([]);
  });

  test("첫 단어가 끝장단어이면 다른 단어를 써 달라는 안내가 나온다", () => {
    // "토끼"는 "끼"로 시작하는 단어가 없어 끝장단어다.
    const game = submitWord(
      createGame(bankOf("사과", "과자", "토끼")),
      "토끼"
    );

    expect(game.notice).toBe(
      "처음부터 끝장단어는 쓸 수 없어요. 다른 단어를 써 주세요"
    );
    expect(game.chances).toBe(3);
    expect(game.turns).toEqual([]);
  });
});

const firstPick = () => 0;
const wordsOf = (game: Game) => game.turns.map((t) => [t.by, t.entry.word]);

describe("AI 차례", () => {
  test("AI는 앞 단어에 이어지는 단어를 내고 아이 차례로 돌아온다", () => {
    const game = playAiTurn(
      submitWord(createGame(bankOf("사과", "과자", "자전거")), "사과"),
      firstPick
    );

    expect(wordsOf(game)).toEqual([
      ["child", "사과"],
      ["ai", "과자"],
    ]);
    expect(game.status).toBe("child-turn");
  });

  test("차례가 새로 시작되면 기회가 4번으로 돌아온다", () => {
    const afterMistake = submitWord(
      createGame(bankOf("사과", "과자", "자전거")),
      "하"
    );
    expect(afterMistake.chances).toBe(3);

    const game = playAiTurn(submitWord(afterMistake, "사과"), firstPick);

    expect(game.chances).toBe(4);
    expect(game.notice).toBeNull();
  });
});

describe("이어 말하기 규칙", () => {
  const bank = bankOf("기사", "사기", "기차", "차표");
  const secondTurn = () =>
    playAiTurn(submitWord(createGame(bank), "기사"), firstPick);

  test("이미 쓴 단어는 다시 쓸 수 없다", () => {
    expect(wordsOf(secondTurn())).toEqual([
      ["child", "기사"],
      ["ai", "사기"],
    ]);

    const game = submitWord(secondTurn(), "기사");

    expect(game.notice).toBe("이미 사용한 단어입니다");
    expect(game.chances).toBe(3);
  });

  test("앞 단어에 이어지지 않으면 시작해야 할 글자를 알려 준다", () => {
    const game = submitWord(secondTurn(), "차표");

    expect(game.notice).toBe("'기'로 시작하는 단어를 써 주세요");
    expect(game.chances).toBe(3);
  });

  test("두음법칙 대상이 아닌 글자로 끝나면 힌트가 없다", () => {
    expect(secondTurn().hint).toBeNull();
  });
});

describe("두음법칙", () => {
  const bank = bankOf("사자", "자리", "이불", "불꽃", "리본", "본문");
  const afterRi = () =>
    playAiTurn(submitWord(createGame(bank), "사자"), firstPick);

  test("앞 단어가 '리'로 끝나면 '이'로 바뀔 수 있다는 힌트가 나온다", () => {
    const game = afterRi();

    expect(wordsOf(game).at(-1)).toEqual(["ai", "자리"]);
    expect(game.hint).toEqual({ from: "리", to: "이" });
  });

  test("바뀐 글자 '이'로 시작하는 단어를 이을 수 있다", () => {
    const game = submitWord(afterRi(), "이불");

    expect(game.status).toBe("ai-turn");
    expect(game.turns.at(-1)?.entry.word).toBe("이불");
  });

  test("원래 글자 '리'로 시작하는 단어도 이을 수 있다", () => {
    const game = submitWord(afterRi(), "리본");

    expect(game.status).toBe("ai-turn");
    expect(game.turns.at(-1)?.entry.word).toBe("리본");
  });

  test("이어지지 않을 때는 바뀌는 글자도 함께 알려 준다", () => {
    const game = submitWord(afterRi(), "불꽃");

    expect(game.notice).toBe("'리' 또는 '이'로 시작하는 단어를 써 주세요");
  });

  test("ㄴ·ㄹ 계열 글자는 모두 표준 규칙대로 바뀐다", () => {
    const rule: Record<string, string> = {
      녀: "여", 뇨: "요", 뉴: "유", 니: "이",
      랴: "야", 려: "여", 례: "예", 료: "요", 류: "유", 리: "이",
      라: "나", 래: "내", 로: "노", 뢰: "뇌", 루: "누", 르: "느",
    };

    for (const [from, to] of Object.entries(rule)) {
      const game = playAiTurn(
        submitWord(createGame(bankOf("사자", `자${from}`, `${to}마`)), "사자"),
        firstPick
      );

      expect(game.hint, `${from} → ${to}`).toEqual({ from, to });
    }
  });
});

describe("기회와 시간 초과", () => {
  const start = () => createGame(bankOf("사과", "과자", "자전거"));

  test("이을 수 없는 입력이 3번이면 아직 아이 차례다", () => {
    let game = start();
    for (const wrong of ["하", "나", "다"]) game = submitWord(game, wrong);

    expect(game.status).toBe("child-turn");
    expect(game.chances).toBe(1);
  });

  test("이을 수 없는 입력이 4번이면 아이가 못 이은 것으로 AI가 이긴다", () => {
    let game = start();
    for (const wrong of ["하", "나", "다", "라"]) {
      game = submitWord(game, wrong);
    }

    expect(game.status).toBe("lost");
    expect(game.endedBy).toBe("chances");
    expect(game.chances).toBe(0);
  });

  test("시간 초과는 안내와 함께 기회를 1번 쓴다", () => {
    const game = timeOut(start());

    expect(game.notice).toBe("시간이 지났어요");
    expect(game.chances).toBe(3);
    expect(game.status).toBe("child-turn");
  });

  test("실수와 시간 초과를 합쳐 4번이 되면 AI가 이긴다", () => {
    let game = start();
    game = submitWord(game, "하");
    game = timeOut(game);
    game = submitWord(game, "나");
    game = timeOut(game);

    expect(game.status).toBe("lost");
    expect(game.endedBy).toBe("chances");
  });

  test("판이 끝난 뒤에는 입력과 시간 초과가 아무것도 바꾸지 않는다", () => {
    let game = start();
    for (const wrong of ["하", "나", "다", "라"]) {
      game = submitWord(game, wrong);
    }

    expect(submitWord(game, "사과")).toBe(game);
    expect(timeOut(game)).toBe(game);
  });
});

describe("끝장단어와 승패", () => {
  test("아이가 끝장단어를 내면 그 즉시 아이가 이긴다", () => {
    // "사과" 다음 AI가 "과자", 아이가 "자전거"(끝 글자 "거"로 시작하는 단어 없음)를 낸다.
    const afterAi = playAiTurn(
      submitWord(createGame(bankOf("사과", "과자", "자전거")), "사과"),
      firstPick
    );
    const game = submitWord(afterAi, "자전거");

    expect(game.status).toBe("won");
    expect(game.endedBy).toBe("child-dead-end");
    expect(wordsOf(game).at(-1)).toEqual(["child", "자전거"]);
  });

  test("AI가 끝장단어를 내면 그 즉시 AI가 이긴다", () => {
    const game = playAiTurn(
      submitWord(createGame(bankOf("사과", "과일")), "사과"),
      () => 0.9
    );

    expect(game.status).toBe("lost");
    expect(game.endedBy).toBe("ai-dead-end");
    expect(wordsOf(game).at(-1)).toEqual(["ai", "과일"]);
  });

  test("이미 쓴 단어는 끝장단어 판정에서 이을 수 있는 단어로 세지 않는다", () => {
    // "기사"는 이미 썼으므로 "사기" 다음에는 "기"로 시작하는 쓰지 않은 단어가 없다.
    const game = playAiTurn(
      submitWord(createGame(bankOf("기사", "사기")), "기사"),
      firstPick
    );

    expect(wordsOf(game).at(-1)).toEqual(["ai", "사기"]);
    expect(game.status).toBe("lost");
    expect(game.endedBy).toBe("ai-dead-end");
  });
});

describe("AI의 단어 선택", () => {
  const bank = bankOf("사과", "과자", "과일", "자전거");
  // 사과 다음에 이을 수 있는 단어: 과자(이을 길이 있음), 과일(끝장단어)
  const sequence = (...values: number[]) => {
    let index = 0;
    return () => values[Math.min(index++, values.length - 1)];
  };
  const child = () => submitWord(createGame(bank), "사과");

  test("끝장단어를 쓸 수 있을 때 확률 안이면 끝장단어를 낸다", () => {
    const game = playAiTurn(child(), sequence(0.49, 0));

    expect(wordsOf(game).at(-1)).toEqual(["ai", "과일"]);
    expect(game.endedBy).toBe("ai-dead-end");
  });

  test("끝장단어를 쓸 수 있어도 확률 밖이면 일반 단어를 낸다", () => {
    const game = playAiTurn(child(), sequence(0.5, 0));

    expect(wordsOf(game).at(-1)).toEqual(["ai", "과자"]);
    expect(game.status).toBe("child-turn");
  });
});

describe("판 중단", () => {
  test("게임 다시 하기는 승패 없이 판을 끝내고 나온 단어는 그대로 둔다", () => {
    const afterChild = submitWord(
      createGame(bankOf("사과", "과자", "자전거")),
      "사과"
    );
    const game = giveUp(afterChild);

    expect(game.status).toBe("abandoned");
    expect(game.endedBy).toBe("gave-up");
    expect(wordsOf(game)).toEqual([["child", "사과"]]);
  });
});

describe("사전 확인", () => {
  const bank = bankOf("사과", "과자", "자전거", "거북이", "두더지");
  const found = (meaning = "사전의 뜻풀이") =>
    ({ status: "found", meaning }) as const;
  const checking = (word: string, start = createGame(bank)) =>
    submitWord(start, word);

  test("사전에서 인정되면 사전 단어로 판에 들어가고 AI 차례가 된다", () => {
    const game = resolveLookup(checking("사자"), found("사람이 아닌 생물"));

    expect(game.status).toBe("ai-turn");
    expect(game.pending).toBeNull();
    expect(game.turns).toHaveLength(1);
    expect(game.turns[0]).toEqual({
      by: "child",
      entry: {
        word: "사자",
        emoji: "📖",
        meaning: "사람이 아닌 생물",
        example: "",
      },
    });
  });

  test("사전에 없으면 안내와 함께 기회 1번을 쓰고 아이 차례로 돌아온다", () => {
    const game = resolveLookup(checking("하하"), { status: "not-found" });

    expect(game.status).toBe("child-turn");
    expect(game.pending).toBeNull();
    expect(game.notice).toBe("사전에 없는 단어예요");
    expect(game.chances).toBe(3);
    expect(game.turns).toEqual([]);
  });

  test("사전에 없는 입력이 4번이면 AI가 이긴다", () => {
    let game = createGame(bank);
    for (const word of ["하하", "나나", "다다", "라라"]) {
      game = resolveLookup(checking(word, game), { status: "not-found" });
    }

    expect(game.status).toBe("lost");
    expect(game.endedBy).toBe("chances");
  });

  test("사전에 연결하지 못하면 기회를 쓰지 않고 다시 입력하라고 안내한다", () => {
    const game = resolveLookup(checking("하하"), { status: "failed" });

    expect(game.status).toBe("child-turn");
    expect(game.pending).toBeNull();
    expect(game.notice).toBe("사전에 연결하지 못했어요. 다시 입력해 주세요");
    expect(game.chances).toBe(4);
  });

  test("첫 단어가 사전 단어이고 끝장단어이면 거절되고 기회 1번을 쓴다", () => {
    // "하하"는 "하"로 시작하는 단어장 단어가 없어 끝장단어다.
    const game = resolveLookup(checking("하하"), found());

    expect(game.status).toBe("child-turn");
    expect(game.notice).toBe(
      "처음부터 끝장단어는 쓸 수 없어요. 다른 단어를 써 주세요"
    );
    expect(game.chances).toBe(3);
    expect(game.turns).toEqual([]);
  });

  test("판 도중 사전 단어가 끝장단어이면 그 즉시 아이가 이긴다", () => {
    const afterAi = playAiTurn(submitWord(createGame(bank), "사과"), firstPick);
    // AI가 "과자"를 낸 뒤 "자하"를 내면 "하"로 시작하는 단어장 단어가 없다.
    const game = resolveLookup(checking("자하", afterAi), found());

    expect(game.status).toBe("won");
    expect(game.endedBy).toBe("child-dead-end");
    expect(wordsOf(game).at(-1)).toEqual(["child", "자하"]);
  });

  test("앞 단어에 이어지지 않는 입력은 사전을 기다리지 않고 바로 거절한다", () => {
    const afterAi = playAiTurn(submitWord(createGame(bank), "사과"), firstPick);
    const game = submitWord(afterAi, "하하");

    expect(game.status).toBe("child-turn");
    expect(game.notice).toBe("'자'로 시작하는 단어를 써 주세요");
    expect(game.chances).toBe(3);
  });

  test("사전에서 인정된 단어도 이미 쓴 단어로 센다", () => {
    // "사과"로 시작하는 판에서 AI가 "과자"를 낸 뒤, 아이가 "자두"(사전 단어)를 쓴다.
    const afterAi = playAiTurn(submitWord(createGame(bank), "사과"), firstPick);
    const afterDictionary = resolveLookup(checking("자두", afterAi), found());
    expect(afterDictionary.status).toBe("ai-turn");

    const again = submitWord(
      { ...afterDictionary, status: "child-turn" },
      "자두"
    );

    expect(again.notice).toBe("이미 사용한 단어입니다");
    expect(again.status).toBe("child-turn");
  });

  test("확인하는 동안에는 입력과 시간 초과가 아무것도 바꾸지 않는다", () => {
    const game = checking("하하");

    expect(submitWord(game, "사과")).toBe(game);
    expect(timeOut(game)).toBe(game);
  });

  test("확인하는 중에 판을 그만두면 늦게 온 사전 결과는 무시한다", () => {
    const abandoned = giveUp(checking("하하"));

    expect(abandoned.status).toBe("abandoned");
    expect(abandoned.pending).toBeNull();
    expect(resolveLookup(abandoned, found())).toBe(abandoned);
  });
});
