// ============================================================================
// MOCK BACKEND
// ----------------------------------------------------------------------------
// Every function here simulates a real backend call: network latency, async
// results, and persistence (localStorage). When you build the real backend,
// replace the bodies of these functions with fetch()/RPC calls — the
// signatures and returned shapes are the contract the UI already depends on.
// ============================================================================

import type { CanvasDoc, Participant, Session, SessionState } from "./types";
import { emptyCanvas } from "./types";

const STORE_KEY = "sdip:v1:sessions";
const MIN_LATENCY = 180;
const MAX_LATENCY = 450;

const delay = () =>
  new Promise<void>((r) => setTimeout(r, MIN_LATENCY + Math.random() * (MAX_LATENCY - MIN_LATENCY)));

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const token = () => crypto.randomUUID().replaceAll("-", "").slice(0, 24);

function readStore(): Session[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return seed();
    return JSON.parse(raw) as Session[];
  } catch {
    return seed();
  }
}

function writeStore(sessions: Session[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(sessions));
}

function seed(): Session[] {
  const demo: Session = {
    id: "demo-session",
    title: "Design a URL shortener",
    prompt:
      "Design a URL shortener like bit.ly. Requirements: 100M new URLs per month, 10:1 read/write ratio, links expire after 5 years. Focus on the data model, API design, and how you would scale reads.",
    state: "live",
    candidateToken: "demo-token",
    candidateEditingLocked: false,
    createdAt: Date.now() - 86400_000,
    updatedAt: Date.now() - 3600_000,
    canvas: {
      nodes: [
        { id: "n1", type: "client", x: -320, y: -60, w: 140, h: 80, label: "Client" },
        { id: "n2", type: "load-balancer", x: -80, y: -60, w: 150, h: 80, label: "Load Balancer" },
        { id: "n3", type: "service", x: 180, y: -60, w: 150, h: 80, label: "API Service" },
        { id: "n4", type: "database", x: 180, y: 120, w: 150, h: 90, label: "Postgres" },
        { id: "n5", type: "cache", x: 420, y: -60, w: 140, h: 80, label: "Redis Cache" },
      ],
      connectors: [
        { id: "c1", from: "n1", to: "n2", label: "HTTPS", style: "straight", dashed: false },
        { id: "c2", from: "n2", to: "n3", label: "", style: "straight", dashed: false },
        { id: "c3", from: "n3", to: "n4", label: "read/write", style: "elbow", dashed: false },
        { id: "c4", from: "n3", to: "n5", label: "lookup", style: "straight", dashed: true },
      ],
      strokes: [],
    },
  };
  writeStore([demo]);
  return [demo];
}

// --- Sessions ---------------------------------------------------------------

export async function listSessions(): Promise<Session[]> {
  await delay();
  return readStore().sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createSession(input: { title: string; prompt: string }): Promise<Session> {
  await delay();
  const sessions = readStore();
  const session: Session = {
    id: uid(),
    title: input.title || "Untitled interview",
    prompt: input.prompt,
    state: "draft",
    candidateToken: token(),
    candidateEditingLocked: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    canvas: emptyCanvas(),
  };
  sessions.push(session);
  writeStore(sessions);
  return session;
}

export async function getSession(id: string): Promise<Session | null> {
  await delay();
  return readStore().find((s) => s.id === id) ?? null;
}

export async function updateSession(
  id: string,
  patch: Partial<Pick<Session, "title" | "prompt" | "state" | "candidateEditingLocked">>,
): Promise<Session | null> {
  await delay();
  const sessions = readStore();
  const s = sessions.find((x) => x.id === id);
  if (!s) return null;
  Object.assign(s, patch, { updatedAt: Date.now() });
  writeStore(sessions);
  return s;
}

export async function saveCanvas(id: string, canvas: CanvasDoc): Promise<void> {
  // Shorter latency: this fires on every autosave debounce.
  await new Promise<void>((r) => setTimeout(r, 80));
  const sessions = readStore();
  const s = sessions.find((x) => x.id === id);
  if (!s) return;
  s.canvas = canvas;
  s.updatedAt = Date.now();
  writeStore(sessions);
}

export async function rotateCandidateLink(id: string): Promise<Session | null> {
  await delay();
  const sessions = readStore();
  const s = sessions.find((x) => x.id === id);
  if (!s) return null;
  s.candidateToken = token();
  s.updatedAt = Date.now();
  writeStore(sessions);
  return s;
}

export async function duplicateSession(id: string): Promise<Session | null> {
  await delay();
  const sessions = readStore();
  const s = sessions.find((x) => x.id === id);
  if (!s) return null;
  const copy: Session = {
    ...structuredClone(s),
    id: uid(),
    title: `${s.title} (copy)`,
    state: "draft",
    candidateToken: token(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  sessions.push(copy);
  writeStore(sessions);
  return copy;
}

// --- Candidate join ---------------------------------------------------------

export type JoinResult =
  | { ok: true; session: Session; participant: Participant }
  | { ok: false; reason: string };

export async function joinByToken(candidateToken: string, displayName: string): Promise<JoinResult> {
  await delay();
  const s = readStore().find((x) => x.candidateToken === candidateToken);
  if (!s) return { ok: false, reason: "This link is invalid or has been revoked." };
  if (s.state === "ended") return { ok: false, reason: "This interview has already ended." };
  if (s.state === "archived") return { ok: false, reason: "This interview is no longer available." };
  return {
    ok: true,
    session: s,
    participant: {
      id: uid(),
      name: displayName,
      role: "candidate",
      color: "#7dd3fc",
      isSelf: true,
    },
  };
}

// --- Mock presence ----------------------------------------------------------
// The real backend will stream presence over a realtime channel. For now the
// workspace shows these simulated remote participants.

export function mockRemoteParticipants(): Participant[] {
  return [
    { id: "mock-1", name: "Ava (Interviewer)", role: "interviewer", color: "#fbbf24", isMock: true },
    { id: "mock-2", name: "Ravi (Observer)", role: "observer", color: "#a78bfa", isMock: true },
  ];
}
