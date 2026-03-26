import { motion } from 'motion/react';
import { usePipelineStore } from '../../store/pipelineStore';

export function PhaseLabel() {
  const running = usePipelineStore((state) => state.running);
  const nodeStatus = usePipelineStore((state) => state.nodeStatus);
  const nodes = usePipelineStore((state) => state.nodes);
  
  const activeNodeId = Object.entries(nodeStatus).find(([_, status]) => status === 'running')?.[0];
  const activeNode = nodes.find(n => n.id === activeNodeId);

  if (!running) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-2 bg-zinc-900/80 backdrop-blur-md border border-white/5 rounded-full shadow-xl"
    >
      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
      <span className="text-xs font-mono uppercase tracking-[0.2em] text-zinc-400">
        Executing: <span className="text-white">{activeNode?.data.label || 'Orchestrating'}</span>
      </span>
    </motion.div>
  );
}
