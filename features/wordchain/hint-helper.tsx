import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { hintList, type Game } from "./game";

type Props = {
  game: Game;
  onClose: () => void;
  onUseWord: (word: string) => void;
};

// 아이 차례마다 새로 만들어져(key) 고른 단어가 초기화된다.
export function HintHelper({ game, onClose, onUseWord }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const { letters, items } = hintList(game);
  const current = items.find((item) => item.entry.word === selected)?.entry;

  return (
    <aside aria-label="힌트 도우미">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <CardTitle className="font-heading text-2xl">힌트 도우미</CardTitle>
            <p className="text-lg text-muted-foreground">
              남은 힌트 {game.hintsLeft}번
            </p>
          </div>
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            닫기
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <p className="text-xl font-medium">
            {letters.map((letter) => `'${letter}'`).join(" 또는 ")}로 시작
          </p>

          {items.length === 0 ? (
            <p className="text-lg text-muted-foreground">
              이을 수 있는 단어가 단어장에 없어요
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map(({ entry, deadEnd }) => (
                <li key={entry.word}>
                  <Button
                    type="button"
                    variant={entry.word === selected ? "secondary" : "outline"}
                    onClick={() => setSelected(entry.word)}
                    className="h-14 w-full justify-start gap-3 px-4 text-xl"
                  >
                    <span aria-hidden="true" className="text-2xl">
                      {entry.emoji}
                    </span>
                    <span>{entry.word}</span>
                    {deadEnd ? (
                      <Badge variant="destructive" className="ml-auto text-base">
                        🔥 끝장단어
                      </Badge>
                    ) : null}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {current ? (
            <Card size="sm">
              <CardContent className="flex flex-col gap-3">
                <p className="flex items-center gap-3 text-2xl font-semibold">
                  <span aria-hidden="true">{current.emoji}</span>
                  {current.word}
                </p>
                <p className="text-xl leading-relaxed">뜻: {current.meaning}</p>
                <p className="text-lg leading-relaxed text-muted-foreground">
                  예문: {current.example}
                </p>
                <Button
                  type="button"
                  size="lg"
                  className="h-12 text-lg"
                  onClick={() => onUseWord(current.word)}
                >
                  이 단어 쓰기
                </Button>
              </CardContent>
            </Card>
          ) : (
            items.length > 0 && (
              <p className="text-lg text-muted-foreground">
                단어를 눌러 뜻을 보세요
              </p>
            )
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
