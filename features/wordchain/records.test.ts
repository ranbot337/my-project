import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  loadRecord,
  normalizeNickname,
  recordResult,
  lastNickname,
  rememberNickname,
} from "@/features/wordchain";

beforeEach(() => {
  localStorage.clear();
});

describe("닉네임", () => {
  test("앞뒤 공백을 뺀 1자 이상 8자 이하만 받아들인다", () => {
    expect(normalizeNickname("하늘")).toBe("하늘");
    expect(normalizeNickname("  하늘  ")).toBe("하늘");
    expect(normalizeNickname("여덟글자닉네임이")).toBe("여덟글자닉네임이");
  });

  test("비었거나 공백뿐이거나 9자 이상이면 받아들이지 않는다", () => {
    expect(normalizeNickname("")).toBeNull();
    expect(normalizeNickname("   ")).toBeNull();
    expect(normalizeNickname("아홉글자닉네임이다")).toBeNull();
  });
});

describe("승패 기록", () => {
  test("처음 쓰는 닉네임은 0승 0패다", () => {
    expect(loadRecord("하늘")).toEqual({ wins: 0, losses: 0 });
  });

  test("같은 닉네임으로 승패가 누적된다", () => {
    recordResult("하늘", "win");
    recordResult("하늘", "loss");
    recordResult("하늘", "win");

    expect(loadRecord("하늘")).toEqual({ wins: 2, losses: 1 });
  });

  test("앞뒤 공백이 달라도 같은 닉네임으로 이어진다", () => {
    recordResult("하늘", "win");

    expect(loadRecord(" 하늘 ")).toEqual({ wins: 1, losses: 0 });
  });

  test("다른 닉네임은 기록이 따로다", () => {
    recordResult("하늘", "win");

    expect(loadRecord("바다")).toEqual({ wins: 0, losses: 0 });
  });

  test("기록은 저장소에서 다시 읽어도 남아 있다", () => {
    recordResult("하늘", "loss");
    vi.resetModules();

    expect(loadRecord("하늘")).toEqual({ wins: 0, losses: 1 });
  });

  test("저장소를 쓸 수 없어도 오류 없이 0승 0패로 동작한다", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };

    try {
      expect(loadRecord("하늘")).toEqual({ wins: 0, losses: 0 });
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});

describe("마지막 닉네임", () => {
  test("마지막으로 쓴 닉네임을 기억한다", () => {
    expect(lastNickname()).toBe("");

    rememberNickname("하늘");
    rememberNickname(" 바다 ");

    expect(lastNickname()).toBe("바다");
  });
});
