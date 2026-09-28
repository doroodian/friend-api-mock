// Component palette catalog (spec §6.4). Each entry maps a stable component
// type to a label and a Lucide icon rendered inside canvas nodes.

import {
  Bot,
  Boxes,
  Braces,
  Cloud,
  Container,
  Cpu,
  Database,
  DatabaseZap,
  FileArchive,
  Waypoints,
  Globe,
  HardDrive,
  Layers,
  MessageSquareText,
  MonitorSmartphone,
  Network,
  Radio,
  Server,
  ServerCog,
  Sparkles,
  Square,
  StickyNote,
  Type,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface CatalogItem {
  type: string;
  label: string;
  icon: LucideIcon;
  w: number;
  h: number;
}

export interface CatalogCategory {
  name: string;
  items: CatalogItem[];
}

const item = (type: string, label: string, icon: LucideIcon, w = 150, h = 84): CatalogItem => ({
  type,
  label,
  icon,
  w,
  h,
});

export const CATALOG: CatalogCategory[] = [
  {
    name: "General",
    items: [
      item("service", "Service", ServerCog),
      item("rounded", "Process", Square),
      item("text", "Text", Type, 160, 40),
      item("note", "Sticky note", StickyNote, 160, 120),
      item("boundary", "Boundary", Boxes, 260, 180),
      item("generic", "Component", Braces),
    ],
  },
  {
    name: "Data",
    items: [
      item("database", "Relational DB", Database),
      item("nosql", "NoSQL DB", DatabaseZap),
      item("cache", "Cache", Zap),
      item("storage", "Object storage", FileArchive),
      item("warehouse", "Data warehouse", HardDrive),
    ],
  },
  {
    name: "Messaging",
    items: [
      item("queue", "Queue", Layers),
      item("stream", "Event stream", Radio),
      item("pubsub", "Pub/Sub broker", MessageSquareText),
    ],
  },
  {
    name: "Network",
    items: [
      item("client", "Client", Users),
      item("browser-client", "Browser / mobile", MonitorSmartphone),
      item("api-gateway", "API gateway", Waypoints),
      item("load-balancer", "Load balancer", Workflow),
      item("cdn", "CDN", Globe),
      item("external-api", "External API", Cloud),
    ],
  },
  {
    name: "Compute",
    items: [
      item("server", "Server", Server),
      item("worker", "Worker", Cpu),
      item("function", "Function", Zap),
      item("container", "Container / cluster", Container),
    ],
  },
  {
    name: "AI",
    items: [
      item("llm", "LLM / model", Sparkles),
      item("embedding", "Embedding model", Braces),
      item("vector-db", "Vector DB", Database),
      item("agent", "Agent / tool", Bot),
    ],
  },
];

export const catalogItem = (type: string): CatalogItem | undefined =>
  CATALOG.flatMap((c) => c.items).find((i) => i.type === type);
