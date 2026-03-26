import React, { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { usePipelineStore } from '../../store/pipelineStore';
import { useWebSocket } from '../../hooks/useWebSocket';

export function PromptInput() {
  const [val, setVal] = useState('');
  const running = usePipelineStore((state) => state.running);
  const { runPipeline } = useWebSocket();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!val.trim() || running) return;
    runPipeline(val);
    setVal('');
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50">
      <form 
        onSubmit={handleSubmit}
        className="relative group"
      >
        <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative flex items-center bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-xl p-2 shadow-2xl">
          <input
            type="text"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="Describe your workflow (e.g., scrape LinkedIn → email CSV)"
            className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-white placeholder:text-zinc-500 font-sans"
            disabled={running}
          />
          <button
            type="submit"
            disabled={running || !val.trim()}
            className="bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black p-2 rounded-lg transition-all duration-200 flex items-center justify-center min-w-[40px]"
          >
            {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </form>
    </div>
  );
}
