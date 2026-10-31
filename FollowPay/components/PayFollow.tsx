"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { signOut } from "next-auth/react";
import {
  CURRENCIES,
  TONE_NAMES,
  dateText,
  daysOverdue,
  emptyForm,
  money,
  parseForm,
  stageFor,
  template,
  timing,
  type GenerateRequest,
  type GenerateResponse,
  type InvoiceForm,
  type SavedInvoice,
  type Stage,
  type Tone,
} from "@/lib/invoice";

const STORAGE_KEY = "payfollow.invoices";
const STAGE_COLOR: Record<Stage, string> = { 0: "var(--s0)", 1: "var(--s1)", 2: "var(--s2)", 3: "var(--s3)" };
const STAGE_HINT = ["Not late yet", "Send a friendly reminder", "Time for a direct follow-up", "Send a final notice"];

function loadSaved(): SavedInvoice[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(v) ? (v as SavedInvoice[]) : [];
  } catch {
    return [];
  }
}
function persist(list: SavedInvoice[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: ignore */
  }
}

interface Note {
  text: string;
  error: boolean;
}

export interface PayFollowUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export default function PayFollow({ user }: { user?: PayFollowUser } = {}) {
  const [form, setForm] = useState<InvoiceForm>(() => ({
    ...emptyForm,
    sender: user?.name ?? emptyForm.sender,
  }));
  const [chosenTone, setChosenTone] = useState<Tone | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState<Note>({ text: "", error: false });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<SavedInvoice[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => setSaved(loadSaved()), []);

  const set = <K extends keyof InvoiceForm>(key: K, value: InvoiceForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // ---- derived state ----
  const inv = parseForm(form);
  const hasDue = form.due !== "";
  const isPaid = form.status === "paid";
  const complete = hasDue && inv.amount > 0 && !isPaid;
  const ready = complete && inv.client !== "";
  const days = hasDue ? daysOverdue(form.due) : 0;
  const stage: Stage = complete ? stageFor(inv.reminders, days) : 0;
  const suggested = Math.max(1, stage) as Tone;
  const tone: Tone = chosenTone ?? suggested;

  let stampBig = "Add a due date";
  let stampSmall = "and amount to see the status";
  if (isPaid) {
    stampBig = "Paid";
    stampSmall = "Nothing to chase";
  } else if (complete) {
    stampBig = stage === 0 ? (days === 0 ? "Due today" : `Due in ${-days} day${days === -1 ? "" : "s"}`) : `${days} day${days === 1 ? "" : "s"} overdue`;
    stampSmall = STAGE_HINT[stage];
  }

  // Show a built-in template as soon as the form is complete, so the page is useful before the model is called.
  useEffect(() => {
    if (ready && !message) {
      const t = template(inv, tone, days);
      setSubject(t.subject);
      setMessage(t.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const say = (text: string, error = false) => setNote({ text, error });

  // ---- actions ----
  async function generate() {
    if (busy || !ready) return;
    setBusy(true);
    say("");
    const payload: GenerateRequest = {
      tone,
      sender: inv.sender,
      client: inv.client,
      invoiceNo: inv.invoiceNo,
      amountText: money(inv.balance, inv.currency),
      dueText: dateText(form.due),
      timing: timing(days),
      reminders: inv.reminders,
      paymentDetails: inv.paymentDetails,
      history: inv.history,
    };
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<GenerateResponse> & { error?: string };
      if (!res.ok || !data.message) throw new Error(data.error ?? "Request failed");
      setSubject(data.subject || template(inv, tone, days).subject);
      setMessage(data.message);
      say(`Drafted by ${data.model ?? "Gemma"}. Read it over and edit before sending.`);
    } catch (e) {
      const t = template(inv, tone, days);
      setSubject(t.subject);
      setMessage(t.message);
      const reason = e instanceof Error ? e.message : "request failed";
      say(`Showing the built-in template (${reason}). Add a GEMINI_API_KEY in Vercel to enable Gemma drafts.`, true);
    } finally {
      setBusy(false);
    }
  }

  function pickTone(t: Tone) {
    setChosenTone(t);
    const tpl = template(inv, t, days);
    setSubject(tpl.subject);
    setMessage(tpl.message);
    say("Template shown. Press “Draft with Gemma” for a personalised version.");
  }

  function saveInvoice(f: InvoiceForm): boolean {
    if (!f.client.trim()) {
      say("Add a client name before saving.", true);
      return false;
    }
    const id = currentId ?? String(Date.now());
    const rec: SavedInvoice = { ...f, id };
    const list = loadSaved();
    const i = list.findIndex((x) => x.id === id);
    if (i >= 0) list[i] = rec;
    else list.unshift(rec);
    persist(list);
    setSaved(list);
    setCurrentId(id);
    return true;
  }

  function logSent() {
    const today = new Date().toLocaleDateString(undefined, { day: "numeric", month: "short" });
    const line = `${today}: sent ${TONE_NAMES[tone].toLowerCase()} reminder.`;
    const next: InvoiceForm = {
      ...form,
      history: `${form.history.trim()}\n${line}`.trim(),
      reminders: String(inv.reminders + 1),
    };
    setForm(next);
    setChosenTone(null);
    if (saveInvoice(next)) say("Logged and saved. The next draft will escalate if there is still no payment.");
  }

  function openSaved(o: SavedInvoice) {
    const { id, ...f } = o;
    const parsed = parseForm(f);
    const d = f.due ? daysOverdue(f.due) : 0;
    setForm(f);
    setCurrentId(id);
    setChosenTone(null);
    if (f.due && parsed.amount > 0 && f.status !== "paid" && parsed.client) {
      const t = template(parsed, Math.max(1, stageFor(parsed.reminders, d)) as Tone, d);
      setSubject(t.subject);
      setMessage(t.message);
    } else {
      setSubject("");
      setMessage("");
    }
    say("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteSaved(id: string) {
    const list = loadSaved().filter((x) => x.id !== id);
    persist(list);
    setSaved(list);
    if (currentId === id) setCurrentId(null);
  }

  function newInvoice() {
    setForm(emptyForm);
    setCurrentId(null);
    setChosenTone(null);
    setSubject("");
    setMessage("");
    say("");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${message}`);
      say("Copied to clipboard.");
    } catch {
      say("Select the text and copy it manually.", true);
    }
  }

  function openMail() {
    window.location.href = `mailto:${encodeURIComponent(inv.clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  }

  return (
    <div style={{ "--stamp": STAGE_COLOR[stage] } as CSSProperties}>
      <header>
        <div className="header-row">
          <div className="header-content">
            <h1>PayFollow</h1>
            <p>
              Enter the invoice. PayFollow works out how overdue it is and drafts the follow-up that fits, from a friendly
              nudge to a final notice.
            </p>
          </div>
          {user && (
            <div className="user-badge">
              <span className="user-avatar" aria-hidden="true">
                {(user.name || user.email || "U").charAt(0).toUpperCase()}
              </span>
              <span className="user-email">{user.email || user.name}</span>
              <button
                type="button"
                className="signout-btn"
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Sign out of your account"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="layout">
        <section className="panel" aria-labelledby="inv-h">
          <h2 id="inv-h">Invoice</h2>

          <div className="field">
            <label htmlFor="sender">
              Your name <span className="hint">(for the sign-off)</span>
            </label>
            <input id="sender" autoComplete="name" value={form.sender} onChange={(e) => set("sender", e.target.value)} />
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="client">Client name</label>
              <input id="client" placeholder="Dana Okafor" value={form.client} onChange={(e) => set("client", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="invoiceNo">
                Invoice no. <span className="hint">(optional)</span>
              </label>
              <input id="invoiceNo" placeholder="INV-0042" value={form.invoiceNo} onChange={(e) => set("invoiceNo", e.target.value)} />
            </div>
          </div>

          <div className="row row3">
            <div className="field">
              <label htmlFor="amount">Invoice amount</label>
              <input id="amount" type="number" min="0" step="0.01" inputMode="decimal" placeholder="1200" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="currency">Currency</label>
              <select id="currency" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="due">Due date</label>
              <input id="due" type="date" value={form.due} onChange={(e) => set("due", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="status">Payment status</label>
              <select id="status" value={form.status} onChange={(e) => set("status", e.target.value as InvoiceForm["status"])}>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partially paid</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          {form.status === "partial" && (
            <div className="row">
              <div className="field">
                <label htmlFor="paid">Amount already paid</label>
                <input id="paid" type="number" min="0" step="0.01" inputMode="decimal" value={form.paid} onChange={(e) => set("paid", e.target.value)} />
              </div>
              <div />
            </div>
          )}

          <div className="row">
            <div className="field">
              <label htmlFor="reminders">Reminders already sent</label>
              <input id="reminders" type="number" min="0" max="20" value={form.reminders} onChange={(e) => set("reminders", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="clientEmail">
                Client email <span className="hint">(optional)</span>
              </label>
              <input id="clientEmail" type="email" value={form.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="history">
              Previous communication <span className="hint">(replies, promises, past reminders)</span>
            </label>
            <textarea
              id="history"
              placeholder="e.g. 12 Oct: Dana said finance would pay by the 20th. 25 Oct: sent first reminder, no reply."
              value={form.history}
              onChange={(e) => set("history", e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="paymentDetails">
              Payment details <span className="hint">(optional, added to the email)</span>
            </label>
            <textarea
              id="paymentDetails"
              style={{ minHeight: 56 }}
              placeholder="Bank transfer to … or pay online at …"
              value={form.paymentDetails}
              onChange={(e) => set("paymentDetails", e.target.value)}
            />
          </div>

          <div className="actions">
            <button type="button" className="ghost" onClick={() => saveInvoice(form) && say("Invoice saved on this device.")}>
              Save invoice
            </button>
            <button type="button" className="ghost" onClick={newInvoice}>
              New invoice
            </button>
          </div>
        </section>

        <section className="panel" aria-labelledby="out-h">
          <h2 id="out-h">Follow-up</h2>

          <div className="status">
            <div className="stamp" role="status">
              {stampBig}
              <small>{stampSmall}</small>
            </div>
            {complete && (
              <div className="balance">
                {money(inv.balance, inv.currency)}
                <small>
                  {form.status === "partial" ? "balance outstanding" : "outstanding"}
                  {inv.invoiceNo ? ` · ${inv.invoiceNo}` : ""}
                </small>
              </div>
            )}
          </div>

          {ready ? (
            <div>
              <div className="tabs" role="tablist" aria-label="Message tone">
                {([1, 2, 3] as const).map((t) => (
                  <button key={t} type="button" role="tab" className="tab" aria-selected={t === tone} onClick={() => pickTone(t)}>
                    {TONE_NAMES[t]}
                    {t === suggested && <span className="rec">suggested</span>}
                  </button>
                ))}
              </div>

              <label className="sr" htmlFor="subject">Subject</label>
              <input id="subject" className="subject" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <label className="sr" htmlFor="message">Message</label>
              <textarea id="message" className="letter" placeholder="Your draft appears here." value={message} onChange={(e) => setMessage(e.target.value)} />

              <p className={`note${note.error ? " err" : ""}`} aria-live="polite">
                {note.text}
              </p>

              <div className="actions" style={{ marginTop: 12 }}>
                <button type="button" onClick={generate} disabled={busy}>
                  {busy ? "Drafting…" : "Draft with Gemma"}
                </button>
                <button type="button" className="ghost" onClick={copy}>Copy</button>
                <button type="button" className="ghost" onClick={openMail}>Open in email</button>
                <button type="button" className="ghost" onClick={logSent}>Log as sent</button>
              </div>
            </div>
          ) : (
            <p className="empty">Fill in the client, amount and due date and your draft options will show up here.</p>
          )}
        </section>
      </main>

      {saved.length > 0 && (
        <section className="saved">
          <h2>Saved invoices</h2>
          <ul>
            {saved.map((o) => {
              const parsed = parseForm(o);
              const d = o.due ? daysOverdue(o.due) : null;
              const st: Stage = o.status === "paid" || d === null ? 0 : stageFor(parsed.reminders, d);
              const color = o.status === "paid" ? "var(--s1)" : STAGE_COLOR[st];
              return (
                <li key={o.id} style={{ "--c": color } as CSSProperties}>
                  <div>
                    <b>
                      {o.client}
                      {o.invoiceNo ? ` · ${o.invoiceNo}` : ""}
                    </b>
                    <span>
                      {money(parsed.balance, o.currency || "USD")} ·{" "}
                      {o.status === "paid" ? "paid" : d === null ? "no due date" : timing(d)} · {parsed.reminders} reminder(s) sent
                    </span>
                  </div>
                  <div className="actions">
                    <button type="button" className="ghost" onClick={() => openSaved(o)}>Open</button>
                    <button type="button" className="ghost" onClick={() => deleteSaved(o.id)}>Delete</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
