import { z } from "zod";

export const units = ["g", "kg", "ml", "L", "個", "本", "袋", "枚", "パック"] as const;
export type Unit = (typeof units)[number];
export const receiptItemSchema = z.object({
  name: z.string().min(1).max(80), normalizedName: z.string().min(1).max(80),
  quantity: z.number().positive(), unit: z.enum(units), price: z.number().int().nonnegative().nullable(),
  category: z.enum(["ingredient", "seasoning", "daily_goods", "unknown"]), confidence: z.number().min(0).max(1),
});
export const receiptSchema = z.object({
  storeName: z.string().max(120).nullable(), purchasedAt: z.string().date().nullable(),
  total: z.number().int().nonnegative().nullable(), items: z.array(receiptItemSchema).max(100),
  warnings: z.array(z.string().max(200)).max(20),
});
export type InventoryLot = {
  id: string; name: string; category: string; quantity: number; unit: Unit;
  storage: "冷蔵" | "冷凍" | "常温"; expiresIn: number | null;
  expiryType: "消費期限" | "賞味期限" | "未設定"; opened: boolean; price: number;
};
export type RecipeNeed = { name: string; quantity: number; unit: Unit };
const mass: Partial<Record<Unit, number>> = { g: 1, kg: 1000 };
const volume: Partial<Record<Unit, number>> = { ml: 1, L: 1000 };
export function convertQuantity(value: number, from: Unit, to: Unit): number | null {
  if (from === to) return value;
  if (mass[from] && mass[to]) return value * mass[from]! / mass[to]!;
  if (volume[from] && volume[to]) return value * volume[from]! / volume[to]!;
  return null;
}
export function calculateShortage(need: RecipeNeed, lots: InventoryLot[]) {
  const available = lots.filter(l => l.name === need.name).reduce((sum, lot) => {
    const converted = convertQuantity(lot.quantity, lot.unit, need.unit);
    return sum + (converted ?? 0);
  }, 0);
  return Math.max(0, Number((need.quantity - available).toFixed(2)));
}
export function riskScore(lot: InventoryLot, dailyUse = 40): number {
  if (lot.expiresIn === null || lot.expiresIn < 0) return lot.expiresIn === null ? 0 : -1;
  const urgency = Math.max(0, 55 - lot.expiresIn * 12);
  const surplus = Math.min(30, Math.max(0, lot.quantity / Math.max(1, dailyUse) - lot.expiresIn) * 8);
  return Math.min(100, Math.round(urgency + surplus + (lot.opened ? 12 : 0)));
}
export function assertCanConsume(available: number, requested: number) {
  if (!Number.isFinite(requested) || requested <= 0) throw new Error("使用量は0より大きい数値を指定してください");
  if (requested > available) throw new Error("在庫量を超えて使用できません");
  return available - requested;
}
