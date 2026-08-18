/**
 * 将数值收拢到闭区间内。
 * @param value 原始数值。
 * @param min 区间下界。
 * @param max 区间上界。
 * @returns 落在 [min, max] 内的数值。
 */
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
