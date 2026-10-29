import { afterEach, describe, expect, test, vi } from "vitest";

import { lookupWord } from "@/features/wordchain";

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubFetch = (impl: (url: string) => Promise<Response>) => {
  const mock = vi.fn(impl);
  vi.stubGlobal("fetch", mock);
  return mock;
};

describe("브라우저의 사전 확인 요청", () => {
  test("이 앱의 서버 경로로만 묻고 결과를 그대로 돌려준다", async () => {
    const mock = stubFetch(
      async () =>
        new Response(JSON.stringify({ status: "found", meanings: ["뜻풀이"] }))
    );

    const answer = await lookupWord("동물");

    expect(answer).toEqual({ status: "found", meanings: ["뜻풀이"] });
    expect(String(mock.mock.calls[0][0])).toBe(
      `/api/word-check?word=${encodeURIComponent("동물")}`
    );
  });

  test("사전에 없다는 답도 그대로 돌려준다", async () => {
    stubFetch(async () => new Response(JSON.stringify({ status: "not-found" })));

    expect(await lookupWord("하하")).toEqual({ status: "not-found" });
  });

  test("네트워크 오류, HTTP 오류, 이상한 응답은 연결 실패로 돌려준다", async () => {
    const cases: Array<() => Promise<Response>> = [
      async () => {
        throw new TypeError("fetch failed");
      },
      async () => new Response("{}", { status: 500 }),
      async () => new Response("<html></html>"),
      async () => new Response(JSON.stringify({ status: "found" })),
      async () => new Response(JSON.stringify({ status: "unknown" })),
    ];

    for (const impl of cases) {
      stubFetch(impl);
      expect(await lookupWord("동물")).toEqual({ status: "failed" });
    }
  });
});

describe("뜻 목록이 이상한 응답", () => {
  test("뜻이 비었거나 글자가 아니면 연결 실패로 돌려준다", async () => {
    for (const meanings of [[], "문자열", [1, 2], [""]]) {
      stubFetch(
        async () => new Response(JSON.stringify({ status: "found", meanings }))
      );
      expect(await lookupWord("동물")).toEqual({ status: "failed" });
    }
  });

  test("여러 뜻은 순서대로 돌려준다", async () => {
    stubFetch(
      async () =>
        new Response(
          JSON.stringify({ status: "found", meanings: ["첫째", "둘째", "셋째"] })
        )
    );

    expect(await lookupWord("사자")).toEqual({
      status: "found",
      meanings: ["첫째", "둘째", "셋째"],
    });
  });
});
