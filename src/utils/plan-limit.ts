export const PLAN_LIMIT_ERROR_CODE = "PLAN_LIMIT_REACHED";

export function isPlanLimitError(payload: any) {
  return payload?.code === PLAN_LIMIT_ERROR_CODE;
}
