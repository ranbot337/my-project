# 사전 확인이 거부되면 확인 중 상태에 머무름

- 증상: `WordChainApp`에 넘긴 `lookupWord`가 결과를 돌려주지 않고 예외로 끝나면 게임이 확인 중 상태로 남고, 입력이 막히고 시간이 멈춥니다. "게임 다시 하기"만 동작합니다.
- 근거: 코드 리뷰(low)가 `features/wordchain/word-chain-app.tsx`의 `lookupWord(...).then(...)`에 거부 처리가 없다고 지적했습니다. 기본 구현(`lookup-client.ts`)은 예외를 모두 잡아 `failed`로 돌려주므로 일반 사용에서는 재현되지 않습니다.
- 제안: 거부되면 `{ status: "failed" }`로 처리해서 `resolveLookup`에 넘깁니다.
