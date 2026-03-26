import { motion } from 'motion/react';
import { useNodeStatus, useAgentProgress, useAgentLogs } from '../../hooks/useNodeStatus';
import { cn } from '../../lib/utils';

export function AgentCard({ nodeId, label }: { nodeId: string; label: string; key?: string }) {
  const status = useNodeStatus(nodeId);
  const progress = useAgentProgress(nodeId);
  const logs = useAgentLogs(nodeId);
  const lastLog = logs[logs.length - 1];

  const levelColors = {
    info: 'text-zinc-400',
    success: 'text-emerald-400',
    error: 'text-red-400',
    warning: 'text-amber-400',
  };

  const statusColors = {
    pending: 'border-zinc-800 text-zinc-500',
    running: 'border-amber-500 text-amber-500',
    done: 'border-emerald-500 text-emerald-500',
    error: 'border-red-500 text-red-500',
    retry: 'border-orange-500 text-orange-500',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "p-4 rounded-xl border bg-zinc-900/50 backdrop-blur-sm transition-colors duration-300",
        statusColors[status]
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            status === 'running' ? "bg-amber-500 animate-pulse" : 
            status === 'done' ? "bg-emerald-500" : "bg-zinc-700"
          )} />
          <span className="text-xs font-medium text-white">{label}</span>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">{status}</span>
      </div>

      <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className={cn(
            "h-full transition-all duration-300",
            status === 'running' ? "bg-amber-500" : 
            status === 'done' ? "bg-emerald-500" : "bg-zinc-700"
          )}
        />
      </div>

      <div className={cn("text-[10px] font-mono truncate", lastLog ? levelColors[lastLog.level] : 'text-zinc-600')}>
        {lastLog ? lastLog.text : 'Waiting for signal...'}
      </div>
    </motion.div>
  );
}
