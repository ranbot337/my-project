import type { LookupResult } from "./game";

const ENDPOINT = "https://stdict.korean.go.kr/api/search.do";
const WORD_PATTERN = /^[가-힣]{2,20}$/;
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_CACHED_WORDS = 2000;
const MAX_MEANINGS = 3;

const NOT_FOUND: LookupResult = { status: "not-found" };
const failed = (reason: string): LookupResult => ({ status: "failed", reason });

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

// 입력한 글자와 정확히 같은 표제어(철자가 같은 단어 포함) 중, 명사이고 (참조를 뺀) 첫 뜻이
// 일반어인 항목마다 첫 뜻풀이를 순서대로 최대 3개 모은다. 같은 뜻풀이는 한 번만 넣는다.
function standardMeanings(word: string, items: Item[]): string[] {
  const meanings: string[] = [];
  for (const item of items) {
    if (meanings.length >= MAX_MEANINGS) break;
    if (plain(item.word ?? "") !== word) continue;
    if (item.pos !== undefined && item.pos !== "명사") continue;
    const first = asArray(item.sense).filter((s) => !isReference(s))[0];
    if (first?.type !== "일반어" || !first.definition) continue;
    const meaning = first.definition.trim();
    if (!meanings.includes(meaning)) meanings.push(meaning);
  }
  return meanings;
}

// JSON이 아닌 응답의 종류와 앞 100자를 진단용 이유로 만든다. 키가 섞여 있으면 가린다.
function badResponseReason(
  response: Response,
  text: string,
  key: string
): string {
  const type = response.headers.get("content-type") ?? "no-content-type";
  const snippet = text.replaceAll(key, "***").replace(/\s+/g, " ").trim();
  return `bad-response (${type}): ${snippet.slice(0, 100)}`;
}

// 사전이 돌려준 오류 코드와 메시지를 진단용 이유로 만든다. 키가 섞여 있으면 가린다.
function apiErrorReason(error: unknown, key: string): string {
  const { error_code: code, message } = (error ?? {}) as {
    error_code?: unknown;
    message?: unknown;
  };
  const text = `api-error-${code ?? "unknown"}${message ? `: ${message}` : ""}`;
  return text.replaceAll(key, "***").slice(0, 120);
}

// 표준국어대사전으로 단어가 표준어(명사)인지 확인한다. 서버에서만 쓴다.
// 오류 내용에는 요청 주소와 인증 키가 들어갈 수 있어서 결과에 싣지 않는다.
export function createWordChecker(deps: Deps = {}) {
  const cache = new Map<string, LookupResult>();

  return async function checkWord(word: string): Promise<LookupResult> {
    if (!WORD_PATTERN.test(word)) return NOT_FOUND;

    const key = deps.key ?? process.env.STDICT_API_KEY ?? "";
    if (!key) return failed("no-key");

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

    const signal = AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    let response: Response;
    try {
      response = await (deps.fetchImpl ?? fetch)(url, {
        signal,
        cache: "no-store",
      });
    } catch (error) {
      // 오류 메시지에는 요청 주소와 키가 들어갈 수 있어서 이름만 쓴다.
      const name = (error as { name?: string })?.name ?? "Error";
      return failed(signal.aborted ? "timeout" : `network-${name}`);
    }
    if (!response.ok) return failed(`http-${response.status}`);

    let body: { error?: unknown; channel?: { item?: Item | Item[] } };
    let text = "";
    try {
      text = await response.text();
      body = JSON.parse(text);
    } catch {
      return failed(badResponseReason(response, text, key));
    }
    if (!body || typeof body !== "object") {
      return failed(badResponseReason(response, text, key));
    }
    if (body.error) return failed(apiErrorReason(body.error, key));

    const meanings = standardMeanings(word, asArray(body.channel?.item));
    const answer: LookupResult =
      meanings.length > 0 ? { status: "found", meanings } : NOT_FOUND;

    if (cache.size >= MAX_CACHED_WORDS) cache.clear();
    cache.set(word, answer);
    return answer;
  };
}
