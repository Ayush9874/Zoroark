import { useRef } from 'react';
import { usePipelineStore } from '../store/pipelineStore';
import { startProgressAnimation } from '../lib/progressAnimator';
import { useReactFlow } from 'reactflow';

function normaliseType(type: string): string {
  if (!type) return 'executor';
  const t = type.toLowerCase();
  if (t === 'trigger' || t === 'input') return 'trigger';
  if (t === 'brain' || t === 'planner' || t === 'llm') return 'brain';
  if (t === 'memory' || t === 'rag') return 'memory';
  if (t === 'output' || t === 'result') return 'output';
  if (t === 'n8n' || t === 'webhook') return 'n8n';
  return 'executor';
}

function topoSort(nodes: any[], edges: any[]): string[] {
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  for (const n of nodes) { inDegree[n.id] = 0; adj[n.id] = []; }
  for (const e of edges) {
    adj[e.source] = adj[e.source] || [];
    adj[e.source].push(e.target);
    inDegree[e.target] = (inDegree[e.target] || 0) + 1;
  }
  const queue = Object.keys(inDegree).filter(id => inDegree[id] === 0);
  const order: string[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    order.push(cur);
    for (const nb of adj[cur] || []) { if (--inDegree[nb] === 0) queue.push(nb); }
  }
  for (const n of nodes) if (!order.includes(n.id)) order.push(n.id);
  return order;
}

function gridLayout(nodes: any[], edges: any[]): any[] {
  const order = topoSort(nodes, edges);
  const COLS = 3, W = 280, H = 140, GAP_X = 80, GAP_Y = 60;
  return nodes.map(n => {
    const idx = order.indexOf(n.id);
    return { ...n, position: { x: (idx % COLS) * (W + GAP_X) + 60, y: Math.floor(idx / COLS) * (H + GAP_Y) + 60 } };
  });
}

export function useWebSocket() {
  const store = usePipelineStore();
  const { fitView } = useReactFlow();
  const progressIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const nodeOutputs = useRef<Record<string, string>>({});

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const focusNode = (nodeId: string) => fitView({ nodes: [{ id: nodeId }], duration: 700, padding: 0.6 });
  const focusBetween = (id1: string, id2: string) => fitView({ nodes: [{ id: id1 }, { id: id2 }], duration: 900, padding: 0.25 });

  const runPipeline = async (prompt: string) => {
    store.reset();
    store.setPrompt(prompt);
    store.setRunning(true);
    nodeOutputs.current = {};

    try {
      store.appendLog('system', `Sending to Llama 3: "${prompt}"`, 'info');

      const planRes = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (!planRes.ok) {
        const err = await planRes.json().catch(() => ({ detail: planRes.statusText }));
        store.appendLog('system', `Plan failed: ${err.detail}`, 'error');
        throw new Error(err.detail);
      }

      const plan = await planRes.json();
      store.appendLog('system', `LLM returned ${plan.nodes.length} nodes`, 'success');

      const rawEdges = (plan.edges || []).map((e: any, i: number) => ({
        id: `e-${i}`, source: e.source, target: e.target, type: 'animated',
      }));

      const rawNodes = plan.nodes.map((n: any, idx: number) => ({
        id: n.id,
        type: normaliseType(n.type),
        position: { x: 0, y: 0 },
        data: { ...n, index: idx, label: n.label || n.id, task_description: prompt },
        // ── code is intentionally NOT passed to data ──
        // Keeping code out of node data prevents it from being rendered
        // in any node component that might display data fields.
      }));

      const laidOut = gridLayout(rawNodes, rawEdges);
      store.setNodes(laidOut);
      store.setEdges(rawEdges);

      await sleep(600);
      fitView({ duration: 800, padding: 0.15 });
      await sleep(500);

      const execOrder = topoSort(plan.nodes, plan.edges || []);
      store.appendLog('system', `Order: ${execOrder.join(' → ')}`, 'info');

      const plannerNodeId =
        plan.nodes.find((n: any) => ['brain','planner','trigger'].includes(n.type?.toLowerCase()))?.id
        || plan.nodes[0]?.id;

      for (const nodeId of execOrder) {
        const node = laidOut.find(n => n.id === nodeId);
        if (!node) continue;
        // Get the raw code from the original plan (not from node data)
        const rawNode = plan.nodes.find((n: any) => n.id === nodeId);
        const nodeCode = rawNode?.code || '';
        const parentEdge = rawEdges.find((e: any) => e.target === nodeId);
        const previousOutput = parentEdge ? (nodeOutputs.current[parentEdge.source] || '') : '';
        await executeNode(node, nodeCode, prompt, previousOutput, plannerNodeId, focusNode, focusBetween);
      }

      await sleep(800);
      fitView({ duration: 1000, padding: 0.1 });
      store.appendLog('system', 'Pipeline complete!', 'success');

    } catch (err: any) {
      console.error('[Pipeline]', err);
      store.appendLog('system', `Pipeline error: ${err.message}`, 'error');
    } finally {
      store.setRunning(false);
    }
  };

  const executeNode = async (
    node: any,
    nodeCode: string,
    taskDescription: string,
    previousOutput: string,
    plannerNodeId: string,
    focusNode: (id: string) => void,
    focusBetween: (a: string, b: string) => void,
  ) => {
    const nodeId = node.id;
    store.setNodeStatus(nodeId, 'running');
    focusNode(nodeId);
    store.appendLog(nodeId, `Starting: ${node.data.label}`, 'info');

    progressIntervals.current[nodeId] = startProgressAnimation(nodeId, 10000);

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: nodeId,
          task_description: taskDescription,
          node_label: node.data.label,
          code: nodeCode,
          previous_output: previousOutput,
        }),
      });

      clearInterval(progressIntervals.current[nodeId]);
      const result = await res.json();
      const outputText: string = result.output || '';

      if (result.status === 'success') {
        // ── Detect SKIPPED: scraper called sys.exit(0) but got no data ───────
        // exit(0) = returncode 0 = "success" in subprocess terms, but the
        // scraper prints "SKIPPED: ..." meaning it couldn't connect or was blocked.
        // We must treat this as an error so node_2 doesn't receive SKIPPED text
        // and fail with 0 rows written.
        const isSkipped = outputText.toLowerCase().startsWith('skipped:');
        if (isSkipped) {
          store.setProgress(nodeId, 0);
          store.setNodeStatus(nodeId, 'error');
          store.appendLog(nodeId, outputText, 'error');
          // Animate the planner node to show self-correction attempt
          if (plannerNodeId && plannerNodeId !== nodeId) {
            await sleep(300);
            focusBetween(nodeId, plannerNodeId);
            await sleep(600);
            store.setNodeStatus(plannerNodeId, 'running');
            await sleep(700);
            store.setNodeStatus(plannerNodeId, 'done');
            focusNode(nodeId);
          }
          nodeOutputs.current[nodeId] = '';
          return;
        }

        store.setProgress(nodeId, 100);
        store.setNodeStatus(nodeId, 'done');
        store.appendLog(nodeId, `Done in ${result.attempts} attempt(s)`, 'success');
        if (result.fixed_code) store.appendLog(nodeId, 'Self-corrected successfully', 'warning');

        if (outputText) {
          // Show only the FIRST meaningful output line in the console and on the node card.
          // Never dump raw CSV data or multi-line scraper output into the UI.
          const lines = outputText.split('\n').filter((l: string) => l.trim());
          const firstLine = lines[0] || outputText;
          const displayText = firstLine.length > 120 ? firstLine.slice(0, 120) + '…' : firstLine;
          store.appendLog(nodeId, displayText, 'info');
          // Update node card to show the clean first line (e.g. "Results saved to outputs/...")
          store.updateNodeData(nodeId, { result: displayText });
        }

        nodeOutputs.current[nodeId] = outputText;

      } else {
        store.setProgress(nodeId, 0);
        store.setNodeStatus(nodeId, 'error');
        store.appendLog(nodeId, `Failed: ${result.error}`, 'error');
        if (plannerNodeId && plannerNodeId !== nodeId) {
          await sleep(300);
          focusBetween(nodeId, plannerNodeId);
          await sleep(600);
          store.setNodeStatus(plannerNodeId, 'running');
          await sleep(700);
          store.setNodeStatus(plannerNodeId, 'done');
          focusNode(nodeId);
        }
        nodeOutputs.current[nodeId] = '';
      }
    } catch (err: any) {
      clearInterval(progressIntervals.current[nodeId]);
      store.setNodeStatus(nodeId, 'error');
      store.appendLog(nodeId, `System error: ${err.message}`, 'error');
      nodeOutputs.current[nodeId] = '';
    }
  };

  return { runPipeline };
}