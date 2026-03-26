import { usePipelineStore } from '../store/pipelineStore';

export function startProgressAnimation(nodeId: string, estimatedMs: number) {
  const store = usePipelineStore.getState();
  const start = Date.now();
  
  const interval = setInterval(() => {
    const elapsed = Date.now() - start;
    const pct = Math.min(85, (elapsed / estimatedMs) * 85);
    store.setProgress(nodeId, Math.round(pct));
    
    if (pct >= 85) clearInterval(interval);
  }, 50);
  
  return interval;
}
