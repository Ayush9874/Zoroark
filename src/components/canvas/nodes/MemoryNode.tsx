import { Handle, Position } from 'reactflow';
import { motion } from 'motion/react';
import { useNodeStatus, useAgentProgress } from '../../../hooks/useNodeStatus';
import { cn } from '../../../lib/utils';
import { Database, CheckCircle2 } from 'lucide-react';

export function MemoryNode({ data }: any) {
  const status = useNodeStatus(data.id);
  const progress = useAgentProgress(data.id);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ 
        duration: 0.6, 
        delay: (data.index || 0) * 0.1,
        ease: [0.21, 0.47, 0.32, 0.98]
      }}
      className={cn(
        "relative px-6 py-4 rounded-xl border-2 transition-all duration-500 min-w-[200px]",
        status === 'running' ? "bg-emerald-500/10 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]" : 
        status === 'done' ? "bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]" :
        "bg-zinc-900 border-zinc-800"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-500">
            <Database className="w-4 h-4" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Memory / RAG</span>
        </div>
        {status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
      </div>
      
      <div className="text-sm font-medium text-white">{data.label}</div>
      
      {status === 'running' && (
        <div className="mt-3 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>
      )}

      {status === 'done' && data.result && (
        <motion.div 
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-2 rounded bg-emerald-500/5 border border-emerald-500/20"
        >
          <div className="text-[10px] font-mono text-emerald-400/80 uppercase mb-1">Retrieved</div>
          <div className="text-[11px] text-emerald-200/90 leading-tight">{data.result}</div>
        </motion.div>
      )}
      
      <Handle type="target" position={Position.Left} className="!bg-zinc-700 !border-none !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-zinc-700 !border-none !w-2 !h-2" />
    </motion.div>
  );
}
