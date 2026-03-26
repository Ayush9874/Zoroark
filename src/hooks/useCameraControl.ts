import { useReactFlow } from 'reactflow';
import { useCallback } from 'react';

export function useCameraControl() {
  const { setCenter, fitView, getNodes } = useReactFlow();

  const focusNode = useCallback((nodeId: string) => {
    const nodes = getNodes();
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !node.position) return;
    
    // Nodes are roughly 200x80
    setCenter(
      node.position.x + 100,
      node.position.y + 40,
      { zoom: 1.3, duration: 800 }
    );
  }, [setCenter, getNodes]);

  const focusBetween = useCallback((id1: string, id2: string) => {
    const nodes = getNodes();
    const n1 = nodes.find(n => n.id === id1);
    const n2 = nodes.find(n => n.id === id2);
    if (!n1 || !n2) return;

    const cx = (n1.position.x + n2.position.x) / 2 + 100;
    const cy = (n1.position.y + n2.position.y) / 2 + 40;
    setCenter(cx, cy, { zoom: 0.85, duration: 1000 });
  }, [setCenter, getNodes]);

  return { focusNode, focusBetween, fitView };
}
