import { checkWord } from "@/features/wordchain/server";

// 사전 확인 결과는 캐시하지 않는다. 인증 키는 서버에서만 읽고 응답에는 싣지 않는다.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const word = new URL(request.url).searchParams.get("word") ?? "";
  const result = await checkWord(word.trim());
  // 연결 실패는 이유만 서버 로그에 남긴다(인증 키와 요청 주소는 남기지 않는다).
  if (result.status === "failed") {
    console.error(`word-check failed: ${result.reason ?? "unknown"}`);
  }
  return Response.json(result);
}
