"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { isCoreLabel } from "@/lib/schedule";
import { RequestRow, Resident, surnameOf } from "@/lib/types";
import {
  MON, MONF, DOW, ymd, fmt, fmtISO, fmtRangeISO, dayCountISO, sameDay,
} from "@/lib/dates";

/* ───────────────────────── helpers ───────────────────────── */
const AV_COLORS = ["#0E7A86", "#2C5FD6", "#B0730F", "#7A46B8", "#1C8A57", "#C0553B", "#0A7C9E", "#B03B6E"];
function initials(n: string) {
  return n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
function colorFor(n: string) {
  let h = 0;
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}
function confShort(name: string) {
  return name.replace(/\s*\d{4}$/, "").split(" ")[0];
}
function daysPending(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
}
function isOverdue(r: RequestRow) {
  return r.status === "pending" && daysPending(r.submitted_at) > 7;
}
function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar" style={{ background: colorFor(name) }}>
      {initials(name)}
    </span>
  );
}
function StatusChip({ s }: { s: string }) {
  if (s === "pending") return <span className="chip pending">◷ Pending</span>;
  if (s === "approved") return <span className="chip approved">✓ Approved</span>;
  if (s === "needs_revision") return <span className="chip flag">⚑ Needs revision</span>;
  return <span className="chip denied">✕ Denied</span>;
}
function fmtWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function CoreChip({ rot }: { rot: string | null }) {
  return isCoreLabel(rot || "") ? (
    <span className="chip core">◆ Core</span>
  ) : (
    <span className="chip noncore">Non-core</span>
  );
}

type Tab = "board" | "calendar" | "conferences" | "residents" | "admin";
type Filter = "pending" | "approved" | "denied" | "needs_revision" | "all";

/* ───────────────────────── main ───────────────────────── */
export default function ConsoleApp({
  initialRequests,
  initialResidents,
  chief,
}: {
  initialRequests: RequestRow[];
  initialResidents: Resident[];
  chief: string;
}) {
  const [reqs, setReqs] = useState<RequestRow[]>(initialRequests);
  const [residents, setResidents] = useState<Resident[]>(initialResidents);
  const [tab, setTab] = useState<Tab>("board");
  const [filter, setFilter] = useState<Filter>("pending");
  const [modalReq, setModalReq] = useState<RequestRow | null>(null);
  const [editReq, setEditReq] = useState<RequestRow | null>(null);
  const [revisionReq, setRevisionReq] = useState<RequestRow | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const today = new Date();
  const [cal, setCal] = useState({ m: today.getMonth(), y: today.getFullYear() });

  const refresh = useCallback(async () => {
    const r = await fetch("/api/requests").then((x) => x.json());
    if (r.requests) setReqs(r.requests);
  }, []);
  const refreshResidents = useCallback(async () => {
    const r = await fetch("/api/admin/residents").then((x) => x.json());
    if (r.residents) setResidents(r.residents);
  }, []);

  async function decide(id: string, body: Record<string, unknown>) {
    await fetch(`/api/requests/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    await refresh();
  }

  const pending = reqs.filter((r) => r.status === "pending");
  const overdue = reqs.filter(isOverdue);

  function gotoRequest(id: string) {
    setTab("board");
    setFilter("all");
    setHighlight(id);
  }
  useEffect(() => {
    if (!highlight) return;
    const el = document.getElementById("req-" + highlight);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash");
    }
    const t = setTimeout(() => setHighlight(null), 1800);
    return () => clearTimeout(t);
  }, [highlight, tab, filter]);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    window.location.href = "/login";
  }

  const NAV: { key: Tab; label: string; badge?: number }[] = [
    { key: "board", label: "Review Board", badge: pending.length },
    { key: "calendar", label: "Calendar" },
    { key: "conferences", label: "Conferences" },
    { key: "residents", label: "Residents" },
    { key: "admin", label: "Admin" },
  ];

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
            <div className="brand-name">Conference Coverage Board</div>
            <div className="brand-sub">UF Health Jacksonville · Internal Medicine</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
            Signed in as <b style={{ color: "var(--ink)" }}>{chief}</b>
          </span>
          <button className="btn sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      <div className="layout">
        <nav className="sidebar">
          <div className="navlabel">Console</div>
          {NAV.map((n) => (
            <button
              key={n.key}
              className={"navitem" + (tab === n.key ? " on" : "")}
              onClick={() => setTab(n.key)}
            >
              {n.label}
              {n.badge ? <span className="badge">{n.badge}</span> : null}
            </button>
          ))}
        </nav>

        <main className="main">
          {tab === "board" && (
            <Board
              reqs={reqs}
              filter={filter}
              setFilter={setFilter}
              onApprove={(r) => setModalReq(r)}
              onDeny={(r) => decide(r.id, { action: "deny" })}
              onEdit={(r) => setEditReq(r)}
              onRevision={(r) => setRevisionReq(r)}
              highlight={highlight}
            />
          )}
          {tab === "calendar" && (
            <Calendar reqs={reqs} cal={cal} setCal={setCal} onOpen={gotoRequest} />
          )}
          {tab === "conferences" && <Conferences reqs={reqs} />}
          {tab === "residents" && <Residents reqs={reqs} residents={residents} />}
          {tab === "admin" && (
            <Admin residents={residents} refreshResidents={refreshResidents} refreshAll={refresh} />
          )}
        </main>
      </div>

      {modalReq && (
        <ApproveModal
          req={modalReq}
          onClose={() => setModalReq(null)}
          onDone={async (body) => {
            await decide(modalReq.id, body);
            setModalReq(null);
          }}
        />
      )}

      {editReq && (
        <EditModal
          req={editReq}
          onClose={() => setEditReq(null)}
          onDone={async (body) => {
            await decide(editReq.id, body);
            setEditReq(null);
          }}
        />
      )}

      {revisionReq && (
        <RevisionModal
          req={revisionReq}
          onClose={() => setRevisionReq(null)}
          onDone={async (body) => {
            await decide(revisionReq.id, body);
            setRevisionReq(null);
          }}
        />
      )}
    </>
  );
}

/* ───────────────────────── Board ───────────────────────── */
function Board({
  reqs,
  filter,
  setFilter,
  onApprove,
  onDeny,
  onEdit,
  onRevision,
  highlight,
}: {
  reqs: RequestRow[];
  filter: Filter;
  setFilter: (f: Filter) => void;
  onApprove: (r: RequestRow) => void;
  onDeny: (r: RequestRow) => void;
  onEdit: (r: RequestRow) => void;
  onRevision: (r: RequestRow) => void;
  highlight: string | null;
}) {
  const counts = {
    pending: reqs.filter((r) => r.status === "pending").length,
    approved: reqs.filter((r) => r.status === "approved").length,
    denied: reqs.filter((r) => r.status === "denied").length,
    needs_revision: reqs.filter((r) => r.status === "needs_revision").length,
  };
  const overdue = reqs.filter(isOverdue).length;
  const followups = reqs.filter((r) => r.status !== "denied" && r.presentation_dates.length === 0).length;
  const coverNeeded = reqs.filter((r) => r.status === "approved" && r.coverage_needed).length;
  const inbox = "IMChiefs.UFJPI@ufhealth.org";

  let list = reqs.slice();
  if (filter !== "all") list = list.filter((r) => r.status === filter);
  list.sort((a, b) => a.start_date.localeCompare(b.start_date));

  return (
    <>
      <div className="pagehead">
        <h1>Review board</h1>
        <p>
          Every conference-leave request lands here as a card. Approve or deny, then decide whether
          coverage needs to be pulled. New submissions email <b>{inbox}</b> and bump the Pending
          badge.
        </p>
      </div>
      <div className="stats">
        <div className="card stat">
          <div className="k">Pending review</div>
          <div className="v warn">{counts.pending}</div>
          <div className="d">awaiting a decision</div>
        </div>
        <div className="card stat">
          <div className="k">Awaiting &gt;7 days</div>
          <div className={"v " + (overdue ? "warn" : "")}>{overdue}</div>
          <div className="d">reminder emailed</div>
        </div>
        <div className="card stat">
          <div className="k">Need presentation date</div>
          <div className={"v " + (followups ? "warn" : "")}>{followups}</div>
          <div className="d">flagged for follow-up</div>
        </div>
        <div className="card stat">
          <div className="k">Approved · coverage pulled</div>
          <div className="v ok">{coverNeeded}</div>
          <div className="d">of {counts.approved} approved</div>
        </div>
      </div>

      {overdue > 0 && (
        <div className="overduebanner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8v4l3 2" />
            <circle cx="12" cy="12" r="9" />
          </svg>
          <span>
            <b>{overdue}</b> request{overdue > 1 ? "s have" : " has"} been pending more than 7 days — a
            reminder was emailed to <b>{inbox}</b>.
          </span>
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <div className="sectiontabs">
          {([
            ["pending", "Pending"],
            ["needs_revision", "Needs revision"],
            ["approved", "Approved"],
            ["denied", "Denied"],
            ["all", "All"],
          ] as const).map(([f, label]) => (
            <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
              {label}{" "}
              <span className="cnt">{f === "all" ? reqs.length : counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="board">
        {list.length ? (
          list.map((r) => (
            <Card
              key={r.id}
              r={r}
              onApprove={onApprove}
              onDeny={onDeny}
              onEdit={onEdit}
              onRevision={onRevision}
              flash={highlight === r.id}
            />
          ))
        ) : (
          <div className="empty" style={{ gridColumn: "1/-1" }}>
            Nothing in this bucket.
          </div>
        )}
      </div>
    </>
  );
}

function Card({
  r,
  onApprove,
  onDeny,
  onEdit,
  onRevision,
  flash,
}: {
  r: RequestRow;
  onApprove: (r: RequestRow) => void;
  onDeny: (r: RequestRow) => void;
  onEdit: (r: RequestRow) => void;
  onRevision: (r: RequestRow) => void;
  flash: boolean;
}) {
  const presTxt = r.presentation_dates.length ? r.presentation_dates.map(fmtISO).join(", ") : null;
  const comments = Array.isArray(r.chief_comments) ? r.chief_comments : [];
  const decidable = r.status === "pending" || r.status === "needs_revision";

  let leftInfo: JSX.Element | null = null;
  if (r.status === "pending") {
    leftInfo = (
      <span className={"pendage " + (isOverdue(r) ? "over" : "")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 8v4l3 2" />
          <circle cx="12" cy="12" r="9" />
        </svg>
        {isOverdue(r)
          ? `Pending ${daysPending(r.submitted_at)} days · reminder emailed`
          : `Pending ${daysPending(r.submitted_at)} day${daysPending(r.submitted_at) === 1 ? "" : "s"}`}
      </span>
    );
  } else if (r.status === "needs_revision") {
    leftInfo = <span className="rc-decided">⚑ Sent back — awaiting resident update</span>;
  } else if (r.decided_by) {
    leftInfo = (
      <span className="rc-decided">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        {r.status === "denied" ? "Denied" : "Approved"} by {r.decided_by}
      </span>
    );
  }

  return (
    <div className={"card rcard s-" + r.status + (flash ? " flash" : "")} id={"req-" + r.id}>
      <div className="stripe" />
      <div className="rcard-body">
        <div className="rc-head">
          <Avatar name={r.resident_name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="rc-name">{r.resident_name}</div>
            <div className="rc-conf">{r.conference}</div>
          </div>
          <StatusChip s={r.status} />
        </div>
        <div className="rc-list">
          <div className="rc-row">
            <span className="rc-k">Dates</span>
            <span className="rc-v">
              {fmtRangeISO(r.start_date, r.end_date)} · {dayCountISO(r.start_date, r.end_date)} days
            </span>
          </div>
          <div className="rc-row">
            <span className="rc-k">Rotation</span>
            <span className="rc-v">
              {r.rotation || "—"} <CoreChip rot={r.rotation} />
            </span>
          </div>
          <div className="rc-row">
            <span className="rc-k">Presentation</span>
            <span className="rc-v sub">
              {presTxt ? presTxt : <>Not announced <span className="miniflag">⚑ needs date</span></>}
            </span>
          </div>
          {r.status === "approved" && (
            <div className="rc-row">
              <span className="rc-k">Coverage</span>
              <span className="rc-v">
                {r.coverage_needed ? (
                  <>
                    {r.cover_resident_name}
                    <span className="sub"> · from {r.cover_from || "—"}</span>
                  </>
                ) : (
                  <span className="sub">Not needed</span>
                )}
              </span>
            </div>
          )}
        </div>
        {r.note && <div className="rc-note">{r.note}</div>}

        {comments.length > 0 && (
          <div className="chief-thread">
            <div className="ct-label">Chief notes</div>
            {comments.map((c, i) => (
              <div className="ct-item" key={i}>
                <div className="ct-meta">
                  <b>{c.author}</b> · {fmtWhen(c.at)}
                </div>
                <div className="ct-text">{c.text}</div>
              </div>
            ))}
          </div>
        )}

        <div className="rc-foot">
          {leftInfo || <span />}
          <span className="rc-actions">
            {decidable && (
              <>
                <button className="btn ok sm" onClick={() => onApprove(r)}>
                  Approve
                </button>
                <button className="btn ghost-danger sm" onClick={() => onDeny(r)}>
                  Deny
                </button>
              </>
            )}
            <button className="btn sm" onClick={() => onRevision(r)}>
              {r.status === "needs_revision" ? "Add note" : "Request revision"}
            </button>
            <button className="btn sm" onClick={() => onEdit(r)}>
              Edit
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Approve modal ───────────────────────── */
type Cand = { id: string; name: string; surname: string; pgy: number; rot: string; core: boolean; vacation: boolean; out: boolean };
function ApproveModal({
  req,
  onClose,
  onDone,
}: {
  req: RequestRow;
  onClose: () => void;
  onDone: (body: Record<string, unknown>) => void;
}) {
  const [needs, setNeeds] = useState<boolean>(isCoreLabel(req.rotation || ""));
  const [suggested, setSuggested] = useState<Cand[]>([]);
  const [rest, setRest] = useState<Cand[]>([]);
  const [coverId, setCoverId] = useState<string>("");

  useEffect(() => {
    fetch(`/api/candidates?request_id=${req.id}`)
      .then((r) => r.json())
      .then((d) => {
        setSuggested(d.suggested || []);
        setRest(d.rest || []);
        const first = (d.suggested || [])[0] || (d.rest || [])[0];
        if (first) setCoverId(first.id);
      });
  }, [req.id]);

  const all = [...suggested, ...rest];
  const chosen = all.find((c) => c.id === coverId);
  const optLabel = (c: Cand) =>
    `${c.name} — ${c.rot}${c.core ? " ⚠ core" : ""}${c.vacation ? " · vacation" : ""}${c.out ? " · away" : ""}`;

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>Approve &amp; set coverage</h3>
        <p className="sub">
          <b>{req.resident_name}</b> · {req.conference} · {fmtRangeISO(req.start_date, req.end_date)} ·{" "}
          {req.rotation} {isCoreLabel(req.rotation || "") ? "(core)" : "(non-core)"}
        </p>
        <label style={{ fontWeight: 600, fontSize: 13.5, display: "block", marginBottom: 8 }}>
          Does this need someone pulled to cover?
        </label>
        <div className="coverq">
          <button className={needs ? "on" : ""} onClick={() => setNeeds(true)}>
            Yes — pull coverage
          </button>
          <button className={!needs ? "on" : ""} onClick={() => setNeeds(false)}>
            No coverage needed
          </button>
        </div>
        {needs && (
          <div className="field">
            <label style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 7, display: "block" }}>
              Who&rsquo;s covering?
            </label>
            <select value={coverId} onChange={(e) => setCoverId(e.target.value)}>
              {suggested.length > 0 && (
                <optgroup label="Suggested — non-core & free these dates">
                  {suggested.map((c) => (
                    <option key={c.id} value={c.id}>
                      {optLabel(c)}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Everyone else">
                {rest.map((c) => (
                  <option key={c.id} value={c.id}>
                    {optLabel(c)}
                  </option>
                ))}
              </optgroup>
            </select>
            {chosen && (
              <div className="hint" style={{ marginTop: 9 }}>
                Pulling <b style={{ color: "var(--ink)" }}>{chosen.name}</b> off{" "}
                <b style={{ color: "var(--ink)" }}>{chosen.rot}</b>{" "}
                {chosen.core ? (
                  <span className="chip pending">⚠ core — leaves a gap</span>
                ) : chosen.vacation ? (
                  <span className="chip flag">on vacation</span>
                ) : (
                  <span className="chip noncore">non-core</span>
                )}
              </div>
            )}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn ok"
            onClick={() =>
              onDone({ action: "approve", coverage_needed: needs, cover_resident_id: needs ? coverId : null })
            }
          >
            Approve request
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Edit modal ───────────────────────── */
function EditModal({
  req,
  onClose,
  onDone,
}: {
  req: RequestRow;
  onClose: () => void;
  onDone: (body: Record<string, unknown>) => void;
}) {
  const [conference, setConference] = useState(req.conference);
  const [startDate, setStartDate] = useState(req.start_date);
  const [endDate, setEndDate] = useState(req.end_date);
  const [rotation, setRotation] = useState(req.rotation || "");
  const [note, setNote] = useState(req.note || "");
  const [pres, setPres] = useState<string[]>(req.presentation_dates.length ? req.presentation_dates : []);
  const [vocab, setVocab] = useState<string[]>([]);
  const [confs, setConfs] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then((m) => {
        setVocab(m.vocab || []);
        setConfs(m.conferences || []);
      })
      .catch(() => {});
  }, []);

  async function save() {
    if (!conference.trim()) return setErr("Conference can't be blank.");
    if (!startDate || !endDate) return setErr("Both dates are required.");
    if (endDate < startDate) return setErr("End date is before start date.");
    setBusy(true);
    await onDone({
      action: "edit",
      conference: conference.trim(),
      start_date: startDate,
      end_date: endDate,
      rotation: rotation || null,
      presentation_dates: pres.filter(Boolean).sort(),
      note: note.trim(),
    });
  }

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <h3>Edit request</h3>
        <p className="sub">
          <b>{req.resident_name}</b> · editing keeps this request in its current status
          {req.status === "needs_revision" ? " (still awaiting the resident)" : ""}.
        </p>
        <div className="field">
          <label>Conference</label>
          <input list="edit-conflist" value={conference} onChange={(e) => setConference(e.target.value)} />
          <datalist id="edit-conflist">
            {confs.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="field2">
          <div className="field">
            <label>Departure</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Return</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Rotation</label>
          <select value={rotation} onChange={(e) => setRotation(e.target.value)}>
            <option value="">— none —</option>
            {vocab.map((l) => (
              <option key={l} value={l}>
                {l}
                {isCoreLabel(l) ? " (core)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Presentation date(s)</label>
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
        <div className="field">
          <label>Resident note</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Revision / comment modal ───────────────────────── */
function RevisionModal({
  req,
  onClose,
  onDone,
}: {
  req: RequestRow;
  onClose: () => void;
  onDone: (body: Record<string, unknown>) => void;
}) {
  const addingNote = req.status === "needs_revision";
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!comment.trim()) return setErr("Please add a note first.");
    setBusy(true);
    await onDone({ action: addingNote ? "comment" : "needs_revision", comment: comment.trim() });
  }

  return (
    <div className="modal-bg show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <h3>{addingNote ? "Add a chief note" : "Send back for revision"}</h3>
        <p className="sub">
          {addingNote ? (
            <>
              <b>{req.resident_name}</b>&rsquo;s request is already flagged for revision. Add a note for the
              other chiefs.
            </>
          ) : (
            <>
              This flags <b>{req.resident_name}</b>&rsquo;s request as <b>Needs revision</b>. Leave a note so the
              other chiefs know why — the resident can then update and resubmit it.
            </>
          )}
        </p>
        {req.chief_comments?.length > 0 && (
          <div className="chief-thread" style={{ marginBottom: 14 }}>
            <div className="ct-label">Earlier notes</div>
            {req.chief_comments.map((c, i) => (
              <div className="ct-item" key={i}>
                <div className="ct-meta">
                  <b>{c.author}</b> · {fmtWhen(c.at)}
                </div>
                <div className="ct-text">{c.text}</div>
              </div>
            ))}
          </div>
        )}
        <div className="field">
          <label>{addingNote ? "Note" : "Reason revision is needed"}</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              addingNote
                ? "e.g. Following up — still waiting on the presentation date."
                : "e.g. Please confirm your exact presentation date and double-check the return date."
            }
            autoFocus
          />
        </div>
        {err && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : addingNote ? "Add note" : "Send back for revision"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Calendar ───────────────────────── */
function Calendar({
  reqs,
  cal,
  setCal,
  onOpen,
}: {
  reqs: RequestRow[];
  cal: { m: number; y: number };
  setCal: (c: { m: number; y: number }) => void;
  onOpen: (id: string) => void;
}) {
  const today = new Date();
  const { m, y } = cal;
  const first = new Date(y, m, 1);
  const pad = first.getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const nWeeks = Math.ceil((pad + dim) / 7);
  const gStart = new Date(y, m, 1 - pad);
  const abs = reqs.filter((r) => r.status !== "denied");
  const mid = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const weeks = [];
  for (let w = 0; w < nWeeks; w++) {
    const wkStart = new Date(gStart);
    wkStart.setDate(gStart.getDate() + w * 7);
    const wkEnd = new Date(wkStart);
    wkEnd.setDate(wkStart.getDate() + 6);
    const days: Date[] = [];
    for (let c = 0; c < 7; c++) {
      const d = new Date(wkStart);
      d.setDate(wkStart.getDate() + c);
      days.push(d);
    }
    type Seg = { r: RequestRow; col: number; span: number; lane: number };
    const segs: Seg[] = [];
    abs.forEach((r) => {
      const s = ymd(r.start_date), e = ymd(r.end_date);
      if (mid(e) < mid(wkStart) || mid(s) > mid(wkEnd)) return;
      const cs = mid(s) < mid(wkStart) ? wkStart : s;
      const ce = mid(e) > mid(wkEnd) ? wkEnd : e;
      const col = Math.round((mid(cs) - mid(wkStart)) / 86400000);
      const endcol = Math.round((mid(ce) - mid(wkStart)) / 86400000);
      segs.push({ r, col, span: endcol - col + 1, lane: 0 });
    });
    segs.sort((a, b) => a.col - b.col || b.span - a.span);
    const laneEnd: number[] = [];
    segs.forEach((sg) => {
      let l = 0;
      while (l < laneEnd.length && laneEnd[l] >= sg.col) l++;
      sg.lane = l;
      laneEnd[l] = sg.col + sg.span - 1;
    });
    const lanes = Math.max(1, laneEnd.length);
    weeks.push({ days, segs, lanes });
  }

  return (
    <>
      <div className="pagehead">
        <h1>Coverage calendar</h1>
        <p>
          Each absence is one bar across the days that resident is away — pending trips are amber and
          dashed, approved are solid blue. When coverage is arranged, the covering resident shows in
          green at the end of the bar. ★ marks a presentation day. <b>Click any bar to open that request.</b>
        </p>
      </div>
      <div className="cal-head">
        <div className="cal-title">
          {MONF[m]} {y}
        </div>
        <button className="iconbtn" onClick={() => move(-1)} aria-label="Previous month">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button className="iconbtn" onClick={() => move(1)} aria-label="Next month">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <button className="btn sm" onClick={() => setCal({ m: today.getMonth(), y: today.getFullYear() })}>
          Today
        </button>
      </div>

      <div className="cal2">
        <div className="cal2-dow">
          {DOW.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        {weeks.map((wk, wi) => (
          <div className="wk" key={wi}>
            <div className="wk-bg">
              {wk.days.map((d, i) => (
                <div key={i} className={(d.getMonth() !== m ? "out " : "") + (sameDay(d, today) ? "today" : "")} />
              ))}
            </div>
            <div className="wk-nums">
              {wk.days.map((d, i) => {
                const hasPres = abs.some((r) => r.presentation_dates.some((p) => sameDay(ymd(p), d)));
                return (
                  <div key={i} className={d.getMonth() !== m ? "out" : ""}>
                    {d.getDate()}
                    {hasPres && <span className="star" title="presentation day">★</span>}
                    {sameDay(d, today) && <span className="tdot" />}
                  </div>
                );
              })}
            </div>
            <div className="wk-bars" style={{ height: wk.lanes * 22 + 4 }}>
              {wk.segs.map((sg, si) => {
                const r = sg.r;
                const covered = r.status === "approved" && r.coverage_needed && r.cover_resident_name;
                return (
                  <div
                    key={si}
                    className={"bar " + (r.status === "approved" ? "approved" : "pending")}
                    role="button"
                    tabIndex={0}
                    style={{
                      left: `calc(${sg.col}/7*100% + 2px)`,
                      width: `calc(${sg.span}/7*100% - 4px)`,
                      top: sg.lane * 22,
                    }}
                    title={`${r.resident_name} · ${r.conference} · ${fmtRangeISO(r.start_date, r.end_date)}${
                      covered ? " · covered by " + r.cover_resident_name : r.status === "pending" ? " · pending" : ""
                    } — click to open`}
                    onClick={() => onOpen(r.id)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(r.id)}
                  >
                    <span className="lbl">
                      {surnameOf(r.resident_name)} · {confShort(r.conference)}
                    </span>
                    {covered && <span className="cov">{surnameOf(r.cover_resident_name!)}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="legend">
        <span>
          <i className="lg-abs" /> Out (approved)
        </span>
        <span>
          <i className="lg-pend" /> Pending
        </span>
        <span>
          <i className="lg-cov2" /> Covered by (green)
        </span>
        <span>
          <i className="lg-pres" /> ★ Presentation day
        </span>
      </div>
    </>
  );

  function move(n: number) {
    let mm = m + n, yy = y;
    if (mm < 0) { mm = 11; yy--; }
    if (mm > 11) { mm = 0; yy++; }
    setCal({ m: mm, y: yy });
  }
}

/* ───────────────────────── Conferences ───────────────────────── */
function Conferences({ reqs }: { reqs: RequestRow[] }) {
  const confs = [...new Set(reqs.map((r) => r.conference))];
  const [active, setActive] = useState(confs[0] || "");
  const rows = reqs
    .filter((r) => r.conference === active && r.status !== "denied")
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const coverCount = rows.filter((r) => r.coverage_needed).length;
  const totalDays = rows.reduce((s, r) => s + dayCountISO(r.start_date, r.end_date), 0);

  return (
    <>
      <div className="pagehead">
        <h1>Conference summary</h1>
        <p>
          Pick a conference to see everyone going, the rotation each is leaving, and who&rsquo;s
          covering — the roster the chiefs need when planning the week.
        </p>
      </div>
      <div className="confpick">
        {confs.map((c) => {
          const n = reqs.filter((r) => r.conference === c && r.status !== "denied").length;
          return (
            <button key={c} className={c === active ? "on" : ""} onClick={() => setActive(c)}>
              <div className="cn">{c}</div>
              <div className="cd">{n} going</div>
            </button>
          );
        })}
      </div>
      {active && (
        <>
          <div className="stats">
            <div className="card stat">
              <div className="k">Residents attending</div>
              <div className="v accent">{rows.length}</div>
              <div className="d">{active}</div>
            </div>
            <div className="card stat">
              <div className="k">Coverage pulls needed</div>
              <div className={"v " + (coverCount ? "ok" : "")}>{coverCount}</div>
              <div className="d">core rotations covered</div>
            </div>
            <div className="card stat">
              <div className="k">Total absence-days</div>
              <div className="v">{totalDays}</div>
              <div className="d">across all attendees</div>
            </div>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Dates</th>
                  <th>Rotation leaving</th>
                  <th>Presentation</th>
                  <th>Covered by</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="person">
                        <Avatar name={r.resident_name} />
                        <div>
                          <div className="nm">{r.resident_name}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                      {fmtRangeISO(r.start_date, r.end_date)}
                    </td>
                    <td>
                      {r.rotation} <CoreChip rot={r.rotation} />
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                      {r.presentation_dates.length ? (
                        r.presentation_dates.map(fmtISO).join(", ")
                      ) : (
                        <span style={{ color: "var(--warn-ink)" }}>⚑ TBD</span>
                      )}
                    </td>
                    <td>
                      {r.status === "approved" ? (
                        r.coverage_needed ? (
                          <div className="person">
                            <Avatar name={r.cover_resident_name || "?"} />
                            <div>
                              <div className="nm" style={{ fontSize: 13.5 }}>
                                {r.cover_resident_name}
                              </div>
                              <div className="pgy">from {r.cover_from || "—"}</div>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "var(--ink-3)" }}>— none —</span>
                        )
                      ) : (
                        <span style={{ color: "var(--ink-3)" }}>pending</span>
                      )}
                    </td>
                    <td>
                      <StatusChip s={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

/* ───────────────────────── Residents (tallies) ───────────────────────── */
function Residents({ reqs, residents }: { reqs: RequestRow[]; residents: Resident[] }) {
  const approved = reqs.filter((r) => r.status === "approved");
  const rows = residents
    .filter((r) => r.active)
    .map((res) => {
      const mine = approved.filter((r) => r.resident_id === res.id);
      const used = mine.reduce((s, r) => s + dayCountISO(r.start_date, r.end_date), 0);
      const pulled = approved.filter((r) => r.coverage_needed && r.cover_resident_id === res.id).length;
      return { ...res, used, pulled, trips: mine.length };
    })
    .sort((a, b) => b.used - a.used || b.pulled - a.pulled);
  const maxUsed = Math.max(4, ...rows.map((r) => r.used));
  const maxPull = Math.max(2, ...rows.map((r) => r.pulled));
  const totalUsed = rows.reduce((s, r) => s + r.used, 0);
  const totalPull = rows.reduce((s, r) => s + r.pulled, 0);

  return (
    <>
      <div className="pagehead">
        <h1>Residents</h1>
        <p>
          Running tallies for the academic year: conference-absence days each resident has used
          (approved requests), and how many times each has been pulled to cover someone else.
        </p>
      </div>
      <div className="stats">
        <div className="card stat">
          <div className="k">Total absence-days approved</div>
          <div className="v accent">{totalUsed}</div>
          <div className="d">across all residents</div>
        </div>
        <div className="card stat">
          <div className="k">Total coverage pulls</div>
          <div className="v ok">{totalPull}</div>
          <div className="d">this academic year</div>
        </div>
        <div className="card stat">
          <div className="k">Residents tracked</div>
          <div className="v">{rows.length}</div>
          <div className="d">Internal Medicine</div>
        </div>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Resident</th>
              <th>Conf. trips</th>
              <th style={{ width: 150 }}>Absence-days used</th>
              <th style={{ width: 150 }}>Times pulled to cover</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="person">
                    <Avatar name={r.full_name} />
                    <div>
                      <div className="nm">{r.full_name}</div>
                      <div className="pgy">PGY-{r.pgy}</div>
                    </div>
                  </div>
                </td>
                <td className="num">{r.trips}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-mono)", minWidth: 20, textAlign: "right", fontWeight: 600 }}>
                      {r.used}
                    </span>
                    <div className="bar" style={{ flex: 1 }}>
                      <i style={{ width: (r.used / maxUsed) * 100 + "%" }} />
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-mono)", minWidth: 20, textAlign: "right", fontWeight: 600 }}>
                      {r.pulled}
                    </span>
                    <div className="bar g" style={{ flex: 1 }}>
                      <i style={{ width: (r.pulled / maxPull) * 100 + "%" }} />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ───────────────────────── Admin ───────────────────────── */
function Admin({
  residents,
  refreshResidents,
  refreshAll,
}: {
  residents: Resident[];
  refreshResidents: () => Promise<void>;
  refreshAll: () => Promise<void>;
}) {
  const [nf, setNf] = useState({ full_name: "", sched_key: "", pgy: "1", clinic_cohort: "" });
  const [csv, setCsv] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addResident() {
    setBusy(true);
    const res = await fetch("/api/admin/residents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(nf),
    });
    setBusy(false);
    if (res.ok) {
      setNf({ full_name: "", sched_key: "", pgy: "1", clinic_cohort: "" });
      await refreshResidents();
    } else setMsg((await res.json()).error || "Failed to add.");
  }
  async function patch(id: string, body: Record<string, unknown>) {
    await fetch("/api/admin/residents", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    await refreshResidents();
  }
  async function deactivate(id: string) {
    await fetch(`/api/admin/residents?id=${id}`, { method: "DELETE" });
    await refreshResidents();
  }
  async function uploadSchedule() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    const d = await res.json();
    setBusy(false);
    if (res.ok) {
      setMsg(`Loaded ${d.residents} residents and ${d.assignments} assignments.`);
      setCsv("");
      await refreshResidents();
      await refreshAll();
    } else setMsg(d.error || "Upload failed.");
  }

  return (
    <>
      <div className="pagehead">
        <h1>Admin</h1>
        <p>
          Manage the roster and load a new academic year&rsquo;s schedule. New residents come in as
          &ldquo;Last, Initial&rdquo; from the grid — edit their full name here. Everything downstream
          (auto-detected rotations, coverage, calendar) recomputes off this data.
        </p>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, margin: "0 0 12px" }}>Add a resident</h3>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr .7fr 1fr auto", gap: 10, alignItems: "end" }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Full name</label>
            <input value={nf.full_name} onChange={(e) => setNf({ ...nf, full_name: e.target.value })} placeholder="First Last" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Schedule key</label>
            <input value={nf.sched_key} onChange={(e) => setNf({ ...nf, sched_key: e.target.value })} placeholder="Last, F" />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>PGY</label>
            <input value={nf.pgy} onChange={(e) => setNf({ ...nf, pgy: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Cohort</label>
            <input value={nf.clinic_cohort} onChange={(e) => setNf({ ...nf, clinic_cohort: e.target.value })} placeholder="CCMA" />
          </div>
          <button className="btn primary" disabled={busy} onClick={addResident}>
            Add
          </button>
        </div>
        {msg && <div style={{ marginTop: 10, fontSize: 13, color: "var(--ink-2)" }}>{msg}</div>}
      </div>

      <div className="tablewrap" style={{ marginBottom: 24 }}>
        <table>
          <thead>
            <tr>
              <th>Resident</th>
              <th>Key</th>
              <th>PGY</th>
              <th>Cohort</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {residents.map((r) => (
              <tr key={r.id} style={{ opacity: r.active ? 1 : 0.5 }}>
                <td>
                  <input
                    defaultValue={r.full_name}
                    onBlur={(e) => e.target.value !== r.full_name && patch(r.id, { full_name: e.target.value })}
                    style={{ width: "100%", border: "none", background: "transparent", color: "var(--ink)", fontWeight: 600 }}
                  />
                </td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--ink-3)" }}>{r.sched_key}</td>
                <td className="num">{r.pgy}</td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{r.clinic_cohort || "—"}</td>
                <td>{r.active ? "✓" : "—"}</td>
                <td>
                  {r.active ? (
                    <button className="btn sm ghost-danger" onClick={() => deactivate(r.id)}>
                      Remove
                    </button>
                  ) : (
                    <button className="btn sm" onClick={() => patch(r.id, { active: true })}>
                      Restore
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 16, margin: "0 0 6px" }}>Load a new year&rsquo;s schedule</h3>
        <p style={{ fontSize: 13, color: "var(--ink-2)", margin: "0 0 12px", maxWidth: "70ch" }}>
          Paste the block grid as CSV — columns: <code>Class, Resident, ClinicCohort, B1 … B13</code>.
          Existing residents keep their full names; new ones are added as &ldquo;Last, Initial&rdquo;
          for you to rename above; residents not in the file are deactivated. This replaces all block
          assignments.
        </p>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder='"Class","Resident","ClinicCohort","B1 (7/1-7/26)",…'
          style={{ width: "100%", minHeight: 120, fontFamily: "var(--font-mono)", fontSize: 12 }}
        />
        <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
          <button className="btn primary" disabled={busy || !csv.trim()} onClick={uploadSchedule}>
            {busy ? "Loading…" : "Replace schedule"}
          </button>
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
            Block dates are kept from the current year unless you change them in the database.
          </span>
        </div>
      </div>
    </>
  );
}
