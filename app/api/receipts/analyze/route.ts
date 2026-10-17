import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { receiptSchema } from "@/lib/domain";

export const runtime = "edge";
const MAX_BYTES = 10 * 1024 * 1024;
const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!key || !model) return NextResponse.json({ error: "Gemini is not configured", code: "AI_UNAVAILABLE" }, { status: 503 });
  const data = await request.formData();
  const image = data.get("image");
  if (!(image instanceof File) || !allowed.has(image.type) || image.size > MAX_BYTES) {
    return NextResponse.json({ error: "JPEG・PNG・WebP（10MB以下）を選択してください" }, { status: 400 });
  }
  const bytes = new Uint8Array(await image.arrayBuffer());
  const base64 = btoa(Array.from(bytes, b => String.fromCharCode(b)).join(""));
  const ai = new GoogleGenAI({ apiKey: key });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const result = await ai.models.generateContent({
      model,
      contents: [{ inlineData: { mimeType: image.type, data: base64 } }, { text: "日本語の購入レシートを読み取ってください。不明な値はnull、商品カテゴリが不明ならunknown。期限を推測しないでください。" }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object", required: ["storeName", "purchasedAt", "total", "items", "warnings"],
          properties: {
            storeName: { type: ["string", "null"] }, purchasedAt: { type: ["string", "null"] }, total: { type: ["integer", "null"] },
            warnings: { type: "array", items: { type: "string" } },
            items: { type: "array", items: { type: "object", required: ["name","normalizedName","quantity","unit","price","category","confidence"], properties: {
              name:{type:"string"}, normalizedName:{type:"string"}, quantity:{type:"number"}, unit:{type:"string",enum:["g","kg","ml","L","個","本","袋","枚","パック"]}, price:{type:["integer","null"]}, category:{type:"string",enum:["ingredient","seasoning","daily_goods","unknown"]}, confidence:{type:"number"}
            } } }
          }
        }
      }
    });
    if (!result.text) throw new Error("EMPTY_RESULT");
    const parsed = receiptSchema.safeParse(JSON.parse(result.text));
    if (!parsed.success) return NextResponse.json({ error: "解析結果を安全に検証できませんでした", details: parsed.error.flatten() }, { status: 422 });
    const itemTotal = parsed.data.items.reduce((sum, item) => sum + (item.price ?? 0), 0);
    const mismatch = parsed.data.total !== null && parsed.data.items.every(i => i.price !== null) && itemTotal !== parsed.data.total;
    return NextResponse.json({ ...parsed.data, mismatch, contentHash: await sha256(bytes) });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "解析がタイムアウトしました" : "レシートを解析できませんでした";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally { clearTimeout(timeout); }
}

async function sha256(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,"0")).join("");
}
