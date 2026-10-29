# 손상된 승패 기록 JSON 처리

- 증상: localStorage `wordchain:records` 값이 `null`이나 숫자처럼 객체가 아니면 `loadRecord`가 예외를 던진다.
- 근거: 코드 리뷰(low)가 `features/wordchain/records.ts`의 `readAll`에서 지적했다. 일반 사용에서는 재현하지 못했다.
- 제안: 파싱 결과가 객체가 아니면 빈 객체를 돌려준다.
