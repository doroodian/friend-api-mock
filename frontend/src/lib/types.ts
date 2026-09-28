// Shared domain types for the System Design Interview Platform.
// These mirror the shapes the real backend will eventually return.

export type SessionState = "draft" | "live" | "ended" | "archived";

export interface Participant {
  id: string;
  name: string;
  role: "interviewer" | "candidate" | "observer";
  color: string;
  isSelf?: boolean;
  isMock?: boolean;
}

export interface CanvasNode {
  id: string;
  type: string; // catalog type or "note" | "text" | "rect" | "ellipse"
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface Connector {
  id: string;
  from: string; // node id
  to: string; // node id
  label: string;
  style: "straight" | "elbow" | "curved";
  dashed: boolean;
}

export interface Stroke {
  id: string;
  points: number[]; // flat [x1,y1,x2,y2,...] in world coords
  color: string;
  width: number;
  tool: "pen" | "highlighter";
}

export interface CanvasDoc {
  nodes: CanvasNode[];
  connectors: Connector[];
  strokes: Stroke[];
}

export interface Session {
  id: string;
  title: string;
  prompt: string;
  state: SessionState;
  candidateToken: string;
  candidateEditingLocked: boolean;
  createdAt: number;
  updatedAt: number;
  canvas: CanvasDoc;
}

export const emptyCanvas = (): CanvasDoc => ({ nodes: [], connectors: [], strokes: [] });
