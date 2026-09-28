import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightLeft,
  Eraser,
  Hand,
  Highlighter,
  Maximize,
  Minus,
  MousePointer2,
  Pen,
  Plus,
  Redo2,
  StickyNote,
  Type,
  Undo2,
} from "lucide-react";
import { catalogItem, CATALOG } from "@/lib/catalog";
import type { CanvasDoc, CanvasNode, Connector, Stroke } from "@/lib/types";
import { cn } from "@/lib/utils";

export type Tool = "select" | "pan" | "connect" | "pen" | "highlighter" | "eraser" | "note" | "text";

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

interface BoardProps {
  doc: CanvasDoc;
  onChange: (doc: CanvasDoc) => void;
  readOnly?: boolean;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const PEN_COLORS = ["#f8fafc", "#fbbf24", "#7dd3fc", "#f472b6", "#86efac"];

function nodeCenter(n: CanvasNode) {
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

function connectorPath(from: CanvasNode, to: CanvasNode, style: Connector["style"]) {
  const a = nodeCenter(from);
  const b = nodeCenter(to);
  if (style === "elbow") {
    const midX = (a.x + b.x) / 2;
    return `M ${a.x} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y}`;
  }
  if (style === "curved") {
    const dx = Math.max(60, Math.abs(b.x - a.x) / 2);
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  }
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

export function Board({ doc, onChange, readOnly }: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<string[]>([]);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [penColor, setPenColor] = useState(PEN_COLORS[1]);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);

  const dragRef = useRef<{
    kind: "pan" | "node" | "draw";
    startX: number;
    startY: number;
    camStart?: Camera;
    nodeStarts?: Map<string, { x: number; y: number }>;
  } | null>(null);

  // Undo / redo history of canvas docs
  const historyRef = useRef<{ past: CanvasDoc[]; future: CanvasDoc[] }>({ past: [], future: [] });
  const [, forceRender] = useState(0);

  const commit = useCallback(
    (next: CanvasDoc) => {
      historyRef.current.past.push(doc);
      if (historyRef.current.past.length > 80) historyRef.current.past.shift();
      historyRef.current.future = [];
      onChange(next);
    },
    [doc, onChange],
  );

  const undo = useCallback(() => {
    const prev = historyRef.current.past.pop();
    if (!prev) return;
    historyRef.current.future.push(doc);
    onChange(prev);
    forceRender((n) => n + 1);
  }, [doc, onChange]);

  const redo = useCallback(() => {
    const next = historyRef.current.future.pop();
    if (!next) return;
    historyRef.current.past.push(doc);
    onChange(next);
    forceRender((n) => n + 1);
  }, [doc, onChange]);

  // Screen → world coordinates
  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current!.getBoundingClientRect();
      return {
        x: (clientX - rect.left - camera.x) / camera.zoom,
        y: (clientY - rect.top - camera.y) / camera.zoom,
      };
    },
    [camera],
  );

  const addNode = useCallback(
    (type: string) => {
      const def = catalogItem(type);
      const rect = containerRef.current!.getBoundingClientRect();
      const center = toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const node: CanvasNode = {
        id: uid(),
        type,
        x: center.x - (def?.w ?? 150) / 2 + (Math.random() * 60 - 30),
        y: center.y - (def?.h ?? 84) / 2 + (Math.random() * 60 - 30),
        w: def?.w ?? 150,
        h: def?.h ?? 84,
        label: type === "note" ? "Double-click to edit" : type === "text" ? "Text" : (def?.label ?? "Component"),
      };
      commit({ ...doc, nodes: [...doc.nodes, node] });
      setSelected([node.id]);
      setTool("select");
    },
    [doc, commit, toWorld],
  );

  // --- Pointer handling -----------------------------------------------------

  const onBackgroundDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    const p = toWorld(e.clientX, e.clientY);
    if (tool === "pan" || e.button === 1) {
      dragRef.current = { kind: "pan", startX: e.clientX, startY: e.clientY, camStart: camera };
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }
    if (tool === "pen" || tool === "highlighter") {
      const stroke: Stroke = {
        id: uid(),
        points: [p.x, p.y],
        color: penColor,
        width: tool === "highlighter" ? 14 : 3,
        tool,
      };
      setActiveStroke(stroke);
      dragRef.current = { kind: "draw", startX: p.x, startY: p.y };
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }
    if (tool === "note" || tool === "text") {
      addNode(tool);
      return;
    }
    // select tool: click empty space clears selection
    setSelected([]);
  };

  const onNodeDown = (e: React.PointerEvent, node: CanvasNode) => {
    if (readOnly) return;
    e.stopPropagation();
    if (tool === "connect") {
      if (!connectFrom) {
        setConnectFrom(node.id);
      } else if (connectFrom !== node.id) {
        const conn: Connector = {
          id: uid(),
          from: connectFrom,
          to: node.id,
          label: "",
          style: "straight",
          dashed: false,
        };
        commit({ ...doc, connectors: [...doc.connectors, conn] });
        setConnectFrom(null);
      }
      return;
    }
    if (tool === "eraser") {
      commit({
        ...doc,
        nodes: doc.nodes.filter((n) => n.id !== node.id),
        connectors: doc.connectors.filter((c) => c.from !== node.id && c.to !== node.id),
      });
      return;
    }
    if (tool !== "select") return;

    const nextSelected = e.shiftKey
      ? selected.includes(node.id)
        ? selected.filter((id) => id !== node.id)
        : [...selected, node.id]
      : selected.includes(node.id)
        ? selected
        : [node.id];
    setSelected(nextSelected);

    const starts = new Map<string, { x: number; y: number }>();
    for (const id of nextSelected) {
      const n = doc.nodes.find((x) => x.id === id);
      if (n) starts.set(id, { x: n.x, y: n.y });
    }
    dragRef.current = { kind: "node", startX: e.clientX, startY: e.clientY, nodeStarts: starts };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pan" && drag.camStart) {
      setCamera({
        ...drag.camStart,
        x: drag.camStart.x + (e.clientX - drag.startX),
        y: drag.camStart.y + (e.clientY - drag.startY),
      });
    } else if (drag.kind === "node" && drag.nodeStarts) {
      const dx = (e.clientX - drag.startX) / camera.zoom;
      const dy = (e.clientY - drag.startY) / camera.zoom;
      onChange({
        ...doc,
        nodes: doc.nodes.map((n) => {
          const s = drag.nodeStarts!.get(n.id);
          return s ? { ...n, x: s.x + dx, y: s.y + dy } : n;
        }),
      });
    } else if (drag.kind === "draw" && activeStroke) {
      const p = toWorld(e.clientX, e.clientY);
      setActiveStroke({ ...activeStroke, points: [...activeStroke.points, p.x, p.y] });
    }
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    if (drag?.kind === "draw" && activeStroke && activeStroke.points.length > 3) {
      commit({ ...doc, strokes: [...doc.strokes, activeStroke] });
    }
    if (drag?.kind === "node") {
      // persist the drag as one undo step
      historyRef.current.past.push(doc);
      historyRef.current.future = [];
      onChange({ ...doc });
    }
    dragRef.current = null;
    setActiveStroke(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // pinch / ctrl+scroll = zoom toward cursor
      const rect = containerRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const zoom = Math.min(3, Math.max(0.2, camera.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
      setCamera({
        zoom,
        x: mx - ((mx - camera.x) / camera.zoom) * zoom,
        y: my - ((my - camera.y) / camera.zoom) * zoom,
      });
    } else {
      setCamera({ ...camera, x: camera.x - e.deltaX, y: camera.y - e.deltaY });
    }
  };

  const zoomToFit = () => {
    const rect = containerRef.current!.getBoundingClientRect();
    if (doc.nodes.length === 0) {
      setCamera({ x: rect.width / 2, y: rect.height / 2, zoom: 1 });
      return;
    }
    const xs = doc.nodes.flatMap((n) => [n.x, n.x + n.w]);
    const ys = doc.nodes.flatMap((n) => [n.y, n.y + n.h]);
    const minX = Math.min(...xs) - 80;
    const maxX = Math.max(...xs) + 80;
    const minY = Math.min(...ys) - 80;
    const maxY = Math.max(...ys) + 80;
    const zoom = Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY), 1.5);
    setCamera({
      zoom,
      x: rect.width / 2 - ((minX + maxX) / 2) * zoom,
      y: rect.height / 2 - ((minY + maxY) / 2) * zoom,
    });
  };

  // Center the camera on first mount
  useEffect(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setCamera({ x: rect.width / 2, y: rect.height / 2, zoom: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selected.length && !readOnly) {
        commit({
          ...doc,
          nodes: doc.nodes.filter((n) => !selected.includes(n.id)),
          connectors: doc.connectors.filter(
            (c) => !selected.includes(c.id) && !selected.includes(c.from) && !selected.includes(c.to),
          ),
          strokes: doc.strokes.filter((s) => !selected.includes(s.id)),
        });
        setSelected([]);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, doc, commit, undo, redo, readOnly]);

  const nodeById = useMemo(() => new Map(doc.nodes.map((n) => [n.id, n])), [doc.nodes]);

  const tools: { id: Tool; icon: typeof Pen; label: string }[] = [
    { id: "select", icon: MousePointer2, label: "Select (V)" },
    { id: "pan", icon: Hand, label: "Pan (H)" },
    { id: "connect", icon: ArrowRightLeft, label: "Connect (C)" },
    { id: "pen", icon: Pen, label: "Pen (P)" },
    { id: "highlighter", icon: Highlighter, label: "Highlighter" },
    { id: "eraser", icon: Eraser, label: "Eraser (E)" },
    { id: "note", icon: StickyNote, label: "Sticky note (N)" },
    { id: "text", icon: Type, label: "Text (T)" },
  ];

  return (
    <div className="relative flex h-full min-h-0 flex-1">
      {/* Palette */}
      {!readOnly && (
        <aside className="w-52 shrink-0 overflow-y-auto border-r border-border bg-card p-3 scrollbar-thin">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Components
          </p>
          {CATALOG.map((cat) => (
            <div key={cat.name} className="mb-3">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {cat.name}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {cat.items.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => addNode(item.type)}
                    className="flex flex-col items-center gap-1 rounded-md border border-border bg-secondary/50 px-1 py-2 text-[10px] text-secondary-foreground transition-colors hover:border-primary/60 hover:bg-secondary"
                  >
                    <item.icon className="h-4 w-4 text-accent" />
                    <span className="text-center leading-tight">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className={cn(
          "canvas-grid relative min-w-0 flex-1 touch-none overflow-hidden",
          tool === "pan" ? "cursor-grab" : tool === "connect" ? "cursor-crosshair" : "cursor-default",
        )}
        style={{ backgroundSize: `${24 * camera.zoom}px ${24 * camera.zoom}px`, backgroundPosition: `${camera.x}px ${camera.y}px` }}
        onPointerDown={onBackgroundDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}
        >
          {/* Connectors + strokes */}
          <svg className="absolute left-0 top-0 overflow-visible" width="1" height="1">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 1 L 9 5 L 0 9" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </marker>
            </defs>
            {doc.connectors.map((c) => {
              const a = nodeById.get(c.from);
              const b = nodeById.get(c.to);
              if (!a || !b) return null;
              const d = connectorPath(a, b, c.style);
              const midA = nodeCenter(a);
              const midB = nodeCenter(b);
              const isSel = selected.includes(c.id);
              return (
                <g
                  key={c.id}
                  className={cn("text-muted-foreground", isSel && "text-primary")}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (tool === "eraser") {
                      commit({ ...doc, connectors: doc.connectors.filter((x) => x.id !== c.id) });
                    } else {
                      setSelected([c.id]);
                    }
                  }}
                >
                  <path d={d} fill="none" stroke="transparent" strokeWidth="14" className="cursor-pointer" />
                  <path
                    d={d}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={isSel ? 2.5 : 1.75}
                    strokeDasharray={c.dashed ? "7 5" : undefined}
                    markerEnd="url(#arrow)"
                    className="pointer-events-none"
                  />
                  {c.label && (
                    <text
                      x={(midA.x + midB.x) / 2}
                      y={(midA.y + midB.y) / 2 - 8}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[11px]"
                    >
                      {c.label}
                    </text>
                  )}
                </g>
              );
            })}
            {doc.strokes.map((s) => (
              <polyline
                key={s.id}
                points={s.points.join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={s.tool === "highlighter" ? 0.35 : 1}
                className="cursor-pointer"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (tool === "eraser") commit({ ...doc, strokes: doc.strokes.filter((x) => x.id !== s.id) });
                  else setSelected([s.id]);
                }}
              />
            ))}
            {activeStroke && (
              <polyline
                points={activeStroke.points.join(" ")}
                fill="none"
                stroke={activeStroke.color}
                strokeWidth={activeStroke.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={activeStroke.tool === "highlighter" ? 0.35 : 1}
              />
            )}
          </svg>

          {/* Nodes */}
          {doc.nodes.map((n) => {
            const def = catalogItem(n.type);
            const Icon = def?.icon;
            const isSel = selected.includes(n.id);
            const isConnectSrc = connectFrom === n.id;
            const isNote = n.type === "note";
            const isText = n.type === "text";
            const isBoundary = n.type === "boundary";
            return (
              <div
                key={n.id}
                onPointerDown={(e) => onNodeDown(e, n)}
                onDoubleClick={() => !readOnly && setEditingNode(n.id)}
                className={cn(
                  "absolute flex select-none flex-col items-center justify-center gap-1 rounded-lg border px-2 text-center shadow-sm transition-shadow",
                  isNote
                    ? "border-amber-300/40 bg-amber-200/90 text-amber-950"
                    : isText
                      ? "border-transparent bg-transparent"
                      : isBoundary
                        ? "border-dashed border-accent/50 bg-accent/5"
                        : "border-border bg-card text-card-foreground",
                  isSel && "ring-2 ring-primary",
                  isConnectSrc && "ring-2 ring-accent",
                  tool === "select" && "cursor-move",
                )}
                style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
              >
                {Icon && !isNote && !isText && <Icon className="h-5 w-5 shrink-0 text-accent" />}
                {editingNode === n.id ? (
                  <textarea
                    autoFocus
                    defaultValue={n.label}
                    rows={isNote ? 4 : 1}
                    className="w-full resize-none rounded bg-background/80 p-1 text-center text-xs outline-none"
                    onBlur={(e) => {
                      commit({ ...doc, nodes: doc.nodes.map((x) => (x.id === n.id ? { ...x, label: e.target.value } : x)) });
                      setEditingNode(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) (e.target as HTMLTextAreaElement).blur();
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className={cn("w-full break-words text-xs leading-tight", isText && "text-sm")}>{n.label}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Toolbar */}
        {!readOnly && (
          <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-border bg-card/95 p-1 shadow-lg backdrop-blur">
            {tools.map((t) => (
              <button
                key={t.id}
                title={t.label}
                onClick={() => {
                  setTool(t.id);
                  setConnectFrom(null);
                }}
                className={cn(
                  "rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                  tool === t.id && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                )}
              >
                <t.icon className="h-4 w-4" />
              </button>
            ))}
            <div className="mx-1 h-5 w-px bg-border" />
            {PEN_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setPenColor(c)}
                className={cn("h-5 w-5 rounded-full border-2", penColor === c ? "border-primary" : "border-transparent")}
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="mx-1 h-5 w-px bg-border" />
            <button title="Undo" onClick={undo} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Undo2 className="h-4 w-4" />
            </button>
            <button title="Redo" onClick={redo} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Redo2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-lg border border-border bg-card/95 p-1 shadow-lg">
          <button
            onClick={() => setCamera({ ...camera, zoom: Math.max(0.2, camera.zoom / 1.2) })}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-xs text-muted-foreground">{Math.round(camera.zoom * 100)}%</span>
          <button
            onClick={() => setCamera({ ...camera, zoom: Math.min(3, camera.zoom * 1.2) })}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button onClick={zoomToFit} title="Zoom to fit" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary">
            <Maximize className="h-4 w-4" />
          </button>
        </div>

        {tool === "connect" && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border border-border bg-card/95 px-3 py-1.5 text-xs text-muted-foreground shadow">
            {connectFrom ? "Now click the target component" : "Click a component to start a connection"}
          </div>
        )}
      </div>
    </div>
  );
}
