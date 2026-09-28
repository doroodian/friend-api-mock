import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Loader2, Plus, Presentation } from "lucide-react";
import { createSession, duplicateSession, listSessions } from "@/lib/mock-api";
import type { SessionState } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Whiteboard Interviews — System Design Interview Platform" },
      { name: "description", content: "Run live system-design interviews on a shared real-time canvas." },
      { property: "og:title", content: "Whiteboard Interviews — System Design Interview Platform" },
      { property: "og:description", content: "Run live system-design interviews on a shared real-time canvas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const stateBadge: Record<SessionState, string> = {
  draft: "bg-secondary text-secondary-foreground",
  live: "bg-emerald-500/15 text-emerald-400",
  ended: "bg-amber-500/15 text-amber-400",
  archived: "bg-muted text-muted-foreground",
};

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const { data: sessions, isLoading } = useQuery({ queryKey: ["sessions"], queryFn: listSessions });

  const create = useMutation({
    mutationFn: createSession,
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      navigate({ to: "/session/$id", params: { id: s.id } });
    },
  });

  const duplicate = useMutation({
    mutationFn: duplicateSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Presentation className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Whiteboard Interviews</h1>
            <p className="text-sm text-muted-foreground">System design interview platform</p>
          </div>
        </div>
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New interview
        </button>
      </header>

      {formOpen && (
        <form
          className="mb-8 rounded-xl border border-border bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ title, prompt });
          }}
        >
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Design a URL shortener"
            className="mb-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Problem statement (optional)</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Requirements, scale targets, constraints…"
            className="mb-4 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={create.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create session
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions…
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions?.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
              <Link to="/session/$id" params={{ id: s.id }} className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium hover:underline">{s.title}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", stateBadge[s.state])}>
                    {s.state}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">{s.prompt || "No problem statement"}</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Updated {new Date(s.updatedAt).toLocaleString()}
                </p>
              </Link>
              <button
                title="Duplicate as template"
                onClick={() => duplicate.mutate(s.id)}
                className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Copy className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
