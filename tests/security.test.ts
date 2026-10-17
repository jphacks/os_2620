import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("../supabase/migrations/202610170001_initial.sql", import.meta.url), "utf8");
describe("database boundaries", () => {
  it("enables RLS for every user-owned table", () => {
    for (const table of ["profiles","user_preferences","receipts","receipt_items","inventory_lots","inventory_movements","recipes","cooking_history","shopping_lists","shopping_list_items","food_waste_events","notifications"])
      expect(sql).toContain(`alter table public.${table} enable row level security`);
  });
  it("makes receipt hashes unique per user", () => expect(sql).toContain("unique(user_id, content_hash)"));
  it("uses idempotency and row locks for cooking", () => { expect(sql).toContain("unique(user_id,idempotency_key)"); expect(sql).toContain("for update"); });
});
