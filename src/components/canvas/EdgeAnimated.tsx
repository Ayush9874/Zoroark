import { BaseEdge, getBezierPath } from 'reactflow';

export function EdgeAnimated({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: any) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{ ...style, strokeWidth: 4, opacity: 0.05, filter: 'blur(4px)' }} 
      />
      <BaseEdge
        path={edgePath}
        style={{
          ...style,
          strokeWidth: 2,
          strokeDasharray: '10,10',
          animation: 'marching-ants 0.6s linear infinite',
          filter: 'drop-shadow(0 0 4px currentColor)',
        }}
      />
    </>
  );
}
