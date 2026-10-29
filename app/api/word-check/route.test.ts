import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const KEY = "0123456789ABCDEF0123456789ABCDEF";

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/word-check/route");
}

const ask = (word: string) =>
  new Request(`http://localhost/api/word-check?word=${encodeURIComponent(word)}`);

beforeEach(() => {
  vi.stubEnv("STDICT_API_KEY", KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("사전 확인 경로", () => {
  test("사전에서 인정된 단어는 뜻풀이와 함께 found로 답한다", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            channel: {
              item: {
                word: "동물",
                pos: "명사",
                sense: { type: "일반어", definition: "사람이 아닌 생물" },
              },
            },
          })
        )
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const response = await GET(ask("동물"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "found",
      meanings: ["사람이 아닌 생물"],
    });
    // 사전 서버로 가는 요청에는 키가 있지만, 브라우저로 가는 응답에는 없다.
    const sent = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(sent).toContain(KEY);
  });

  test("응답 본문과 헤더에 인증 키가 나타나지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError(`fetch failed https://x?key=${KEY}`);
      })
    );
    const { GET } = await loadRoute();

    const response = await GET(ask("동물"));
    const text = await response.text();

    expect(JSON.parse(text)).toEqual({ status: "failed" });
    expect(text).not.toContain(KEY);
    expect([...response.headers.values()].join(" ")).not.toContain(KEY);
  });

  test("단어가 없으면 사전을 부르지 않고 not-found로 답한다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const response = await GET(new Request("http://localhost/api/word-check"));

    expect(await response.json()).toEqual({ status: "not-found" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("인증 키가 없어도 오류 없이 failed로 답한다", async () => {
    vi.stubEnv("STDICT_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();

    const response = await GET(ask("동물"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "failed" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("응답은 캐시되지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
    const { GET, dynamic } = await loadRoute();

    expect(dynamic).toBe("force-dynamic");
    await GET(ask("동물"));
  });
});
