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
  appendLog: (id: string, text: string, level?: LogEntry['level']) => void;
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
  setNodeStatus: (id, status) => set((state) => ({
    nodeStatus: { ...state.nodeStatus, [id]: status }
  })),
  setProgress: (id, pct) => set((state) => ({
    agentProgress: { ...state.agentProgress, [id]: pct }
  })),
  appendLog: (id, text, level = 'info') => set((state) => {
    const entry = { text, level, timestamp: Date.now(), nodeId: id };
    return {
      agentLogs: { 
        ...state.agentLogs, 
        [id]: [...(state.agentLogs[id] || []), entry] 
      },
      globalLogs: [...state.globalLogs, entry]
    };
  }),
  updateNodeData: (id, data) => set((state) => ({
    nodes: state.nodes.map(node => node.id === id ? { ...node, data: { ...node.data, ...data } } : node)
  })),
  setRunning: (running) => set({ running }),
  setPrompt: (prompt) => set({ prompt }),
  reset: () => set({
    nodes: [],
    edges: [],
    nodeStatus: {},
    agentProgress: {},
    agentLogs: {},
    globalLogs: [],
    running: false
  }),
}));
