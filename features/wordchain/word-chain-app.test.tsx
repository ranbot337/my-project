import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  WordChainApp,
  loadRecord,
  type LookupResult,
  type WordEntry,
} from "@/features/wordchain";

const bankOf = (...words: string[]): WordEntry[] =>
  words.map((word) => ({
    word,
    emoji: "⭐",
    meaning: `뜻풀이:${word}`,
    example: `예문:${word}`,
  }));

const AI_DELAY = 1500;

type Lookup = (word: string) => Promise<LookupResult>;
const notFound: Lookup = async () => ({ status: "not-found" });

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function open(words: WordEntry[], lookupWord: Lookup = notFound) {
  render(<WordChainApp words={words} lookupWord={lookupWord} />);
}

function start(
  words: WordEntry[],
  nickname = "하늘",
  lookupWord: Lookup = notFound
) {
  open(words, lookupWord);
  fireEvent.change(screen.getByLabelText("닉네임"), {
    target: { value: nickname },
  });
  fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
}

async function say(word: string) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("단어 입력"), {
      target: { value: word },
    });
    fireEvent.click(screen.getByRole("button", { name: "입력" }));
  });
}

const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

// 사전 확인을 원하는 때에 끝낼 수 있는 대체 구현.
function pendingLookup() {
  let finish: (result: LookupResult) => void = () => {};
  const lookup = vi.fn(
    () => new Promise<LookupResult>((resolve) => (finish = resolve))
  );
  return {
    lookup: lookup as unknown as Lookup,
    calls: lookup,
    finish: (result: LookupResult) =>
      act(async () => {
        finish(result);
      }),
  };
}

describe("닉네임 입력", () => {
  test("비었거나 9자 이상이면 시작하지 못하고 이유가 나온다", () => {
    open(bankOf("사과", "과자"));

    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    expect(
      screen.getByText("닉네임은 1자 이상 8자 이하로 써 주세요")
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: "아홉글자닉네임이다" },
    });
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    expect(
      screen.getByText("닉네임은 1자 이상 8자 이하로 써 주세요")
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("단어 입력")).not.toBeInTheDocument();
  });

  test("실명을 쓰지 말라는 안내가 보인다", () => {
    open(bankOf("사과", "과자"));

    expect(screen.getByText(/실명은 쓰지 마세요/)).toBeInTheDocument();
  });

  test("시작하면 닉네임과 0승 0패, 남은 시간과 기회가 보인다", () => {
    start(bankOf("사과", "과자"), " 하늘 ");

    expect(screen.getByText("하늘")).toBeInTheDocument();
    expect(screen.getByText("0승 0패")).toBeInTheDocument();
    expect(screen.getByText("남은 시간 30초")).toBeInTheDocument();
    expect(screen.getByText(/기회 4번/)).toBeInTheDocument();
  });

  test("마지막으로 쓴 닉네임이 다음에 입력 칸에 채워진다", () => {
    start(bankOf("사과", "과자"));
    fireEvent.click(screen.getByRole("button", { name: "게임 다시 하기" }));
    expect(screen.getByRole("button", { name: "새 판 시작" })).toBeVisible();

    document.body.innerHTML = "";
    open(bankOf("사과", "과자"));

    expect(screen.getByLabelText("닉네임")).toHaveValue("하늘");
  });
});

describe("단어를 낼 때 뜻 보여 주기", () => {
  test("내가 낸 단어의 뜻이 바로 나오고, 잠시 뒤 AI가 낸 단어의 뜻이 같은 자리에 나온다", async () => {
    start(bankOf("사과", "과자", "자전거"));

    await say("사과");
    const card = screen.getByTestId("word-card");
    expect(card).toHaveTextContent("사과");
    expect(card).toHaveTextContent("뜻풀이:사과");
    expect(card).toHaveTextContent("예문:사과");
    expect(card).toHaveTextContent("내가 냈어요");

    wait(AI_DELAY);
    expect(screen.getByTestId("word-card")).toHaveTextContent("과자");
    expect(screen.getByTestId("word-card")).toHaveTextContent("뜻풀이:과자");
    expect(screen.getByTestId("word-card")).toHaveTextContent("AI가 냈어요");
    expect(screen.getByLabelText("지금까지 나온 단어")).toHaveTextContent(
      "사과 → 과자"
    );
  });

  test("AI가 단어를 고르는 동안에는 입력할 수 없다", async () => {
    start(bankOf("사과", "과자", "자전거"));

    await say("사과");

    expect(screen.getByLabelText("단어 입력")).toBeDisabled();
    wait(AI_DELAY);
    expect(screen.getByLabelText("단어 입력")).toBeEnabled();
  });
});

describe("사전으로 단어 확인", () => {
  const words = bankOf("사과", "과자", "자전거", "거북이");

  test("단어장에 없는 단어는 확인하는 동안 입력이 막히고 안내가 나온다", async () => {
    const lookup = pendingLookup();
    start(words, "하늘", lookup.lookup);

    await say("사자");

    expect(lookup.calls).toHaveBeenCalledWith("사자");
    expect(screen.getByText("사전에서 확인하고 있어요…")).toBeInTheDocument();
    expect(screen.getByLabelText("단어 입력")).toBeDisabled();
    expect(screen.getByRole("button", { name: "입력" })).toBeDisabled();
  });

  test("확인하는 동안 남은 시간이 멈췄다가 끝나면 이어서 흐른다", async () => {
    const lookup = pendingLookup();
    start(words, "하늘", lookup.lookup);

    wait(5_000);
    expect(screen.getByText("남은 시간 25초")).toBeInTheDocument();

    await say("사자");
    wait(40_000);
    expect(screen.getByText("남은 시간 25초")).toBeInTheDocument();
    expect(screen.getByText(/기회 4번/)).toBeInTheDocument();

    await lookup.finish({ status: "not-found" });
    expect(screen.getByText("남은 시간 25초")).toBeInTheDocument();
    wait(1_000);
    expect(screen.getByText("남은 시간 24초")).toBeInTheDocument();
  });

  test("사전에서 인정되면 📖와 사전 뜻풀이가 보이고 예문 줄은 없다", async () => {
    const lookup = pendingLookup();
    start(words, "하늘", lookup.lookup);

    await say("사자");
    await lookup.finish({ status: "found", meanings: ["고양잇과의 맹수"] });

    const card = screen.getByTestId("word-card");
    expect(card).toHaveTextContent("📖");
    expect(card).toHaveTextContent("사자");
    expect(card).toHaveTextContent("고양잇과의 맹수");
    expect(card).toHaveTextContent("내가 냈어요");
    expect(card).not.toHaveTextContent("예문");
    expect(screen.queryByText("사전에서 확인하고 있어요…")).toBeNull();
  });

  test("사전 단어 뒤에는 AI가 단어장 단어로 이어 간다", async () => {
    start(words, "하늘", async () => ({ status: "found", meanings: ["뜻"] }));

    await say("사자");
    wait(AI_DELAY);

    expect(screen.getByTestId("word-card")).toHaveTextContent("자전거");
    expect(screen.getByTestId("word-card")).toHaveTextContent("AI가 냈어요");
  });

  test("사전에 없으면 안내가 나오고 기회가 줄어든다", async () => {
    start(words);

    await say("하하");

    expect(screen.getByText("사전에 없는 단어예요")).toBeInTheDocument();
    expect(screen.getByText(/기회 3번/)).toBeInTheDocument();
    expect(screen.getByLabelText("단어 입력")).toBeEnabled();
  });

  test("연결하지 못하면 기회가 줄지 않고 단어장 단어는 계속 낼 수 있다", async () => {
    start(words, "하늘", async () => ({ status: "failed" }));

    await say("사자");
    expect(
      screen.getByText("사전에 연결하지 못했어요. 다시 입력해 주세요")
    ).toBeInTheDocument();
    expect(screen.getByText(/기회 4번/)).toBeInTheDocument();

    await say("사과");
    expect(screen.getByTestId("word-card")).toHaveTextContent("뜻풀이:사과");
  });

  test("한 글자나 이어지지 않는 입력은 사전을 부르지 않는다", async () => {
    const lookup = pendingLookup();
    start(words, "하늘", lookup.lookup);

    await say("사");
    expect(screen.getByText("두 글자 이상 써 주세요")).toBeInTheDocument();

    await say("사과");
    wait(AI_DELAY);
    await say("하하");
    expect(screen.getByText("'자'로 시작하는 단어를 써 주세요")).toBeVisible();
    expect(lookup.calls).not.toHaveBeenCalled();
  });

  test("확인하는 중에 게임 다시 하기를 누르면 늦게 온 결과는 무시된다", async () => {
    const lookup = pendingLookup();
    start(words, "하늘", lookup.lookup);

    await say("사자");
    fireEvent.click(screen.getByRole("button", { name: "게임 다시 하기" }));
    expect(screen.getByText("게임을 그만뒀어요")).toBeInTheDocument();

    await lookup.finish({ status: "found", meanings: ["뜻"] });

    expect(screen.getByText("게임을 그만뒀어요")).toBeInTheDocument();
    expect(screen.queryAllByTestId("result-word")).toHaveLength(0);
    expect(loadRecord("하늘")).toEqual({ wins: 0, losses: 0 });
  });

  test("사전 단어가 끝장단어이면 그 즉시 이기고 결과 화면에도 📖로 나온다", async () => {
    start(words, "하늘", async () => ({ status: "found", meanings: ["사전 뜻"] }));

    await say("사과");
    wait(AI_DELAY);
    await say("자하");

    expect(screen.getByText("내가 이겼어요!")).toBeInTheDocument();
    expect(loadRecord("하늘")).toEqual({ wins: 1, losses: 0 });
    const items = screen.getAllByTestId("result-word");
    expect(items[2]).toHaveTextContent("📖");
    expect(items[2]).toHaveTextContent("자하");
    expect(items[2]).toHaveTextContent("사전 뜻");
    expect(items[2]).not.toHaveTextContent("예문");
    expect(items[0]).toHaveTextContent("예문:사과");
  });
});

describe("출처 표시", () => {
  const expectSource = () => {
    expect(
      screen.getByRole("link", { name: "국립국어원 표준국어대사전" })
    ).toHaveAttribute("href", "https://stdict.korean.go.kr/");
    expect(screen.getByRole("link", { name: "CC BY-SA 2.0 KR" })).toHaveAttribute(
      "href",
      "https://creativecommons.org/licenses/by-sa/2.0/kr/"
    );
  };

  test("닉네임, 게임, 결과 화면 모두에 출처와 라이선스 링크가 보인다", async () => {
    open(bankOf("사과", "과자"));
    expectSource();

    fireEvent.change(screen.getByLabelText("닉네임"), {
      target: { value: "하늘" },
    });
    fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
    expectSource();

    fireEvent.click(screen.getByRole("button", { name: "게임 다시 하기" }));
    expect(screen.getByText("게임을 그만뒀어요")).toBeInTheDocument();
    expectSource();
  });
});

describe("이을 수 없는 입력과 시간 초과", () => {
  test("30초가 지나면 안내와 함께 기회가 줄고 시간이 다시 시작된다", () => {
    start(bankOf("사과", "과자"));

    wait(29_000);
    expect(screen.getByText("남은 시간 1초")).toBeInTheDocument();

    wait(1_000);
    expect(screen.getByText("시간이 지났어요")).toBeInTheDocument();
    expect(screen.getByText(/기회 3번/)).toBeInTheDocument();
    expect(screen.getByText("남은 시간 30초")).toBeInTheDocument();
  });

  test("기회 4번이 모두 쓰이면 AI가 이기고 패가 기록된다", async () => {
    start(bankOf("사과", "과자"));

    for (const wrong of ["하하", "나나", "다다", "라라"]) await say(wrong);

    expect(screen.getByText("AI가 이겼어요")).toBeInTheDocument();
    expect(screen.getByText("0승 1패")).toBeInTheDocument();
    expect(loadRecord("하늘")).toEqual({ wins: 0, losses: 1 });
  });
});

describe("두음법칙 힌트", () => {
  test("앞 단어가 '리'로 끝나면 힌트가 나온다", async () => {
    start(bankOf("사자", "자리", "이불", "불꽃"));

    await say("사자");
    wait(AI_DELAY);

    expect(screen.getByText("두음법칙 적용 가능!")).toBeInTheDocument();
    expect(screen.getByText(/'리'로 끝났어요/)).toBeInTheDocument();
    expect(screen.getByText(/'이'로 시작해도 돼요/)).toBeInTheDocument();
  });

  test("두음법칙 대상이 아니면 힌트가 나오지 않는다", async () => {
    start(bankOf("사과", "과자", "자전거"));

    await say("사과");
    wait(AI_DELAY);

    expect(screen.queryByText("두음법칙 적용 가능!")).not.toBeInTheDocument();
  });
});

describe("판의 끝", () => {
  test("아이가 끝장단어를 내면 바로 이기고 승이 기록된다", async () => {
    start(bankOf("사과", "과자", "자전거"));

    await say("사과");
    wait(AI_DELAY);
    await say("자전거");

    expect(screen.getByText("내가 이겼어요!")).toBeInTheDocument();
    expect(screen.getByText("1승 0패")).toBeInTheDocument();
    expect(loadRecord("하늘")).toEqual({ wins: 1, losses: 0 });
  });

  test("AI가 끝장단어를 내면 바로 지고, 그 단어가 'AI가 이긴 단어'로 표시된다", async () => {
    start(bankOf("사과", "과일"));

    await say("사과");
    wait(AI_DELAY);

    expect(screen.getByText("AI가 이겼어요")).toBeInTheDocument();
    expect(screen.getByText("0승 1패")).toBeInTheDocument();
    const words = screen.getAllByTestId("result-word");
    expect(words).toHaveLength(2);
    expect(words[1]).toHaveTextContent("과일");
    expect(words[1]).toHaveTextContent("AI가 이긴 단어");
    expect(words[0]).not.toHaveTextContent("AI가 이긴 단어");
  });

  test("결과 화면에는 이 판의 모든 단어와 뜻이 순서대로 나온다", async () => {
    start(bankOf("사과", "과일"));

    await say("사과");
    wait(AI_DELAY);

    const words = screen.getAllByTestId("result-word");
    expect(words[0]).toHaveTextContent("사과");
    expect(words[0]).toHaveTextContent("뜻풀이:사과");
    expect(words[1]).toHaveTextContent("뜻풀이:과일");
  });

  test("게임 다시 하기는 승패 없이 끝내고 기록을 바꾸지 않는다", async () => {
    start(bankOf("사과", "과자", "자전거"));

    await say("사과");
    wait(AI_DELAY);
    fireEvent.click(screen.getByRole("button", { name: "게임 다시 하기" }));

    expect(screen.getByText("게임을 그만뒀어요")).toBeInTheDocument();
    expect(screen.getByText("0승 0패")).toBeInTheDocument();
    expect(loadRecord("하늘")).toEqual({ wins: 0, losses: 0 });
    expect(screen.getAllByTestId("result-word")).toHaveLength(2);
  });

  test("새 판 시작을 누르면 같은 닉네임으로 새 판이 시작되고 기록이 이어진다", async () => {
    start(bankOf("사과", "과일"));

    await say("사과");
    wait(AI_DELAY);
    fireEvent.click(screen.getByRole("button", { name: "새 판 시작" }));

    expect(screen.getByLabelText("단어 입력")).toBeEnabled();
    expect(screen.getByText("0승 1패")).toBeInTheDocument();
    expect(screen.getByText("남은 시간 30초")).toBeInTheDocument();
    expect(screen.queryByTestId("word-card")).not.toBeInTheDocument();
  });
});

describe("철자가 같은 단어의 여러 뜻", () => {
  const words = bankOf("사과", "과자", "자전거", "거북이");

  test("뜻이 여러 개이면 번호를 붙여 모두 보여 준다", async () => {
    start(words, "하늘", async () => ({
      status: "found",
      meanings: ["첫째 뜻풀이", "둘째 뜻풀이", "셋째 뜻풀이"],
    }));

    await say("사자");

    const card = screen.getByTestId("word-card");
    const items = within(card).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("첫째 뜻풀이");
    expect(items[2]).toHaveTextContent("셋째 뜻풀이");
    expect(card).toHaveTextContent("1.");
    expect(card).toHaveTextContent("3.");
  });

  test("뜻이 하나이면 번호 없이 '뜻:' 한 줄로 보여 준다", async () => {
    start(words, "하늘", async () => ({
      status: "found",
      meanings: ["하나뿐인 뜻"],
    }));

    await say("사자");

    const card = screen.getByTestId("word-card");
    expect(card).toHaveTextContent("뜻: 하나뿐인 뜻");
    expect(within(card).queryAllByRole("listitem")).toHaveLength(0);
  });

  test("결과 화면에서도 여러 뜻을 번호를 붙여 보여 준다", async () => {
    start(words, "하늘", async () => ({
      status: "found",
      meanings: ["첫째 뜻풀이", "둘째 뜻풀이"],
    }));

    await say("사자");
    fireEvent.click(screen.getByRole("button", { name: "게임 다시 하기" }));

    const item = screen.getAllByTestId("result-word")[0];
    expect(within(item).getAllByRole("listitem")).toHaveLength(2);
    expect(item).toHaveTextContent("둘째 뜻풀이");
  });
});

describe("힌트 도우미", () => {
  // 아이가 "사과"를 내고 AI가 "과자"를 낸 아이 차례(이을 글자 '자')에서 시작한다.
  const hintWords = bankOf("사과", "과자", "자전거", "자석", "거북이");

  async function toMyTurn() {
    start(hintWords);
    await say("사과");
    wait(AI_DELAY);
  }

  const hintButton = () => screen.getByRole("button", { name: /^힌트/ });
  const helper = () => screen.getByRole("complementary", { name: "힌트 도우미" });

  test("첫 단어 차례와 AI 차례에는 힌트 버튼을 누를 수 없다", async () => {
    start(hintWords);
    expect(hintButton()).toBeDisabled();
    expect(hintButton()).toHaveTextContent("힌트 3번 남음");

    await say("사과");
    expect(hintButton()).toBeDisabled();

    wait(AI_DELAY);
    expect(hintButton()).toBeEnabled();
  });

  test("열면 도우미가 열리고 남은 횟수가 줄어든다", async () => {
    await toMyTurn();

    fireEvent.click(hintButton());

    expect(within(helper()).getByText("남은 힌트 2번")).toBeInTheDocument();
    expect(within(helper()).getByText("'자'로 시작")).toBeInTheDocument();
  });

  test("끝장단어를 먼저 표시와 함께 보여 주고 나머지가 뒤따른다", async () => {
    await toMyTurn();

    fireEvent.click(hintButton());

    const items = within(helper()).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("자석");
    expect(items[0]).toHaveTextContent("🔥 끝장단어");
    expect(items[1]).toHaveTextContent("자전거");
    expect(items[1]).not.toHaveTextContent("끝장단어");
  });

  test("단어를 누르면 도우미 안에 이모지, 뜻, 예문이 보인다", async () => {
    await toMyTurn();
    fireEvent.click(hintButton());
    expect(
      within(helper()).getByText("단어를 눌러 뜻을 보세요")
    ).toBeInTheDocument();

    fireEvent.click(within(helper()).getByRole("button", { name: /자석/ }));
    expect(helper()).toHaveTextContent("뜻풀이:자석");
    expect(helper()).toHaveTextContent("예문:자석");

    fireEvent.click(within(helper()).getByRole("button", { name: /자전거/ }));
    expect(helper()).toHaveTextContent("뜻풀이:자전거");
    expect(helper()).not.toHaveTextContent("뜻풀이:자석");
  });

  test("'이 단어 쓰기'는 입력 칸을 채우고 포커스를 옮기지만 제출하지는 않는다", async () => {
    await toMyTurn();
    fireEvent.click(hintButton());
    fireEvent.click(within(helper()).getByRole("button", { name: /자전거/ }));

    fireEvent.click(
      within(helper()).getByRole("button", { name: "이 단어 쓰기" })
    );

    expect(screen.getByLabelText("단어 입력")).toHaveValue("자전거");
    expect(screen.getByLabelText("단어 입력")).toHaveFocus();
    expect(screen.getByLabelText("지금까지 나온 단어")).toHaveTextContent(
      "사과 → 과자"
    );
    expect(helper()).toBeInTheDocument();
  });

  test("열려 있는 동안에도 남은 시간은 계속 흐른다", async () => {
    await toMyTurn();
    expect(screen.getByText("남은 시간 30초")).toBeInTheDocument();

    fireEvent.click(hintButton());
    wait(5_000);

    expect(screen.getByText("남은 시간 25초")).toBeInTheDocument();
    expect(helper()).toBeInTheDocument();
  });

  test("입력을 내면 닫히고, 같은 차례에 다시 열어도 횟수는 그대로다", async () => {
    await toMyTurn();
    fireEvent.click(hintButton());

    await say("하");
    expect(
      screen.queryByRole("complementary", { name: "힌트 도우미" })
    ).not.toBeInTheDocument();
    expect(hintButton()).toHaveTextContent("힌트 2번 남음");

    fireEvent.click(hintButton());
    expect(within(helper()).getByText("남은 힌트 2번")).toBeInTheDocument();
  });

  test("닫기 버튼으로 닫을 수 있다", async () => {
    await toMyTurn();
    fireEvent.click(hintButton());

    fireEvent.click(within(helper()).getByRole("button", { name: "닫기" }));

    expect(
      screen.queryByRole("complementary", { name: "힌트 도우미" })
    ).not.toBeInTheDocument();
  });

  test("도우미에서 고른 끝장단어를 내면 그 즉시 이긴다", async () => {
    await toMyTurn();
    fireEvent.click(hintButton());
    fireEvent.click(within(helper()).getByRole("button", { name: /자석/ }));
    fireEvent.click(
      within(helper()).getByRole("button", { name: "이 단어 쓰기" })
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "입력" }));
    });

    expect(screen.getByText("내가 이겼어요!")).toBeInTheDocument();
    expect(loadRecord("하늘")).toEqual({ wins: 1, losses: 0 });
  });

  test("힌트를 모두 쓰면 버튼을 누를 수 없고 안내가 나온다", async () => {
    const chain = bankOf(
      "가나", "나다", "다마", "마바", "바사", "사아", "아자", "자카", "카타", "타파"
    );
    start(chain);
    await say("가나");
    wait(AI_DELAY);

    for (const mine of ["다마", "바사", "아자"]) {
      fireEvent.click(hintButton());
      await say(mine);
      wait(AI_DELAY);
    }

    expect(hintButton()).toBeDisabled();
    expect(hintButton()).toHaveTextContent("힌트 0번 남음");
    expect(screen.getByText("힌트를 모두 썼어요")).toBeInTheDocument();
  });

  test("새 판은 힌트 3번으로 시작한다", async () => {
    await toMyTurn();
    fireEvent.click(hintButton());
    fireEvent.click(screen.getByRole("button", { name: "게임 다시 하기" }));
    fireEvent.click(screen.getByRole("button", { name: "새 판 시작" }));

    expect(hintButton()).toHaveTextContent("힌트 3번 남음");
  });
});
