import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { WordChainApp, loadRecord, type WordEntry } from "@/features/wordchain";

const bankOf = (...words: string[]): WordEntry[] =>
  words.map((word) => ({
    word,
    emoji: "⭐",
    meaning: `뜻풀이:${word}`,
    example: `예문:${word}`,
  }));

const AI_DELAY = 1500;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function start(words: WordEntry[], nickname = "하늘") {
  render(<WordChainApp words={words} />);
  fireEvent.change(screen.getByLabelText("닉네임"), {
    target: { value: nickname },
  });
  fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
}

function say(word: string) {
  fireEvent.change(screen.getByLabelText("단어 입력"), {
    target: { value: word },
  });
  fireEvent.click(screen.getByRole("button", { name: "입력" }));
}

const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("닉네임 입력", () => {
  test("비었거나 9자 이상이면 시작하지 못하고 이유가 나온다", () => {
    render(<WordChainApp words={bankOf("사과", "과자")} />);

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
    render(<WordChainApp words={bankOf("사과", "과자")} />);

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
    render(<WordChainApp words={bankOf("사과", "과자")} />);

    expect(screen.getByLabelText("닉네임")).toHaveValue("하늘");
  });
});

describe("단어를 낼 때 뜻 보여 주기", () => {
  test("내가 낸 단어의 뜻이 바로 나오고, 잠시 뒤 AI가 낸 단어의 뜻이 같은 자리에 나온다", () => {
    start(bankOf("사과", "과자", "자전거"));

    say("사과");
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

  test("AI가 단어를 고르는 동안에는 입력할 수 없다", () => {
    start(bankOf("사과", "과자", "자전거"));

    say("사과");

    expect(screen.getByLabelText("단어 입력")).toBeDisabled();
    wait(AI_DELAY);
    expect(screen.getByLabelText("단어 입력")).toBeEnabled();
  });
});

describe("이을 수 없는 입력과 시간 초과", () => {
  test("단어장에 없는 단어는 안내가 나오고 기회가 줄어든다", () => {
    start(bankOf("사과", "과자"));

    say("하하");

    expect(screen.getByText("사전에 없는 단어예요")).toBeInTheDocument();
    expect(screen.getByText(/기회 3번/)).toBeInTheDocument();
  });

  test("30초가 지나면 안내와 함께 기회가 줄고 시간이 다시 시작된다", () => {
    start(bankOf("사과", "과자"));

    wait(29_000);
    expect(screen.getByText("남은 시간 1초")).toBeInTheDocument();

    wait(1_000);
    expect(screen.getByText("시간이 지났어요")).toBeInTheDocument();
    expect(screen.getByText(/기회 3번/)).toBeInTheDocument();
    expect(screen.getByText("남은 시간 30초")).toBeInTheDocument();
  });

  test("기회 4번이 모두 쓰이면 AI가 이기고 패가 기록된다", () => {
    start(bankOf("사과", "과자"));

    for (const wrong of ["하하", "나나", "다다", "라라"]) say(wrong);

    expect(screen.getByText("AI가 이겼어요")).toBeInTheDocument();
    expect(screen.getByText("0승 1패")).toBeInTheDocument();
    expect(loadRecord("하늘")).toEqual({ wins: 0, losses: 1 });
  });
});

describe("두음법칙 힌트", () => {
  test("앞 단어가 '리'로 끝나면 힌트가 나온다", () => {
    start(bankOf("사자", "자리", "이불", "불꽃"));

    say("사자");
    wait(AI_DELAY);

    expect(screen.getByText("두음법칙 적용 가능!")).toBeInTheDocument();
    expect(screen.getByText(/'리'로 끝났어요/)).toBeInTheDocument();
    expect(screen.getByText(/'이'로 시작해도 돼요/)).toBeInTheDocument();
  });

  test("두음법칙 대상이 아니면 힌트가 나오지 않는다", () => {
    start(bankOf("사과", "과자", "자전거"));

    say("사과");
    wait(AI_DELAY);

    expect(screen.queryByText("두음법칙 적용 가능!")).not.toBeInTheDocument();
  });
});

describe("판의 끝", () => {
  test("아이가 끝장단어를 내면 바로 이기고 승이 기록된다", () => {
    start(bankOf("사과", "과자", "자전거"));

    say("사과");
    wait(AI_DELAY);
    say("자전거");

    expect(screen.getByText("내가 이겼어요!")).toBeInTheDocument();
    expect(screen.getByText("1승 0패")).toBeInTheDocument();
    expect(loadRecord("하늘")).toEqual({ wins: 1, losses: 0 });
  });

  test("AI가 끝장단어를 내면 바로 지고, 그 단어가 'AI가 이긴 단어'로 표시된다", () => {
    start(bankOf("사과", "과일"));

    say("사과");
    wait(AI_DELAY);

    expect(screen.getByText("AI가 이겼어요")).toBeInTheDocument();
    expect(screen.getByText("0승 1패")).toBeInTheDocument();
    const words = screen.getAllByTestId("result-word");
    expect(words).toHaveLength(2);
    expect(words[1]).toHaveTextContent("과일");
    expect(words[1]).toHaveTextContent("AI가 이긴 단어");
    expect(words[0]).not.toHaveTextContent("AI가 이긴 단어");
  });

  test("결과 화면에는 이 판의 모든 단어와 뜻이 순서대로 나온다", () => {
    start(bankOf("사과", "과일"));

    say("사과");
    wait(AI_DELAY);

    const words = screen.getAllByTestId("result-word");
    expect(words[0]).toHaveTextContent("사과");
    expect(words[0]).toHaveTextContent("뜻풀이:사과");
    expect(words[1]).toHaveTextContent("뜻풀이:과일");
  });

  test("게임 다시 하기는 승패 없이 끝내고 기록을 바꾸지 않는다", () => {
    start(bankOf("사과", "과자", "자전거"));

    say("사과");
    wait(AI_DELAY);
    fireEvent.click(screen.getByRole("button", { name: "게임 다시 하기" }));

    expect(screen.getByText("게임을 그만뒀어요")).toBeInTheDocument();
    expect(screen.getByText("0승 0패")).toBeInTheDocument();
    expect(loadRecord("하늘")).toEqual({ wins: 0, losses: 0 });
    expect(screen.getAllByTestId("result-word")).toHaveLength(2);
  });

  test("새 판 시작을 누르면 같은 닉네임으로 새 판이 시작되고 기록이 이어진다", () => {
    start(bankOf("사과", "과일"));

    say("사과");
    wait(AI_DELAY);
    fireEvent.click(screen.getByRole("button", { name: "새 판 시작" }));

    expect(screen.getByLabelText("단어 입력")).toBeEnabled();
    expect(screen.getByText("0승 1패")).toBeInTheDocument();
    expect(screen.getByText("남은 시간 30초")).toBeInTheDocument();
    expect(screen.queryByTestId("word-card")).not.toBeInTheDocument();
  });
});
