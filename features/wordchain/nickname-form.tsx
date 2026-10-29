import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { normalizeNickname } from "./records";

type Props = {
  initialNickname: string;
  onStart: (nickname: string) => void;
};

export function NicknameForm({ initialNickname, onStart }: Props) {
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("nickname");
    const nickname = normalizeNickname(typeof value === "string" ? value : "");

    if (!nickname) {
      setError("닉네임은 1자 이상 8자 이하로 써 주세요");
      return;
    }
    setError(null);
    onStart(nickname);
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle className="font-heading text-3xl">끝말잇기</CardTitle>
        <CardDescription className="text-base">
          AI와 끝말잇기를 하면서 새로운 낱말과 그 뜻을 알아 가요.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup className="gap-6">
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="nickname" className="text-lg">
                닉네임
              </FieldLabel>
              <Input
                id="nickname"
                name="nickname"
                autoComplete="off"
                defaultValue={initialNickname}
                aria-invalid={error ? true : undefined}
                className="h-14 text-xl md:text-xl"
              />
              <FieldDescription className="text-base">
                실명은 쓰지 마세요. 같은 닉네임으로 다시 시작하면 승패가 이어서
                쌓여요.
              </FieldDescription>
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
            <Button type="submit" size="lg" className="h-14 text-lg">
              시작하기
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
