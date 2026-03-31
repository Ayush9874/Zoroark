import ReactFlow, {
  Background,
  Controls,
  ConnectionLineType,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useCallback, useMemo, useEffect } from 'react';
import { usePipelineStore } from '../../store/pipelineStore.ts';
import { TriggerNode } from './nodes/TriggerNode';
import { BrainNode } from './nodes/BrainNode';
import { ExecutorNode } from './nodes/ExecutorNode';
import { MemoryNode } from './nodes/MemoryNode';
import { N8nNode } from './nodes/N8nNode';
import { OutputNode } from './nodes/OutputNode';
import { EdgeAnimated } from './EdgeAnimated';

// ── Node type registry ────────────────────────────────────────────────────────
// ExecutorNode is the fallback for anything Llama 3 invents (scraper, mailer, etc.)
const nodeTypes = {
  trigger: TriggerNode,
  brain: BrainNode,
  executor: ExecutorNode,
  // All of these map to ExecutorNode — Llama 3 uses these type strings
  scraper: ExecutorNode,
  mailer: ExecutorNode,
  csv_writer: ExecutorNode,
  file_saver: ExecutorNode,
  reporter: ExecutorNode,
  sender: ExecutorNode,
  writer: ExecutorNode,
  fetcher: ExecutorNode,
  memory: MemoryNode,
  n8n: N8nNode,
  output: OutputNode,
};

const edgeTypes = {
  animated: EdgeAnimated,
};

function CanvasInner() {
  const nodes = usePipelineStore((state) => state.nodes);
  const storeEdges = usePipelineStore((state) => state.edges);
  const nodeStatus = usePipelineStore((state) => state.nodeStatus);
  const setNodes = usePipelineStore((state) => state.setNodes);
  const setEdges = usePipelineStore((state) => state.setEdges);
  const { fitView } = useReactFlow();

  // Fit view when node count changes (new pipeline started)
  useEffect(() => {
    if (nodes.length > 0) {
      fitView({ duration: 800, padding: 0.2 });
    }
  }, [nodes.length, fitView]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes(applyNodeChanges(changes, nodes)),
    [nodes, setNodes]
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges(applyEdgeChanges(changes, storeEdges)),
    [storeEdges, setEdges]
  );

  // Derive edge colours from node status — live updates as nodes run
  const edges = useMemo(() => {
    return storeEdges.map((edge) => ({
      ...edge,
      type: 'animated',
      animated: nodeStatus[edge.source] === 'running' || nodeStatus[edge.source] === 'done',
      style: {
        stroke:
          nodeStatus[edge.source] === 'done'
            ? '#10b981'
            : nodeStatus[edge.source] === 'running'
            ? '#f59e0b'
            : '#27272a',
        strokeWidth: nodeStatus[edge.source] === 'done' ? 2 : 1,
      },
    }));
  }, [storeEdges, nodeStatus]);

  // Guard: if Llama 3 returns a type not in our registry, use ExecutorNode
  // This prevents the "could not find node type" React Flow crash
  const safeNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      type: nodeTypes[node.type as keyof typeof nodeTypes] ? node.type : 'executor',
    }));
  }, [nodes]);

  return (
    <div className="w-full h-full bg-[#050505]">
      <ReactFlow
        nodes={safeNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineType={ConnectionLineType.Bezier}
        fitView
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        panOnDrag={true}
        panOnScroll={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={true}
        minZoom={0.1}
        maxZoom={2.5}
        className="z-0"
      >
        <Background color="#1a1a1a" gap={24} size={1} />
        <Controls className="!bg-zinc-900 !border-zinc-800 !fill-zinc-400" />
        <MiniMap
          className="!bg-zinc-900/50 !border-zinc-800 !rounded-lg"
          nodeColor={(n) => {
            const s = nodeStatus[n.id];
            if (s === 'done') return '#10b981';
            if (s === 'running') return '#f59e0b';
            if (s === 'error') return '#ef4444';
            if (n.type === 'trigger') return '#f59e0b';
            if (n.type === 'brain') return '#3b82f6';
            if (n.type === 'memory') return '#10b981';
            return '#3f3f46';
          }}
          maskColor="rgba(0,0,0,0.3)"
        />
      </ReactFlow>
    </div>
  );
}

export function IllusionCanvas() {
  return <CanvasInner />;
}
