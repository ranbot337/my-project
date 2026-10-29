export {
  AI_DEAD_END_RATE,
  CHANCES_PER_TURN,
  TURN_SECONDS,
  createGame,
  giveUp,
  playAiTurn,
  submitWord,
  timeOut,
} from "./game";
export type { DueumHint, EndedBy, Game, GameStatus, Turn } from "./game";
export type { WordEntry } from "./words";
export {
  lastNickname,
  loadRecord,
  normalizeNickname,
  recordResult,
  rememberNickname,
} from "./records";
export type { Result, WinLossRecord } from "./records";
export { WORDS } from "./words";
export { WordChainApp } from "./word-chain-app";
