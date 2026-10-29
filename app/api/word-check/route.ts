import { checkWord } from "@/features/wordchain/server";

// 사전 확인 결과는 캐시하지 않는다. 인증 키는 서버에서만 읽고 응답에는 싣지 않는다.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const word = new URL(request.url).searchParams.get("word") ?? "";
  return Response.json(await checkWord(word.trim()));
}
