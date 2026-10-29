import type { LookupResult } from "./game";

const FAILED: LookupResult = { status: "failed" };
// 서버가 사전을 기다리는 5초보다 조금 더 기다린다.
const REQUEST_TIMEOUT_MS = 7000;

// 이 앱의 서버 경로로 단어를 확인한다. 사전 서버를 직접 부르지 않는다.
export async function lookupWord(word: string): Promise<LookupResult> {
  try {
    const response = await fetch(
      `/api/word-check?word=${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store" }
    );
    if (!response.ok) return FAILED;

    const body = await response.json();
    if (body?.status === "not-found") return { status: "not-found" };
    if (body?.status === "found" && typeof body.meaning === "string") {
      return { status: "found", meaning: body.meaning };
    }
    return FAILED;
  } catch {
    return FAILED;
  }
}
