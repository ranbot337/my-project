import { describe, expect, test, vi } from "vitest";

import { createWordChecker } from "@/features/wordchain/server";

const KEY = "0123456789ABCDEF0123456789ABCDEF";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const sense = (type: string, definition: string) => ({
  definition,
  type,
  link: "https://stdict.korean.go.kr/",
});

const item = (word: string, firstSense: object, pos = "명사") => ({
  word,
  pos,
  sup_no: "0",
  target_code: "1",
  sense: firstSense,
});

const result = (...items: object[]) => ({
  channel: { total: items.length, item: items },
});

function checkerWith(fetchImpl: typeof fetch, extra = {}) {
  return createWordChecker({ key: KEY, fetchImpl, ...extra });
}

describe("사전 확인", () => {
  test("정확히 같은 표제어가 있으면 첫 뜻풀이와 함께 인정한다", async () => {
    const fetchImpl = vi.fn(async () =>
      reply(result(item("동물", sense("일반어", "사람이 아닌 생물"))))
    );

    const answer = await checkerWith(fetchImpl as unknown as typeof fetch)(
      "동물"
    );

    expect(answer).toEqual({ status: "found", meanings: ["사람이 아닌 생물"] });
  });

  test("명사, 단어, 정확히 일치 조건으로 JSON을 요청한다", async () => {
    const fetchImpl = vi.fn(async () => reply(result()));

    await checkerWith(fetchImpl as unknown as typeof fetch)("동물");

    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(url.origin + url.pathname).toBe(
      "https://stdict.korean.go.kr/api/search.do"
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      q: "동물",
      req_type: "json",
      advanced: "y",
      target: "1",
      method: "exact",
      type1: "word",
      pos: "1",
    });
  });

  test("결과가 없으면 사전에 없는 단어로 본다", async () => {
    const answer = await checkerWith((async () =>
      reply({ channel: { total: 0 } })) as typeof fetch)("하하");

    expect(answer).toEqual({ status: "not-found" });
  });

  test("응답에 항목이 아예 없어도 사전에 없는 단어로 본다", async () => {
    const answer = await checkerWith((async () => reply({})) as typeof fetch)(
      "하하"
    );

    expect(answer).toEqual({ status: "not-found" });
  });

  test("첫 뜻이 일반어가 아니면(방언, 북한어, 옛말) 인정하지 않는다", async () => {
    for (const type of ["지역어", "북한어", "옛말"]) {
      const answer = await checkerWith((async () =>
        reply(result(item("가시내", sense(type, "계집아이"))))) as typeof fetch)(
        "가시내"
      );

      expect(answer, type).toEqual({ status: "not-found" });
    }
  });

  test("명사가 아닌 항목만 있으면 인정하지 않는다", async () => {
    const answer = await checkerWith((async () =>
      reply(
        result(item("먹다", sense("일반어", "음식을 입에 넣어 삼키다"), "동사"))
      )) as typeof fetch)("먹다");

    expect(answer).toEqual({ status: "not-found" });
  });

  test("여러 항목 중 같은 글자이고 일반어인 첫 항목의 뜻을 쓴다", async () => {
    const answer = await checkerWith((async () =>
      reply(
        result(
          item("동물원", sense("일반어", "여러 동물을 모아 기르는 곳")),
          item("동물", sense("지역어", "사투리 뜻")),
          item("동물", sense("일반어", "첫 번째 일반어 뜻")),
          item("동물", sense("일반어", "두 번째 일반어 뜻"))
        )
      )) as typeof fetch)("동물");

    expect(answer).toEqual({ status: "found", meanings: ["첫 번째 일반어 뜻", "두 번째 일반어 뜻"] });
  });

  test("뜻이 하나뿐이어도, 여러 개여도 첫 번째 뜻만 쓴다", async () => {
    const answer = await checkerWith((async () =>
      reply(
        result(
          item("사과", [
            sense("일반어", "첫째 뜻"),
            sense("일반어", "둘째 뜻"),
          ])
        )
      )) as typeof fetch)("사과");

    expect(answer).toEqual({ status: "found", meanings: ["첫째 뜻"] });
  });

  test("표제어의 붙임표와 어깨 기호는 무시하고 비교한다", async () => {
    const answer = await checkerWith((async () =>
      reply(result(item("소-방^관", sense("일반어", "불을 끄는 사람"))))) as typeof fetch)(
      "소방관"
    );

    expect(answer).toEqual({ status: "found", meanings: ["불을 끄는 사람"] });
  });

  test("한글 두 글자 이상이 아니면 사전을 부르지 않고 인정하지 않는다", async () => {
    const fetchImpl = vi.fn(async () => reply(result()));
    const check = checkerWith(fetchImpl as unknown as typeof fetch);

    for (const word of ["가", "abc", "가a", "가 나", "", "가".repeat(21)]) {
      expect(await check(word), word).toEqual({ status: "not-found" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("연결 실패", () => {
  const failures: Record<string, [() => Promise<Response>, string]> = {
    "HTTP 오류": [async () => reply({}, 500), "http-500"],
    "JSON이 아닌 응답": [
      async () => new Response("<html>점검 중</html>"),
      "bad-response",
    ],
    "사전의 오류 응답": [
      async () =>
        reply({ error: { error_code: "020", message: "Unregistered key." } }),
      "api-error-020: Unregistered key.",
    ],
    "네트워크 오류": [
      async () => {
        throw new TypeError(`fetch failed https://x?key=${KEY}`);
      },
      "network-TypeError",
    ],
  };

  for (const [name, [fetchImpl, reason]] of Object.entries(failures)) {
    test(`${name}이면 연결 실패와 그 이유를 알리고 결과에 키가 없다`, async () => {
      const answer = await checkerWith(fetchImpl as unknown as typeof fetch)(
        "동물"
      );

      expect(answer).toEqual({ status: "failed", reason });
      expect(JSON.stringify(answer)).not.toContain(KEY);
    });
  }

  test("사전의 오류 메시지에 키가 들어 있어도 이유에는 가려서 싣는다", async () => {
    const answer = await checkerWith((async () =>
      reply({
        error: { error_code: "020", message: `bad key ${KEY}` },
      })) as typeof fetch)("동물");

    expect(answer).toEqual({
      status: "failed",
      reason: "api-error-020: bad key ***",
    });
    expect(JSON.stringify(answer)).not.toContain(KEY);
  });

  test("인증 키가 없으면 사전을 부르지 않고 연결 실패로 알린다", async () => {
    const fetchImpl = vi.fn(async () => reply(result()));
    const check = createWordChecker({
      key: "",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(await check("동물")).toEqual({ status: "failed", reason: "no-key" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("제한 시간 안에 응답이 없으면 연결 실패로 알린다", async () => {
    const neverAnswers = ((_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted"))
        );
      })) as unknown as typeof fetch;

    const answer = await checkerWith(neverAnswers, { timeoutMs: 20 })("동물");

    expect(answer).toEqual({ status: "failed", reason: "timeout" });
  });

  test("실패는 기억하지 않아서 다음에 다시 묻는다", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        reply(result(item("동물", sense("일반어", "사람이 아닌 생물"))))
      );
    const check = checkerWith(fetchImpl as unknown as typeof fetch);

    expect(await check("동물")).toMatchObject({ status: "failed" });
    expect(await check("동물")).toEqual({
      status: "found",
      meanings: ["사람이 아닌 생물"],
    });
  });
});

describe("확인 결과 기억", () => {
  test("같은 단어는 한 번만 묻는다", async () => {
    const fetchImpl = vi.fn(async () =>
      reply(result(item("동물", sense("일반어", "사람이 아닌 생물"))))
    );
    const check = checkerWith(fetchImpl as unknown as typeof fetch);

    await check("동물");
    const second = await check("동물");

    expect(second).toEqual({ status: "found", meanings: ["사람이 아닌 생물"] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("사전에 없다는 결과도 기억한다", async () => {
    const fetchImpl = vi.fn(async () => reply(result()));
    const check = checkerWith(fetchImpl as unknown as typeof fetch);

    await check("하하");
    await check("하하");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("다른 표기를 가리키는 뜻풀이", () => {
  const check = (items: object[]) =>
    checkerWith((async () => reply(result(...items))) as typeof fetch);

  test("'→ …' 참조 항목은 건너뛰고 다음 항목의 뜻풀이를 쓴다", async () => {
    const answer = await check([
      item("사자", sense("일반어", "→ 쇄자.")),
      item("사자", sense("일반어", "고양잇과의 맹수")),
    ])("사자");

    expect(answer).toEqual({ status: "found", meanings: ["고양잇과의 맹수"] });
  });

  test("한 항목 안에서도 참조 뜻은 건너뛰고 다음 뜻을 쓴다", async () => {
    const answer = await check([
      item("사자", [
        sense("일반어", "→ 쇄자."),
        sense("일반어", "고양잇과의 맹수"),
      ]),
    ])("사자");

    expect(answer).toEqual({ status: "found", meanings: ["고양잇과의 맹수"] });
  });

  test("참조 항목뿐이면 표준 표기가 아닌 것으로 보고 인정하지 않는다", async () => {
    const answer = await check([item("사자", sense("일반어", "→ 쇄자."))])(
      "사자"
    );

    expect(answer).toEqual({ status: "not-found" });
  });
});

describe("철자가 같은 단어의 여러 뜻", () => {
  const check = (items: object[]) =>
    checkerWith((async () => reply(result(...items))) as typeof fetch);

  test("뜻은 최대 3개까지만 순서대로 모은다", async () => {
    const answer = await check([
      item("사자", sense("일반어", "첫째")),
      item("사자", sense("일반어", "둘째")),
      item("사자", sense("일반어", "셋째")),
      item("사자", sense("일반어", "넷째")),
    ])("사자");

    expect(answer).toEqual({ status: "found", meanings: ["첫째", "둘째", "셋째"] });
  });

  test("항목마다 첫 번째 뜻만 쓰고, 같은 뜻풀이는 한 번만 넣는다", async () => {
    const answer = await check([
      item("사자", [sense("일반어", "첫째"), sense("일반어", "같은 항목의 둘째")]),
      item("사자", sense("일반어", "첫째")),
      item("사자", sense("일반어", "다른 항목의 둘째")),
    ])("사자");

    expect(answer).toEqual({
      status: "found",
      meanings: ["첫째", "다른 항목의 둘째"],
    });
  });

  test("참조 항목, 일반어가 아닌 항목, 다른 글자 항목은 건너뛴다", async () => {
    const answer = await check([
      item("사자", sense("일반어", "→ 쇄자.")),
      item("사자", sense("지역어", "사투리 뜻")),
      item("사자성어", sense("일반어", "다른 단어의 뜻")),
      item("사자", sense("일반어", "고양잇과의 맹수")),
    ])("사자");

    expect(answer).toEqual({ status: "found", meanings: ["고양잇과의 맹수"] });
  });
});
