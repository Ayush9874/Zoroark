import { useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { IllusionCanvas } from './components/canvas/IllusionCanvas';
import { SandboxPanel } from './components/sandbox/SandboxPanel';
import { PromptInput } from './components/ui/PromptInput';
import { PhaseLabel } from './components/ui/PhaseLabel';
import LandingPage from './LandingPage.tsx';

export default function App() {
  const [entered, setEntered] = useState(false);

  if (!entered) {
    return <LandingPage onEnter={() => setEntered(true)} />;
  }

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[#050505] text-white">
        <main className="flex-1 relative">
          <PhaseLabel />
          <IllusionCanvas />
          <PromptInput />
        </main>
        <SandboxPanel />
        <div className="pointer-events-none fixed inset-0 z-50 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
      </div>
    </ReactFlowProvider>
  );
}