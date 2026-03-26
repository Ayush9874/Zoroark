import { usePipelineStore } from '../../store/pipelineStore';
import { AgentCard } from './AgentCard';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';

export function SandboxPanel() {
  const nodes = usePipelineStore((state) => state.nodes);
  const running = usePipelineStore((state) => state.running);
  const globalLogs = usePipelineStore((state) => state.globalLogs);

  return (
    <div className="w-96 h-full bg-[#0a0a0a] border-l border-white/5 flex flex-col z-10">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3 mb-1">
          <Shield className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-white">Sandbox</h2>
        </div>
        <p className="text-[10px] text-zinc-500 font-mono">Real-time execution monitoring</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-2">Active Agents</div>
        <AnimatePresence mode="popLayout">
          {nodes.length > 0 ? (
            nodes.map((node) => (
              <AgentCard key={node.id} nodeId={node.id} label={node.data.label} />
            ))
          ) : (
            <div className="h-40 flex flex-col items-center justify-center text-center opacity-20 grayscale">
              <Terminal className="w-8 h-8 mb-4" />
              <p className="text-[10px] font-mono">Awaiting pipeline...</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Global Terminal */}
      <div className="h-64 border-t border-white/5 bg-black/50 flex flex-col">
        <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between bg-zinc-900/30">
          <div className="flex items-center gap-2">
            <Terminal className="w-3 h-3 text-zinc-500" />
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Console Output</span>
          </div>
          {running && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
        </div>
        <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-1 scrollbar-hide">
          {globalLogs.length > 0 ? (
            globalLogs.map((log, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-2"
              >
                <span className="text-zinc-600">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                <span className={cn(
                  "font-bold min-w-[60px]",
                  log.level === 'info' ? 'text-blue-500' :
                  log.level === 'success' ? 'text-emerald-500' :
                  log.level === 'error' ? 'text-red-500' : 'text-amber-500'
                )}>
                  {log.level.toUpperCase()}
                </span>
                <span className="text-zinc-300">{log.text}</span>
              </motion.div>
            ))
          ) : (
            <div className="text-zinc-700 italic">No logs yet...</div>
          )}
        </div>
      </div>

      {running && (
        <div className="p-4 bg-amber-500/5 border-t border-amber-500/10">
          <div className="flex items-center gap-2 text-[10px] font-mono text-amber-500 uppercase tracking-widest">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            System Live
          </div>
        </div>
      )}
    </div>
  );
}
