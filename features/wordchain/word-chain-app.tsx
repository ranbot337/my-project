"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  createGame,
  giveUp,
  playAiTurn,
  resolveLookup,
  submitWord,
  timeOut,
  type Game,
  type LookupResult,
} from "./game";
import { GameScreen } from "./game-screen";
import { lookupWord as defaultLookupWord } from "./lookup-client";
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

type Props = {
  words?: WordEntry[];
  lookupWord?: (word: string) => Promise<LookupResult>;
};

const isFinished = (game: Game) =>
  game.status === "won" ||
  game.status === "lost" ||
  game.status === "abandoned";

// 판이 막 끝났을 때만 승패를 한 번 기록한다.
function nextSession(session: Session, next: Game): Session {
  let record = session.record;
  if (isFinished(next) && !isFinished(session.game)) {
    if (next.status === "won") record = recordResult(session.nickname, "win");
    if (next.status === "lost") record = recordResult(session.nickname, "loss");
  }
  return { ...session, game: next, record };
}

const subscribeNothing = () => () => {};

export function WordChainApp({
  words,
  lookupWord = defaultLookupWord,
}: Props) {
  const [session, setSession] = useState<Session | null>(null);
  // 사전 확인처럼 나중에 돌아오는 결과가 가장 최근 상태를 보도록 같이 둔다.
  const latest = useRef<Session | null>(null);
  // 저장된 닉네임은 브라우저에서만 읽을 수 있어서, 서버 렌더링 때는 빈 값으로 둔다.
  const savedNickname = useSyncExternalStore(
    subscribeNothing,
    lastNickname,
    () => ""
  );

  function apply(next: Session) {
    latest.current = next;
    setSession(next);
  }

  useEffect(() => {
    if (!session || session.game.status !== "ai-turn") return;
    const id = setTimeout(
      () =>
        apply(
          nextSession(session, playAiTurn(session.game, Math.random))
        ),
      AI_DELAY_MS
    );
    return () => clearTimeout(id);
  }, [session]);

  function start(nickname: string) {
    rememberNickname(nickname);
    apply({
      nickname,
      record: loadRecord(nickname),
      game: createGame(words),
    });
  }

  function submit(current: Session, input: string) {
    const next = submitWord(current.game, input);
    apply(nextSession(current, next));

    if (next.status !== "checking" || next.pending === null) return;
    const word = next.pending;
    void lookupWord(word).then((result) => {
      const now = latest.current;
      // 그 사이 판이 끝났거나 다른 단어를 기다리는 중이면 늦게 온 결과는 버린다.
      if (!now || now.game.status !== "checking") return;
      if (now.game.pending !== word) return;
      apply(nextSession(now, resolveLookup(now.game, result)));
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
        onRestart={() => apply({ ...session, game: createGame(words) })}
      />
    );
  } else {
    screen = (
      <GameScreen
        nickname={session.nickname}
        record={session.record}
        game={session.game}
        onSubmit={(input) => submit(session, input)}
        onTimeout={() =>
          apply(nextSession(session, timeOut(session.game)))
        }
        onGiveUp={() => apply(nextSession(session, giveUp(session.game)))}
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10 sm:py-14">
      {screen}
      <footer className="text-sm leading-relaxed text-muted-foreground">
        사전 뜻풀이 출처:{" "}
        <a
          href="https://stdict.korean.go.kr/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          국립국어원 표준국어대사전
        </a>{" "}
        (
        <a
          href="https://creativecommons.org/licenses/by-sa/2.0/kr/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          CC BY-SA 2.0 KR
        </a>
        )
      </footer>
    </main>
  );
}
