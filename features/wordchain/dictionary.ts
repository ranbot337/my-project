import type { LookupResult } from "./game";

const ENDPOINT = "https://stdict.korean.go.kr/api/search.do";
const WORD_PATTERN = /^[가-힣]{2,20}$/;
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_CACHED_WORDS = 2000;

const NOT_FOUND: LookupResult = { status: "not-found" };
const FAILED: LookupResult = { status: "failed" };

type Deps = {
  // 지정하지 않으면 환경 변수 STDICT_API_KEY를 쓴다.
  key?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type Sense = { definition?: string; type?: string };
type Item = { word?: string; pos?: string; sense?: Sense | Sense[] };

const asArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

// 표제어의 붙임표(-)와 어깨 기호(^)는 비교할 때 무시한다.
const plain = (headword: string) => headword.replace(/[-^]/g, "");

// '→ 쇄자.'처럼 다른 표기를 가리키기만 하는 뜻풀이는 뜻으로 세지 않는다.
const isReference = (sense: Sense) =>
  (sense.definition ?? "").trim().startsWith("→");

// 입력한 글자와 정확히 같은 표제어 중, 명사이고 (참조를 뺀) 첫 뜻이 일반어인 첫 항목의 첫 뜻풀이.
function firstStandardMeaning(word: string, items: Item[]): string | null {
  for (const item of items) {
    if (plain(item.word ?? "") !== word) continue;
    if (item.pos !== undefined && item.pos !== "명사") continue;
    const first = asArray(item.sense).filter((s) => !isReference(s))[0];
    if (first?.type === "일반어" && first.definition) {
      return first.definition.trim();
    }
  }
  return null;
}

// 표준국어대사전으로 단어가 표준어(명사)인지 확인한다. 서버에서만 쓴다.
// 오류 내용에는 요청 주소와 인증 키가 들어갈 수 있어서 결과에 싣지 않는다.
export function createWordChecker(deps: Deps = {}) {
  const cache = new Map<string, LookupResult>();

  return async function checkWord(word: string): Promise<LookupResult> {
    if (!WORD_PATTERN.test(word)) return NOT_FOUND;

    const key = deps.key ?? process.env.STDICT_API_KEY ?? "";
    if (!key) return FAILED;

    const cached = cache.get(word);
    if (cached) return cached;

    const url = new URL(ENDPOINT);
    const params = {
      key,
      q: word,
      req_type: "json",
      advanced: "y",
      target: "1",
      method: "exact",
      type1: "word",
      pos: "1",
      num: "10",
    };
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, value);
    }

    let body: { error?: unknown; channel?: { item?: Item | Item[] } };
    try {
      const response = await (deps.fetchImpl ?? fetch)(url, {
        signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        cache: "no-store",
      });
      if (!response.ok) return FAILED;
      body = await response.json();
    } catch {
      return FAILED;
    }
    if (!body || body.error) return FAILED;

    const meaning = firstStandardMeaning(
      word,
      asArray(body.channel?.item)
    );
    const answer: LookupResult = meaning
      ? { status: "found", meaning }
      : NOT_FOUND;

    if (cache.size >= MAX_CACHED_WORDS) cache.clear();
    cache.set(word, answer);
    return answer;
  };
}
