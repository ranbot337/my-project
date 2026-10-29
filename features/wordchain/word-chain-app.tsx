"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import {
  createGame,
  giveUp,
  playAiTurn,
  submitWord,
  timeOut,
  type Game,
} from "./game";
import { GameScreen } from "./game-screen";
import { NicknameForm } from "./nickname-form";
import {
  lastNickname,
  loadRecord,
  recordResult,
  rememberNickname,
  type WinLossRecord,
} from "./records";
import { ResultScreen } from "./result-screen";
import type { WordEntry } from "./words";

// AI가 단어를 내기 전에 아이가 방금 낸 단어의 뜻을 볼 수 있게 두는 간격.
const AI_DELAY_MS = 1500;

type Session = { nickname: string; record: WinLossRecord; game: Game };
type SetSession = (session: Session) => void;

const isFinished = (game: Game) =>
  game.status === "won" ||
  game.status === "lost" ||
  game.status === "abandoned";

// 판이 막 끝났을 때만 승패를 한 번 기록한다.
function advance(session: Session, next: Game, setSession: SetSession) {
  let record = session.record;
  if (isFinished(next) && !isFinished(session.game)) {
    if (next.status === "won") record = recordResult(session.nickname, "win");
    if (next.status === "lost") record = recordResult(session.nickname, "loss");
  }
  setSession({ ...session, game: next, record });
}

const subscribeNothing = () => () => {};

export function WordChainApp({ words }: { words?: WordEntry[] }) {
  const [session, setSession] = useState<Session | null>(null);
  // 저장된 닉네임은 브라우저에서만 읽을 수 있어서, 서버 렌더링 때는 빈 값으로 둔다.
  const savedNickname = useSyncExternalStore(
    subscribeNothing,
    lastNickname,
    () => ""
  );

  useEffect(() => {
    if (!session || session.game.status !== "ai-turn") return;
    const id = setTimeout(
      () =>
        advance(session, playAiTurn(session.game, Math.random), setSession),
      AI_DELAY_MS
    );
    return () => clearTimeout(id);
  }, [session]);

  function start(nickname: string) {
    rememberNickname(nickname);
    setSession({
      nickname,
      record: loadRecord(nickname),
      game: createGame(words),
    });
  }

  let screen;
  if (!session) {
    screen = (
      <NicknameForm
        key={savedNickname}
        initialNickname={savedNickname}
        onStart={start}
      />
    );
  } else if (isFinished(session.game)) {
    screen = (
      <ResultScreen
        nickname={session.nickname}
        record={session.record}
        game={session.game}
        onRestart={() =>
          setSession({ ...session, game: createGame(words) })
        }
      />
    );
  } else {
    screen = (
      <GameScreen
        nickname={session.nickname}
        record={session.record}
        game={session.game}
        onSubmit={(input) =>
          advance(session, submitWord(session.game, input), setSession)
        }
        onTimeout={() => advance(session, timeOut(session.game), setSession)}
        onGiveUp={() => advance(session, giveUp(session.game), setSession)}
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10 sm:py-14">
      {screen}
    </main>
  );
}
