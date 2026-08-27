export type VnPayDisplayState =
  "SUCCESS" | "FAILED" | "CANCELLED" | "PENDING" | "NOT_FOUND";

export interface VnPayReturnResponse {
  state: Exclude<VnPayDisplayState, "NOT_FOUND">;
  paymentId?: string;
  orderId?: string;
  message?: string;
}

export function classifyVnPayReturnError(message: string): VnPayDisplayState {
  return message.toLocaleLowerCase("vi").includes("không tìm thấy")
    ? "NOT_FOUND"
    : "FAILED";
}
