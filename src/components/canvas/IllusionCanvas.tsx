import ReactFlow, { 
  Background, 
  Controls, 
  ConnectionLineType,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useCallback, useMemo, useEffect } from 'react';
import { usePipelineStore } from '../../store/pipelineStore';
import { TriggerNode } from './nodes/TriggerNode';
import { BrainNode } from './nodes/BrainNode';
import { ExecutorNode } from './nodes/ExecutorNode';
import { MemoryNode } from './nodes/MemoryNode';
import { N8nNode } from './nodes/N8nNode';
import { OutputNode } from './nodes/OutputNode';
import { EdgeAnimated } from './EdgeAnimated';

const nodeTypes = {
  trigger: TriggerNode,
  brain: BrainNode,
  executor: ExecutorNode,
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

  const edges = useMemo(() => {
    return storeEdges.map(edge => ({
      ...edge,
      type: 'animated',
      style: {
        stroke: nodeStatus[edge.source] === 'done' ? '#10b981' : 
                nodeStatus[edge.source] === 'running' ? '#f59e0b' : '#27272a',
      }
    }));
  }, [storeEdges, nodeStatus]);

  return (
    <div className="w-full h-full bg-[#050505]">
      <ReactFlow
        nodes={nodes}
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
        selectionOnDrag={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={true}
        className="z-0"
      >
        <Background color="#111" gap={20} />
        <Controls className="!bg-zinc-900 !border-zinc-800 !fill-white" />
        <MiniMap 
          className="!bg-zinc-900/50 !border-zinc-800 !rounded-lg" 
          nodeColor={(n) => {
            if (n.type === 'trigger') return '#f59e0b';
            if (n.type === 'brain') return '#3b82f6';
            if (n.type === 'executor') return '#f97316';
            if (n.type === 'memory') return '#10b981';
            return '#27272a';
          }}
          maskColor="rgba(0,0,0,0.2)"
        />
      </ReactFlow>
    </div>
  );
}

export function IllusionCanvas() {
  return (
    <CanvasInner />
  );
}
