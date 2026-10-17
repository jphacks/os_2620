import { describe, expect, it } from "vitest";
import { assertCanConsume, calculateShortage, convertQuantity, receiptSchema, riskScore, type InventoryLot } from "@/lib/domain";

const lot: InventoryLot = { id:"1",name:"米",category:"主食",quantity:1.2,unit:"kg",storage:"常温",expiresIn:3,expiryType:"賞味期限",opened:true,price:500 };
describe("quantity safety", () => {
  it("converts only compatible units", () => { expect(convertQuantity(1,"kg","g")).toBe(1000); expect(convertQuantity(1,"個","g")).toBeNull(); });
  it("calculates shortage after stock", () => { expect(calculateShortage({name:"米",quantity:1500,unit:"g"},[lot])).toBe(300); });
  it("rejects over-consumption", () => { expect(()=>assertCanConsume(100,101)).toThrow("在庫量"); expect(assertCanConsume(100,40)).toBe(60); });
});
describe("receipt validation", () => {
  it("rejects guessed/invalid data shapes", () => { expect(receiptSchema.safeParse({storeName:null,purchasedAt:null,total:null,items:[{name:"卵",normalizedName:"卵",quantity:-1,unit:"個",price:100,category:"ingredient",confidence:1}],warnings:[]}).success).toBe(false); });
});
describe("waste scoring", () => {
  it("prioritizes nearer expiration", () => { expect(riskScore({...lot,expiresIn:1})).toBeGreaterThan(riskScore({...lot,expiresIn:8})); });
  it("never recommends expired lots", () => { expect(riskScore({...lot,expiresIn:-1})).toBe(-1); });
});
