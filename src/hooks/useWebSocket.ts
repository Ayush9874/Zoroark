import { useEffect, useRef } from 'react';
import { usePipelineStore, LogEntry } from '../store/pipelineStore';
import { startProgressAnimation } from '../lib/progressAnimator';
import { useReactFlow } from 'reactflow';

export function useWebSocket() {
  const store = usePipelineStore();
  const { setCenter, fitView } = useReactFlow();
  const progressIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  const focusNode = (nodeId: string) => {
    fitView({ nodes: [{ id: nodeId }], duration: 800, padding: 0.8 });
  };

  const focusBetween = (id1: string, id2: string) => {
    fitView({ nodes: [{ id: id1 }, { id: id2 }], duration: 1000, padding: 0.3 });
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const runPipeline = async (prompt: string) => {
    store.reset();
    store.setPrompt(prompt);
    store.setRunning(true);
    
    await sleep(500);

    const mockNodes = [
      { id: 'trigger', type: 'trigger', data: { id: 'trigger', label: 'User Prompt', result: prompt, index: 0 }, position: { x: 0, y: 0 } },
      { id: 'planner', type: 'brain', data: { id: 'planner', label: 'Task Planner', index: 1 }, position: { x: 250, y: 0 } },
      { id: 'memory', type: 'memory', data: { id: 'memory', label: 'Context Retrieval', index: 2 }, position: { x: 500, y: -150 } },
      { id: 'scraper', type: 'executor', data: { id: 'scraper', label: 'Web Scraper', file: 'scraper.py', index: 3 }, position: { x: 500, y: 0 } },
      { id: 'n8n', type: 'n8n', data: { id: 'n8n', label: 'Email Sender', index: 4 }, position: { x: 500, y: 150 } },
      { id: 'output', type: 'output', data: { id: 'output', label: 'Final Result', index: 5 }, position: { x: 800, y: 0 } },
    ];
    const mockEdges = [
      { id: 'e1', source: 'trigger', target: 'planner' },
      { id: 'e2', source: 'planner', target: 'memory' },
      { id: 'e3', source: 'planner', target: 'scraper' },
      { id: 'e4', source: 'planner', target: 'n8n' },
      { id: 'e5', source: 'memory', target: 'scraper' },
      { id: 'e6', source: 'scraper', target: 'output' },
      { id: 'e7', source: 'n8n', target: 'output' },
    ];
    store.setNodes(mockNodes);
    store.setEdges(mockEdges);
    
    await sleep(800);

    // Execution Sequence
    await executeNode('trigger', 1000, 'Input received');
    await executeNode('planner', 1500, 'Plan generated: 3 steps');
    await executeNode('memory', 1200, 'Retrieved 12 relevant docs');

    // Scraper with error and self-correction
    store.setNodeStatus('scraper', 'running');
    focusNode('scraper');
    store.appendLog('scraper', 'Initializing scraper...', 'info');
    await sleep(1000);
    store.appendLog('scraper', 'Error: ImportError: selenium not found', 'error');
    store.setNodeStatus('scraper', 'error');
    store.setProgress('scraper', 40);
    
    await sleep(800);
    store.appendLog('planner', 'Self-correction loop triggered ↻', 'warning');
    focusBetween('scraper', 'planner');
    await sleep(500);
    
    store.setNodeStatus('planner', 'running');
    focusNode('planner');
    store.appendLog('planner', 'Analyzing traceback...', 'info');
    await sleep(1200);
    store.appendLog('planner', 'Switching to requests + BeautifulSoup', 'success');
    store.setNodeStatus('planner', 'done');
    store.updateNodeData('planner', { result: 'Strategy: requests + bs4' });
    
    await sleep(500);
    store.appendLog('scraper', 'Retrying with new strategy...', 'warning');
    await executeNode('scraper', 2500, 'Scraped 45 items successfully');

    // Parallel n8n
    await executeNode('n8n', 2000, 'Email sent to 12 recipients');
    
    // Final output
    await executeNode('output', 1000, 'Workflow completed successfully');
    
    await sleep(1000);
    fitView({ duration: 1200, padding: 0.1 });
    
    store.setRunning(false);
  };

  const executeNode = async (nodeId: string, duration: number, result?: string) => {
    store.setNodeStatus(nodeId, 'running');
    focusNode(nodeId);
    progressIntervals.current[nodeId] = startProgressAnimation(nodeId, duration);
    
    const logs: { text: string; level: LogEntry['level'] }[] = [
      { text: `Initializing ${nodeId}...`, level: 'info' },
      { text: `Executing core logic...`, level: 'info' },
      { text: `Finalizing results...`, level: 'success' }
    ];

    for (let i = 0; i < logs.length; i++) {
      await sleep(duration / logs.length);
      store.appendLog(nodeId, logs[i].text, logs[i].level);
    }
    
    clearInterval(progressIntervals.current[nodeId]);
    store.setNodeStatus(nodeId, 'done');
    store.setProgress(nodeId, 100);
    if (result) {
      store.updateNodeData(nodeId, { result });
    }
  };

  return { runPipeline };
}
