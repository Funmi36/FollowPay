import { NextResponse } from "next/server";
import { buildPrompt, callGemma, ModelError, parseOutput } from "@/lib/gemma";
import type { GenerateRequest, GenerateResponse, Tone } from "@/lib/invoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const clip = (v: unknown, max: number): string => String(v ?? "").slice(0, max).trim();
const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) return fail("No GEMINI_API_KEY set on the server.", 503);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const toneNum = Number(body.tone);
  const input: GenerateRequest = {
    tone: ([1, 2, 3].includes(toneNum) ? toneNum : 1) as Tone,
    sender: clip(body.sender, 80),
    client: clip(body.client, 80),
    invoiceNo: clip(body.invoiceNo, 40),
    amountText: clip(body.amountText, 40),
    dueText: clip(body.dueText, 40),
    timing: clip(body.timing, 80),
    reminders: Math.max(0, Math.min(20, parseInt(String(body.reminders), 10) || 0)),
    paymentDetails: clip(body.paymentDetails, 300),
    history: clip(body.history, 2500),
  };
  if (!input.client || !input.amountText) return fail("Client name and amount are required.", 400);

  const model = process.env.GEMMA_MODEL || "gemma-3-27b-it";
  try {
    const text = await callGemma(buildPrompt(input), apiKey, model);
    const result: GenerateResponse = { ...parseOutput(text), source: "gemma", model };
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ModelError) return fail(e.message, e.status);
    return fail("Unexpected server error.", 500);
  }
}
