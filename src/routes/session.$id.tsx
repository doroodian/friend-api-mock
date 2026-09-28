import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  Lock,
  LockOpen,
  RefreshCw,
  Square,
} from "lucide-react";
import { Board } from "@/components/Board";
import {
  getSession,
  mockRemoteParticipants,
  rotateCandidateLink,
  saveCanvas,
  updateSession,
} from "@/lib/mock-api";
import type { CanvasDoc } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/session/$id")({
  head: () => ({
    meta: [
      { title: "Interview Session — Whiteboard Interviews" },
      { name: "description", content: "Live system-design interview canvas." },
      { property: "og:title", content: "Interview Session — Whiteboard Interviews" },
      { property: "og:description", content: "Live system-design interview canvas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SessionWorkspace,
});

function SessionWorkspace() {
  const { id } = useParams({ from: "/session/$id" });
  const queryClient = useQueryClient();
  const [doc, setDoc] = useState<CanvasDoc | null>(null);
  const [copied, setCopied] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", id],
    queryFn: () => getSession(id),
  });

  // Load canvas doc once the session arrives
  useEffect(() => {
    if (session && !doc) setDoc(session.canvas);
  }, [session, doc]);

  // Debounced autosave (mock backend call)
  const handleChange = (next: CanvasDoc) => {
    setDoc(next);
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveCanvas(id, next);
      setSaveState("saved");
    }, 800);
  };

  const patch = useMutation({
    mutationFn: (p: Parameters<typeof updateSession>[1]) => updateSession(id, p),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session", id] }),
  });

  const rotate = useMutation({
    mutationFn: () => rotateCandidateLink(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session", id] }),
  });

  if (isLoading || !session || !doc) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading session…
      </div>
    );
  }

  const candidateUrl = `${window.location.origin}/join/${session.candidateToken}`;
  const isEnded = session.state === "ended";
  const participants = [
    { id: "me", name: "You (Owner)", role: "interviewer" as const, color: "#fbbf24", isSelf: true },
    ...mockRemoteParticipants(),
  ];

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-2">
        <Link to="/" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold">{session.title}</h1>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                session.state === "live"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : isEnded
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-secondary text-secondary-foreground",
              )}
            >
              {session.state}
            </span>
            <span className="text-xs text-muted-foreground">
              {saveState === "saving" ? "Saving…" : "All changes saved"}
            </span>
          </div>
        </div>

        {/* Candidate link */}
        <div className="hidden items-center gap-1 rounded-md border border-border bg-background px-2 py-1 md:flex">
          <span className="max-w-56 truncate text-xs text-muted-foreground">{candidateUrl}</span>
          <button
            title="Copy candidate link"
            onClick={() => {
              navigator.clipboard.writeText(candidateUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            title="Rotate link (revokes the old one)"
            onClick={() => rotate.mutate()}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", rotate.isPending && "animate-spin")} />
          </button>
        </div>

        <button
          onClick={() => patch.mutate({ candidateEditingLocked: !session.candidateEditingLocked })}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {session.candidateEditingLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
          {session.candidateEditingLocked ? "Candidates locked" : "Candidates can edit"}
        </button>

        {session.state !== "ended" ? (
          <button
            onClick={() => patch.mutate({ state: session.state === "live" ? "ended" : "live" })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
              session.state === "live"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            <Square className="h-3 w-3" />
            {session.state === "live" ? "End interview" : "Go live"}
          </button>
        ) : (
          <button
            onClick={() => patch.mutate({ state: "live" })}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
          >
            Reopen
          </button>
        )}
      </header>

      {/* Prompt banner */}
      {session.prompt && (
        <div className="border-b border-border bg-secondary/40 px-4 py-2">
          <p className="mx-auto max-w-5xl truncate text-xs text-muted-foreground" title={session.prompt}>
            <span className="font-semibold text-foreground">Prompt:</span> {session.prompt}
          </p>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <Board doc={doc} onChange={handleChange} readOnly={isEnded} />

        {/* Participants */}
        <aside className="hidden w-52 shrink-0 flex-col border-l border-border bg-card p-3 lg:flex">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Participants
          </p>
          <ul className="space-y-2">
            {participants.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="truncate">{p.name}</span>
              </li>
            ))}
          </ul>
          <p className="mt-auto pt-4 text-[10px] leading-relaxed text-muted-foreground/70">
            Presence and cursors are simulated. The mock backend lives in{" "}
            <code className="rounded bg-secondary px-1">src/lib/mock-api.ts</code> — swap it for real API
            calls later.
          </p>
        </aside>
      </div>
    </div>
  );
}
