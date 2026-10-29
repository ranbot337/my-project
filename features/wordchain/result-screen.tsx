import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { EndedBy, Game } from "./game";
import type { WinLossRecord } from "./records";

type Props = {
  nickname: string;
  record: WinLossRecord;
  game: Game;
  onRestart: () => void;
};

const TITLES: Record<string, string> = {
  won: "내가 이겼어요!",
  lost: "AI가 이겼어요",
  abandoned: "게임을 그만뒀어요",
};

const REASONS: Record<EndedBy, string> = {
  chances: "기회를 모두 써서 이을 단어를 찾지 못했어요.",
  "child-dead-end": "끝장단어를 냈어요. AI가 이을 수 있는 단어가 없어요.",
  "ai-dead-end": "AI가 끝장단어를 냈어요. 이을 수 있는 단어가 없어요.",
  "gave-up": "승패 없이 끝났어요. 승패 기록은 그대로예요.",
};

export function ResultScreen({ nickname, record, game, onRestart }: Props) {
  const aiWinningTurn =
    game.endedBy === "ai-dead-end" ? game.turns.at(-1) : undefined;

  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle className="font-heading text-3xl">
          {TITLES[game.status]}
        </CardTitle>
        <CardDescription className="text-lg">
          {game.endedBy ? REASONS[game.endedBy] : null}
        </CardDescription>
        <p className="flex items-center gap-3 text-lg font-medium">
          <span>{nickname}</span>
          <Badge variant="secondary" className="text-base">
            {record.wins}승 {record.losses}패
          </Badge>
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold">이번 판에 나온 단어</h2>
        {game.turns.length === 0 ? (
          <p className="text-lg text-muted-foreground">
            아직 나온 단어가 없어요.
          </p>
        ) : (
          <ol className="flex flex-col gap-5">
            {game.turns.map((turn) => (
              <li
                key={turn.entry.word}
                className="flex items-start gap-4"
                data-testid="result-word"
              >
                <span className="text-4xl" aria-hidden="true">
                  {turn.entry.emoji}
                </span>
                <div className="flex flex-col gap-1">
                  <p className="flex flex-wrap items-center gap-2 text-xl font-semibold">
                    {turn.entry.word}
                    <Badge variant={turn.by === "ai" ? "secondary" : "outline"}>
                      {turn.by === "ai" ? "AI" : "나"}
                    </Badge>
                    {turn === aiWinningTurn ? (
                      <Badge variant="destructive">AI가 이긴 단어</Badge>
                    ) : null}
                  </p>
                  {turn.entry.meanings && turn.entry.meanings.length > 1 ? (
                    <ol className="flex flex-col gap-1 text-lg leading-relaxed">
                      {turn.entry.meanings.map((meaning, meaningIndex) => (
                        <li key={meaningIndex} className="flex gap-2">
                          <span aria-hidden="true">{meaningIndex + 1}.</span>
                          <span>{meaning}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-lg leading-relaxed">
                      {turn.entry.meaning}
                    </p>
                  )}
                  {turn.entry.example ? (
                    <p className="text-base leading-relaxed text-muted-foreground">
                      {turn.entry.example}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
      <CardFooter>
        <Button
          type="button"
          size="lg"
          className="h-14 text-lg"
          onClick={onRestart}
        >
          새 판 시작
        </Button>
      </CardFooter>
    </Card>
  );
}
