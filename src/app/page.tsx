"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { MONF, DOW, fmt, fmtRange, sameDay, toISO } from "@/lib/dates";
import { blockForDate, isCoreLabel, type Block } from "@/lib/schedule";

type Meta = {
  residents: { id: string; full_name: string; pgy: number }[];
  vocab: string[];
  conferences: string[];
  blocks: Block[];
  today: string;
};
type ChiefComment = { author: string; text: string; at: string };
type MyReq = {
  id: string;
  conference: string;
  start_date: string;
  end_date: string;
  rotation: string | null;
  status: string;
  presentation_dates: string[];
  note?: string;
  chief_comments?: ChiefComment[];
};

export default function ResidentForm() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [name, setName] = useState("");
  const [conference, setConference] = useState("");
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [cal, setCal] = useState({ m: 9, y: 2026 });
  const [knowsPres, setKnowsPres] = useState(false);
  const [presDates, setPresDates] = useState<string[]>([]);
  const [rotation, setRotation] = useState("");
  const [detected, setDetected] = useState<{ core: boolean; label: string } | null>(null);
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const [toast, setToast] = useState<{ msg: string; warn?: boolean } | null>(null);
  const [mine, setMine] = useState<MyReq[]>([]);

  const residentId = useMemo(
    () => meta?.residents.find((r) => r.full_name === name)?.id || null,
    [meta, name]
  );

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((m: Meta) => {
        setMeta(m);
        const t = new Date(m.today + "T00:00:00");
        setCal({ m: t.getMonth(), y: t.getFullYear() });
      });
  }, []);

  const loadMine = useCallback((id: string | null) => {
    if (!id) return setMine([]);
    fetch(`/api/my-requests?resident_id=${id}`)
      .then((r) => r.json())
      .then((d) => setMine(d.requests || []));
  }, []);

  // auto-detect rotation from name + start date
  useEffect(() => {
    if (!residentId || !start) {
      setDetected(null);
      return;
    }
    fetch("/api/detect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resident_id: residentId, date: toISO(start) }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.rotation && d.rotation !== "—") {
          setRotation(d.rotation);
          setDetected({ core: d.is_core, label: d.rotation });
        } else {
          setDetected(null);
        }
      });
  }, [residentId, start]);

  useEffect(() => {
    loadMine(residentId);
  }, [residentId, loadMine]);

  function pickDate(d: Date) {
    if (!start || (start && end)) {
      setStart(d);
      setEnd(null);
    } else if (d >= start) setEnd(d);
    else {
      setStart(d);
      setEnd(null);
    }
    setCal({ m: d.getMonth(), y: d.getFullYear() });
  }

  const spanNote = useMemo(() => {
    if (!start || !end || !meta) return "";
    const bi = blockForDate(meta.blocks, start);
    const bj = blockForDate(meta.blocks, end);
    if (bi && bj && bi.block_no !== bj.block_no)
      return " Your trip crosses two blocks, so your rotation may change partway — the chiefs will double-check.";
    return "";
  }, [start, end, meta]);

  async function submit() {
    if (!residentId) return flash("Select your name from the list first.", true);
    if (!conference.trim()) return flash("Add the conference name first.", true);
    if (!start || !end) return flash("Pick your dates on the calendar.", true);
    if (!ack) return flash("Please check the UFGO / acceptance-email reminder before submitting.", true);
    const pres = knowsPres ? presDates.filter(Boolean).sort() : [];
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resident_id: residentId,
        conference: conference.trim(),
        start_date: toISO(start),
        end_date: toISO(end),
        rotation,
        presentation_dates: pres,
        note: note.trim(),
      }),
    });
    const d = await res.json();
    if (!res.ok) return flash(d.error || "Something went wrong.", true);
    setStart(null);
    setEnd(null);
    setPresDates([]);
    setKnowsPres(false);
    setAck(false);
    setConference("");
    setNote("");
    flash("Request submitted — the chiefs have been notified by email.");
    loadMine(residentId);
  }
  function flash(msg: string, warn?: boolean) {
    setToast({ msg, warn });
    setTimeout(() => setToast(null), 2800);
  }

  const core = isCoreLabel(rotation);

  return (
    <>
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
              <path d="m9 16 2 2 4-4" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Conference Acceptance Form</div>
            <div className="brand-sub">UF Health Jacksonville · Internal Medicine</div>
          </div>
        </div>
        <Link className="btn sm" href="/login">
          Chief sign-in
        </Link>
      </div>

      <div className="main narrow">
        <div className="formwrap">
          <div className="pagehead">
            <h1>Conference Acceptance Form</h1>
            <p>
              Accepted to present or attend? Submit the details here and the chiefs will review it,
              decide on approval, and arrange coverage if your rotation needs it. You&rsquo;ll see the
              status update below.
            </p>
          </div>

          <div className="card formcard">
            <div className="field">
              <label>
                Your name <span className="hint">— start typing your first or last name</span>
              </label>
              <NameSearch residents={meta?.residents || []} value={name} onChange={setName} />
            </div>

            <div className="field">
              <label>
                Conference <span className="hint">— name of the meeting you were accepted to</span>
              </label>
              <input
                list="conflist"
                value={conference}
                onChange={(e) => setConference(e.target.value)}
                placeholder="e.g. ACC.26, CHEST 2026, ACP Internal Medicine Meeting"
              />
              <datalist id="conflist">
                {meta?.conferences.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="field">
              <label>Dates requesting off</label>
              <RangeCalendar
                m={cal.m}
                y={cal.y}
                start={start}
                end={end}
                onPick={pickDate}
                onMove={(n) =>
                  setCal((c) => {
                    let m = c.m + n,
                      y = c.y;
                    if (m < 0) {
                      m = 11;
                      y--;
                    }
                    if (m > 11) {
                      m = 0;
                      y++;
                    }
                    return { m, y };
                  })
                }
              />
              <div className="rangetext">
                {!start ? (
                  <span className="rt-empty">
                    Click your <b>departure</b> date, then your <b>return</b> date.
                  </span>
                ) : !end ? (
                  <span className="rt-empty">
                    Leaving <b>{fmt(start)}</b> — now click your <b>return</b> date.
                  </span>
                ) : (
                  <span className="rt-set">
                    📅 {fmtRange(start, end)}, {end.getFullYear()} ·{" "}
                    {Math.round((end.getTime() - start.getTime()) / 86400000) + 1} days
                  </span>
                )}
              </div>
            </div>

            <div className="field">
              <label>Presentation date(s)</label>
              <label className="checkrow">
                <input
                  type="checkbox"
                  checked={knowsPres}
                  onChange={(e) => {
                    setKnowsPres(e.target.checked);
                    if (e.target.checked && presDates.length === 0) setPresDates([""]);
                  }}
                />{" "}
                I know my exact presentation date(s)
              </label>
              {knowsPres ? (
                <div>
                  <div className="hint" style={{ marginBottom: 9 }}>
                    You can add more than one date if you&rsquo;re presenting more than once.
                  </div>
                  {presDates.map((d, i) => (
                    <div className="presrow" key={i}>
                      <input
                        type="date"
                        value={d}
                        onChange={(e) => {
                          const v = [...presDates];
                          v[i] = e.target.value;
                          setPresDates(v);
                        }}
                      />
                      <button
                        type="button"
                        className="rm"
                        onClick={() => setPresDates(presDates.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn sm" onClick={() => setPresDates([...presDates, ""])}>
                    + Add a date
                  </button>
                </div>
              ) : (
                <div className="optnote">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                  <span>
                    No problem — programs often don&rsquo;t release the exact slot until weeks after
                    acceptance. The chiefs will see this flagged for follow-up, and you can add the
                    date later from &ldquo;Your requests&rdquo; below.
                  </span>
                </div>
              )}
            </div>

            <div className="field">
              <label>
                Rotation during those dates{" "}
                <span className="hint">— filled in from the schedule; change it if you&rsquo;ve swapped</span>
              </label>
              <select value={rotation} onChange={(e) => setRotation(e.target.value)}>
                <option value="">— select —</option>
                {meta?.vocab.map((l) => (
                  <option key={l} value={l}>
                    {l}
                    {isCoreLabel(l) ? " (core)" : ""}
                  </option>
                ))}
              </select>
              <div className="coreauto">
                {!residentId || !start ? (
                  <span style={{ color: "var(--ink-3)" }}>
                    Pick your name and dates above — we&rsquo;ll fill in your rotation automatically.
                  </span>
                ) : (
                  <>
                    {core ? (
                      <span className="chip core">◆ Core rotation</span>
                    ) : (
                      <span className="chip noncore">Non-core rotation</span>
                    )}
                    <span>
                      {core
                        ? "May need coverage — the chiefs decide when they review."
                        : "Usually doesn't require pulling coverage."}
                      {spanNote}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="field">
              <label>
                Anything the chiefs should know? <span className="hint">— optional</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Unique circumstances, requests, preferences, or comments"
              />
            </div>

            <div className="todo-remind">
              <div className="tr-head">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4M12 17h.01" />
                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                </svg>
                Before you submit — two things this form can&rsquo;t do for you
              </div>
              <ul>
                <li>
                  <b>Complete your UFGO request</b> so you&rsquo;re reimbursed for travel &amp; lodging.
                </li>
                <li>
                  <b>Forward your original acceptance email</b> to Lorna Matos (
                  <a href="mailto:lorna.matos@ufhealth.org">lorna.matos@ufhealth.org</a>).
                </li>
              </ul>
              <label className="checkrow">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I
                understand — I&rsquo;ll complete my UFGO request and forward my acceptance email to
                Lorna Matos.
              </label>
            </div>

            <div className="submitrow">
              <button className="btn primary" onClick={submit}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
                Submit request
              </button>
              <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                This is a request — the chiefs make the final call on approval &amp; coverage.
              </span>
            </div>
          </div>

          <div className="myreq">
            <h3>Your requests this year</h3>
            <div className="card">
              {mine.length ? (
                mine.map((r) => (
                  <MyRequestRow
                    key={r.id}
                    r={r}
                    residentId={residentId}
                    meta={meta}
                    reload={() => loadMine(residentId)}
                    flash={flash}
                  />
                ))
              ) : (
                <div className="empty">
                  {residentId ? "No requests yet — submit one above." : "Pick your name to see your requests."}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className={"toast show"}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: toast.warn ? "var(--warn)" : "var(--ok)" }}>
            <path d="m20 6-11 11-5-5" />
          </svg>
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  );
}

/* ───────── Searchable name field (first OR last name) ───────── */
function NameSearch({
  residents,
  value,
  onChange,
}: {
  residents: { id: string; full_name: string; pgy: number }[];
  value: string;
  onChange: (name: string) => void;
}) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setQ(value);
  }, [value]);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return residents.slice(0, 8);
    const toks = s.split(/\s+/);
    return residents
      .filter((r) => {
        const hay = r.full_name.toLowerCase();
        const words = hay.split(/\s+/);
        return toks.every((t) => words.some((w) => w.startsWith(t)) || hay.includes(t));
      })
      .slice(0, 8);
  }, [q, residents]);

  function choose(r: { full_name: string }) {
    onChange(r.full_name);
    setQ(r.full_name);
    setOpen(false);
  }

  return (
    <div className="ac-wrap">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            if (matches[active]) {
              e.preventDefault();
              choose(matches[active]);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Type your first or last name…"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <div className="ac-menu">
          {matches.length ? (
            matches.map((r, i) => (
              <button
                type="button"
                key={r.id}
                className={"ac-opt" + (i === active ? " active" : "")}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
              >
                <span>{r.full_name}</span>
                <span className="ac-pgy">PGY-{r.pgy}</span>
              </button>
            ))
          ) : (
            <div className="ac-empty">No matches — check the spelling.</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────── A resident's own request, with self-edit ───────── */
function MyRequestRow({
  r,
  residentId,
  meta,
  reload,
  flash,
}: {
  r: MyReq;
  residentId: string | null;
  meta: Meta | null;
  reload: () => void;
  flash: (msg: string, warn?: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [conference, setConference] = useState(r.conference);
  const [startDate, setStartDate] = useState(r.start_date);
  const [endDate, setEndDate] = useState(r.end_date);
  const [rotation, setRotation] = useState(r.rotation || "");
  const [note, setNote] = useState(r.note || "");
  const [pres, setPres] = useState<string[]>(r.presentation_dates.length ? r.presentation_dates : []);
  const [busy, setBusy] = useState(false);

  const editable = r.status === "pending" || r.status === "needs_revision";
  const comments = r.chief_comments || [];

  function reset() {
    setConference(r.conference);
    setStartDate(r.start_date);
    setEndDate(r.end_date);
    setRotation(r.rotation || "");
    setNote(r.note || "");
    setPres(r.presentation_dates.length ? r.presentation_dates : []);
  }

  async function save() {
    if (!residentId) return;
    if (editable) {
      if (!conference.trim()) return flash("Conference can't be blank.", true);
      if (!startDate || !endDate) return flash("Both dates are required.", true);
      if (endDate < startDate) return flash("Return date is before departure.", true);
    }
    const body: Record<string, unknown> = {
      resident_id: residentId,
      id: r.id,
      presentation_dates: pres.filter(Boolean).sort(),
    };
    if (editable) {
      body.conference = conference.trim();
      body.start_date = startDate;
      body.end_date = endDate;
      body.rotation = rotation || null;
      body.note = note.trim();
    }
    setBusy(true);
    const res = await fetch("/api/my-requests", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return flash(d.error || "Couldn't save.", true);
    setOpen(false);
    flash(r.status === "needs_revision" ? "Updated — sent back to the chiefs for review." : "Your request was updated.");
    reload();
  }

  return (
    <div className="myrow expandable">
      <div>
        <div className="conf">{r.conference}</div>
        <div className="dt">
          {fmtRange(new Date(r.start_date + "T00:00:00"), new Date(r.end_date + "T00:00:00"))} ·{" "}
          {r.rotation || "—"}
        </div>
      </div>
      <div className="sp" style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
        {r.status !== "denied" && r.presentation_dates.length === 0 && (
          <span className="chip flag">⚑ add date</span>
        )}
        <StatusChip status={r.status} />
        <button
          className="btn sm"
          onClick={() => {
            if (!open) reset();
            setOpen(!open);
          }}
        >
          {open ? "Close" : "Manage"}
        </button>
      </div>

      {open && (
        <div className="myedit">
          {r.status === "needs_revision" && comments.length > 0 && (
            <div className="revision-note">
              <div className="rn-label">The chiefs asked for a revision</div>
              {comments.map((c, i) => (
                <div className="rn-item" key={i}>
                  {c.text} <span className="rn-who">— {c.author}</span>
                </div>
              ))}
            </div>
          )}

          <div className="field" style={{ margin: 0 }}>
            <label>Presentation date(s)</label>
            {pres.length === 0 && <div className="hint" style={{ marginBottom: 7 }}>Add your exact date once you know it.</div>}
            {pres.map((d, i) => (
              <div className="presrow" key={i}>
                <input
                  type="date"
                  value={d}
                  onChange={(e) => {
                    const v = [...pres];
                    v[i] = e.target.value;
                    setPres(v);
                  }}
                />
                <button type="button" className="rm" onClick={() => setPres(pres.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="btn sm" onClick={() => setPres([...pres, ""])}>
              + Add a date
            </button>
          </div>

          {editable ? (
            <>
              <div className="field" style={{ margin: 0 }}>
                <label>Conference</label>
                <input value={conference} onChange={(e) => setConference(e.target.value)} />
              </div>
              <div className="field2">
                <div className="field" style={{ margin: 0 }}>
                  <label>Departure</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label>Return</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Rotation</label>
                <select value={rotation} onChange={(e) => setRotation(e.target.value)}>
                  <option value="">— select —</option>
                  {meta?.vocab.map((l) => (
                    <option key={l} value={l}>
                      {l}
                      {isCoreLabel(l) ? " (core)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Anything the chiefs should know?</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="hint">
              This request is {r.status === "approved" ? "approved" : "denied"}, so only the presentation
              date can be changed here. Ask the chiefs if anything else needs to change.
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn primary" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button className="btn" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "pending") return <span className="chip pending">◷ Pending</span>;
  if (status === "approved") return <span className="chip approved">✓ Approved</span>;
  if (status === "needs_revision") return <span className="chip flag">⚑ Needs revision</span>;
  return <span className="chip denied">✕ Denied</span>;
}

function RangeCalendar({
  m,
  y,
  start,
  end,
  onPick,
  onMove,
}: {
  m: number;
  y: number;
  start: Date | null;
  end: Date | null;
  onPick: (d: Date) => void;
  onMove: (n: number) => void;
}) {
  const first = new Date(y, m, 1);
  const pad = first.getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const cells = Math.ceil((pad + dim) / 7) * 7;
  const gStart = new Date(y, m, 1 - pad);
  const days: Date[] = [];
  for (let i = 0; i < cells; i++) {
    const d = new Date(gStart);
    d.setDate(gStart.getDate() + i);
    days.push(d);
  }
  return (
    <div className="rangepick">
      <div className="rangehead">
        <button type="button" className="iconbtn sm" onClick={() => onMove(-1)} aria-label="Previous month">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="rangetitle">
          {MONF[m]} {y}
        </div>
        <button type="button" className="iconbtn sm" onClick={() => onMove(1)} aria-label="Next month">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
      <div className="rangedow">
        {DOW.map((d) => (
          <span key={d}>{d[0]}</span>
        ))}
      </div>
      <div className="rangegrid">
        {days.map((d, i) => {
          const out = d.getMonth() !== m;
          const isStart = !!start && sameDay(d, start);
          const isEnd = !!end && sameDay(d, end);
          const mid = !!start && !!end && d > start && d < end;
          const cls = ["rc", out ? "out" : "", isStart ? "start" : "", isEnd ? "end" : "", mid ? "mid" : ""]
            .filter(Boolean)
            .join(" ");
          return (
            <button type="button" key={i} className={cls} onClick={() => onPick(d)}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
