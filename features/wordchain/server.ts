// 서버에서만 불러오는 공개 API. 브라우저 쪽 코드는 이 파일을 가져오지 않는다.
import { createWordChecker } from "./dictionary";

export { createWordChecker };

// 서버가 켜져 있는 동안 확인 결과를 기억하는 기본 확인기.
export const checkWord = createWordChecker();
