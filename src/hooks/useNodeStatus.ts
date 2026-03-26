import { usePipelineStore } from '../store/pipelineStore';

export function useNodeStatus(nodeId: string) {
  return usePipelineStore((state) => state.nodeStatus[nodeId] || 'pending');
}

export function useAgentProgress(nodeId: string) {
  return usePipelineStore((state) => state.agentProgress[nodeId] || 0);
}

const EMPTY_ARRAY: any[] = [];

export function useAgentLogs(nodeId: string) {
  return usePipelineStore((state) => state.agentLogs[nodeId] || EMPTY_ARRAY);
}
