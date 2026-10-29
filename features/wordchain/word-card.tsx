import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import type { Turn } from "./game";

export function WordCard({ turn }: { turn: Turn }) {
  const { entry, by } = turn;

  return (
    <Card aria-live="polite" data-testid="word-card">
      <CardContent className="flex flex-col items-center gap-5 py-4 text-center">
        <span className="text-7xl" aria-hidden="true">
          {entry.emoji}
        </span>
        <Badge variant={by === "ai" ? "secondary" : "default"}>
          {by === "ai" ? "AI가 냈어요" : "내가 냈어요"}
        </Badge>
        <p className="font-heading text-4xl font-semibold tracking-tight">
          {entry.word}
        </p>
        <p className="text-xl leading-relaxed text-balance">
          뜻: {entry.meaning}
        </p>
        {entry.example ? (
          <p className="text-lg leading-relaxed text-balance text-muted-foreground">
            예문: {entry.example}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
