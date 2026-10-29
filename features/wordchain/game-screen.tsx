import { useEffect, useRef, useState, type FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { CHANCES_PER_TURN, TURN_SECONDS, type Game } from "./game";
import type { WinLossRecord } from "./records";
import { WordCard } from "./word-card";

type Props = {
  nickname: string;
  record: WinLossRecord;
  game: Game;
  onSubmit: (input: string) => void;
  onTimeout: () => void;
  onGiveUp: () => void;
};

// 아이 차례가 시작될 때마다 새로 만들어져(key) 30초부터 센다. 0초가 되면 알리고 다시 시작한다.
// 사전을 확인하는 동안(paused)에는 멈췄다가 이어서 센다.
function TurnTimer({
  paused,
  onExpire,
}: {
  paused: boolean;
  onExpire: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(TURN_SECONDS);
  const leftRef = useRef(TURN_SECONDS);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      leftRef.current -= 1;
      if (leftRef.current <= 0) {
        leftRef.current = TURN_SECONDS;
        setSecondsLeft(TURN_SECONDS);
        onExpireRef.current();
      } else {
        setSecondsLeft(leftRef.current);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [paused]);

  return <span>남은 시간 {secondsLeft}초</span>;
}

export function GameScreen({
  nickname,
  record,
  game,
  onSubmit,
  onTimeout,
  onGiveUp,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const childTurn = game.status === "child-turn";
  const checking = game.status === "checking";
  const lastTurn = game.turns.at(-1);

  useEffect(() => {
    if (childTurn) inputRef.current?.focus();
  }, [childTurn, game.turns.length]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(input);
    setInput("");
  }

  const startLetter = lastTurn ? [...lastTurn.entry.word].at(-1) : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-lg font-medium">
          <span>{nickname}</span>
          <Badge variant="secondary" className="text-base">
            {record.wins}승 {record.losses}패
          </Badge>
        </div>
        <Button type="button" variant="outline" size="lg" onClick={onGiveUp}>
          게임 다시 하기
        </Button>
      </header>

      {game.turns.length > 0 ? (
        <p
          aria-label="지금까지 나온 단어"
          className="text-xl leading-loose text-muted-foreground"
        >
          {game.turns.map((turn) => turn.entry.word).join(" → ")}
        </p>
      ) : null}

      {lastTurn ? (
        <WordCard turn={lastTurn} />
      ) : (
        <p className="py-10 text-center text-2xl text-muted-foreground">
          첫 단어를 입력해 보세요. 아무 글자로나 시작해도 돼요.
        </p>
      )}

      {childTurn && game.hint ? (
        <Alert>
          <AlertTitle className="text-lg">두음법칙 적용 가능!</AlertTitle>
          <AlertDescription className="text-base">
            &apos;{game.hint.from}&apos;로 끝났어요. &apos;{game.hint.to}&apos;로
            시작해도 돼요.
          </AlertDescription>
        </Alert>
      ) : null}

      {game.notice ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="text-lg">{game.notice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xl font-medium">
          {childTurn || checking ? (
            <>
              <p className="text-2xl">
                {startLetter
                  ? `'${startLetter}'로 시작하는 단어`
                  : "아무 글자로나 시작해요"}
              </p>
              <p className="flex items-center gap-4">
                <TurnTimer
                  key={game.turns.length}
                  paused={checking}
                  onExpire={onTimeout}
                />
                <span>
                  기회 {game.chances}번{" "}
                  <span aria-hidden="true" className="tracking-widest">
                    {Array.from({ length: CHANCES_PER_TURN }, (_, index) =>
                      index < game.chances ? "●" : "○"
                    ).join("")}
                  </span>
                </span>
              </p>
            </>
          ) : (
            <p className="text-2xl">AI가 단어를 고르고 있어요…</p>
          )}
        </div>

        {checking ? (
          <p role="status" className="text-xl text-muted-foreground">
            사전에서 확인하고 있어요…
          </p>
        ) : null}

        <form onSubmit={handleSubmit}>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="word" className="sr-only">
                단어 입력
              </FieldLabel>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  id="word"
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={!childTurn}
                  autoComplete="off"
                  placeholder="단어를 입력하세요"
                  className="h-16 flex-1 text-2xl md:text-2xl"
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={!childTurn}
                  className="h-16 px-8 text-xl"
                >
                  입력
                </Button>
              </div>
            </Field>
          </FieldGroup>
        </form>
      </div>
    </div>
  );
}
