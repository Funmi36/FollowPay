export type Tone = 1 | 2 | 3;
/** 0 = not yet due, 1–3 = first / second / final reminder */
export type Stage = 0 | 1 | 2 | 3;
export type PaymentStatus = "unpaid" | "partial" | "paid";

export const CURRENCIES = ["USD", "EUR", "GBP", "NGN", "CAD", "AUD", "INR", "ZAR", "KES"] as const;
export const TONE_NAMES: Record<Tone, string> = { 1: "Friendly", 2: "Direct", 3: "Firm" };

/** Raw form values, exactly as typed. */
export interface InvoiceForm {
  sender: string;
  client: string;
  invoiceNo: string;
  amount: string;
  currency: string;
  due: string; // yyyy-mm-dd
  status: PaymentStatus;
  paid: string;
  reminders: string;
  clientEmail: string;
  history: string;
  paymentDetails: string;
}

export interface SavedInvoice extends InvoiceForm {
  id: string;
}

/** Form values converted to numbers and trimmed. */
export interface ParsedInvoice {
  sender: string;
  client: string;
  invoiceNo: string;
  amount: number;
  paid: number;
  balance: number;
  currency: string;
  due: string;
  status: PaymentStatus;
  reminders: number;
  clientEmail: string;
  history: string;
  paymentDetails: string;
}

/** Body sent from the browser to POST /api/generate. */
export interface GenerateRequest {
  tone: Tone;
  sender: string;
  client: string;
  invoiceNo: string;
  amountText: string;
  dueText: string;
  timing: string;
  reminders: number;
  paymentDetails: string;
  history: string;
}

export interface GenerateResponse {
  subject: string;
  message: string;
  source: "gemma";
  model: string;
}

export const emptyForm: InvoiceForm = {
  sender: "",
  client: "",
  invoiceNo: "",
  amount: "",
  currency: "USD",
  due: "",
  status: "unpaid",
  paid: "",
  reminders: "0",
  clientEmail: "",
  history: "",
  paymentDetails: "",
};

export function parseForm(f: InvoiceForm): ParsedInvoice {
  const amount = parseFloat(f.amount) || 0;
  const paid = f.status === "partial" ? parseFloat(f.paid) || 0 : 0;
  return {
    sender: f.sender.trim(),
    client: f.client.trim(),
    invoiceNo: f.invoiceNo.trim(),
    amount,
    paid,
    balance: Math.max(0, amount - paid),
    currency: f.currency,
    due: f.due,
    status: f.status,
    reminders: Math.max(0, parseInt(f.reminders, 10) || 0),
    clientEmail: f.clientEmail.trim(),
    history: f.history.trim(),
    paymentDetails: f.paymentDetails.trim(),
  };
}

export function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function dateText(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Whole days past the due date (negative = not yet due). */
export function daysOverdue(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - new Date(`${iso}T00:00:00`).getTime()) / 864e5);
}

/** Pick the stage from days overdue and reminders already sent; the more severe signal wins. */
export function stageFor(reminders: number, days: number): Stage {
  if (days <= 0) return 0;
  const byDays: Tone = days > 30 ? 3 : days > 14 ? 2 : 1;
  const byCount: Tone = reminders >= 2 ? 3 : reminders >= 1 ? 2 : 1;
  return Math.max(byDays, byCount) as Stage;
}

export function timing(days: number): string {
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} overdue`;
  if (days === 0) return "due today";
  return `due in ${-days} day${days === -1 ? "" : "s"}`;
}

/** Built-in fallback emails, used when the model is unavailable. */
export function template(d: ParsedInvoice, tone: Tone, days: number): { subject: string; message: string } {
  const ref = d.invoiceNo ? `invoice ${d.invoiceNo}` : "my invoice";
  const amt = money(d.balance, d.currency);
  const due = dateText(d.due);
  const late = timing(days);
  const pay = d.paymentDetails ? `\n\nPayment details:\n${d.paymentDetails}` : "";
  const sign = `\n\n${d.sender ? `Best regards,\n${d.sender}` : "Best regards"}`;
  const hi = `Hi ${d.client.split(" ")[0]},`;

  if (tone === 1) {
    return {
      subject: `Friendly reminder: ${ref} (${amt})`,
      message: `${hi}\n\nI hope you're doing well! Just a quick note that ${ref} for ${amt} ${days > 0 ? "was" : "is"} due on ${due}${days > 0 ? ` and is ${late}` : ""}. I know things get buried, so I wanted to make sure it didn't slip through.\n\nIf it's already on its way, thank you, and please ignore this. If you need anything from me to process it, just say the word.${pay}${sign}`,
    };
  }
  if (tone === 2) {
    return {
      subject: `Overdue: ${ref}, ${amt}`,
      message: `${hi}\n\nFollowing up on my earlier message: ${ref} for ${amt} was due on ${due} and is now ${late}. I haven't yet received payment or an update.\n\nPlease arrange payment within the next 5 business days, or reply with the date it will be paid. If there's an issue with the invoice, let me know today so we can fix it.${pay}${sign}`,
    };
  }
  return {
    subject: `Final notice: ${ref}, ${amt} ${late}`,
    message: `${hi}\n\nThis is a final reminder that ${ref} for ${amt}, due on ${due}, remains unpaid and is now ${late}. Previous reminders have not resulted in payment.\n\nPlease settle the full balance within 7 days of this email. If it is not resolved by then, I will have to pause any ongoing work and may apply late fees or pursue further steps to recover the amount. I would much prefer to resolve this directly, so please contact me right away.${pay}${sign}`,
  };
}
