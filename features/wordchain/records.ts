const RECORDS_KEY = "wordchain:records";
const LAST_NICKNAME_KEY = "wordchain:last-nickname";
const MAX_NICKNAME_LENGTH = 8;

export type WinLossRecord = { wins: number; losses: number };
export type Result = "win" | "loss";

const EMPTY: WinLossRecord = { wins: 0, losses: 0 };

// 앞뒤 공백을 뺀 1자 이상 8자 이하일 때만 닉네임으로 받아들인다.
export function normalizeNickname(input: string): string | null {
  const nickname = input.trim();
  const length = [...nickname].length;
  if (length < 1 || length > MAX_NICKNAME_LENGTH) return null;
  return nickname;
}

function readAll(): Partial<Record<string, WinLossRecord>> {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function loadRecord(nickname: string): WinLossRecord {
  return readAll()[nickname.trim()] ?? EMPTY;
}

export function recordResult(nickname: string, result: Result): WinLossRecord {
  const key = nickname.trim();
  const all = readAll();
  const current = all[key] ?? EMPTY;
  const next: WinLossRecord =
    result === "win"
      ? { ...current, wins: current.wins + 1 }
      : { ...current, losses: current.losses + 1 };

  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify({ ...all, [key]: next }));
  } catch {
    // 저장소를 쓸 수 없으면 이번 방문에서만 기록이 사라진다.
  }
  return next;
}

export function rememberNickname(nickname: string) {
  try {
    localStorage.setItem(LAST_NICKNAME_KEY, nickname.trim());
  } catch {
    // 미리 채우기는 편의 기능이라 저장 실패는 무시한다.
  }
}

export function lastNickname(): string {
  try {
    return localStorage.getItem(LAST_NICKNAME_KEY) ?? "";
  } catch {
    return "";
  }
}
