import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import Home from "@/app/page";

test("홈 화면은 닉네임을 입력해 끝말잇기를 시작하는 화면을 보여준다", () => {
  render(<Home />);

  expect(screen.getByText("끝말잇기")).toBeInTheDocument();
  expect(screen.getByLabelText("닉네임")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "시작하기" })).toBeInTheDocument();
});
