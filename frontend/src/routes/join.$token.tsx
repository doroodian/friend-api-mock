import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Presentation } from "lucide-react";
import { joinByToken } from "@/lib/mock-api";

export const Route = createFileRoute("/join/$token")({
  head: () => ({
    meta: [
      { title: "Join Interview — Whiteboard Interviews" },
      { name: "description", content: "Join a live system-design interview session." },
      { property: "og:title", content: "Join Interview — Whiteboard Interviews" },
      { property: "og:description", content: "Join a live system-design interview session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinLobby,
});

function JoinLobby() {
  const { token } = useParams({ from: "/join/$token" });
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const join = useMutation({
    mutationFn: () => joinByToken(token, name.trim()),
    onSuccess: (result) => {
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      // Candidates land on the same workspace; the mock backend treats them
      // as guests. A real backend would issue a session token here.
      navigate({ to: "/session/$id", params: { id: result.session.id } });
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Presentation className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Whiteboard Interviews</h1>
            <p className="text-sm text-muted-foreground">You've been invited to an interview</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            join.mutate();
          }}
        >
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Your display name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Doe"
            required
            className="mb-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          {error && (
            <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={join.isPending || !name.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {join.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Join interview
          </button>
        </form>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
          Your canvas activity is saved and may be reviewed by the interviewer after the session.
        </p>
      </div>
    </div>
  );
}
