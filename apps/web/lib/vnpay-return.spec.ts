import { describe, expect, it } from "vitest";
import {
  classifyVnPayReturnError,
  VnPayDisplayState,
  VnPayReturnResponse,
} from "./vnpay-return";

describe("VNPAY return display states", () => {
  it.each<VnPayReturnResponse["state"]>([
    "SUCCESS",
    "FAILED",
    "CANCELLED",
    "PENDING",
  ])("preserves the backend-verified %s state", (state) => {
    const response: VnPayReturnResponse = { state };
    expect(response.state).toBe(state);
  });

  it("maps a missing payment API response to NOT_FOUND", () => {
    expect(
      classifyVnPayReturnError("Không tìm thấy giao dịch thanh toán."),
    ).toBe("NOT_FOUND" satisfies VnPayDisplayState);
  });

  it("does not misclassify other verification errors as missing orders", () => {
    expect(classifyVnPayReturnError("Chữ ký không hợp lệ.")).toBe("FAILED");
  });
});
