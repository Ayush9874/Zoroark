import { create } from 'zustand';
import { Node, Edge } from 'reactflow';

export type NodeStatus = 'pending' | 'running' | 'done' | 'error' | 'retry';

export interface LogEntry {
  text: string;
  level: 'info' | 'success' | 'error' | 'warning';
  timestamp: number;
  nodeId?: string;
}

interface PipelineState {
  nodes: Node[];
  edges: Edge[];
  nodeStatus: Record<string, NodeStatus>;
  agentProgress: Record<string, number>;
  agentLogs: Record<string, LogEntry[]>;
  globalLogs: LogEntry[];
  running: boolean;
  prompt: string;

  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setNodeStatus: (id: string, status: NodeStatus) => void;
  setProgress: (id: string, pct: number) => void;
  // nodeId = 'system' writes only to globalLogs, not to a node card
  appendLog: (nodeId: string, text: string, level?: LogEntry['level']) => void;
  updateNodeData: (id: string, data: any) => void;
  setRunning: (running: boolean) => void;
  setPrompt: (prompt: string) => void;
  reset: () => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  nodes: [],
  edges: [],
  nodeStatus: {},
  agentProgress: {},
  agentLogs: {},
  globalLogs: [],
  running: false,
  prompt: '',

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  setNodeStatus: (id, status) =>
    set((state) => ({
      nodeStatus: { ...state.nodeStatus, [id]: status },
    })),

  setProgress: (id, pct) =>
    set((state) => ({
      agentProgress: { ...state.agentProgress, [id]: pct },
    })),

  appendLog: (nodeId, text, level = 'info') =>
    set((state) => {
      const entry: LogEntry = { text, level, timestamp: Date.now(), nodeId };
      const isSystemLog = nodeId === 'system';
      return {
        // Only add to agentLogs if it's a real node (not system)
        agentLogs: isSystemLog
          ? state.agentLogs
          : {
              ...state.agentLogs,
              [nodeId]: [...(state.agentLogs[nodeId] || []), entry],
            },
        // Always add to globalLogs — this feeds the console at the bottom
        globalLogs: [...state.globalLogs, entry],
      };
    }),

  updateNodeData: (id, data) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      ),
    })),

  setRunning: (running) => set({ running }),
  setPrompt: (prompt) => set({ prompt }),

  reset: () =>
    set({
      nodes: [],
      edges: [],
      nodeStatus: {},
      agentProgress: {},
      agentLogs: {},
      globalLogs: [],
      running: false,
    }),
}));
