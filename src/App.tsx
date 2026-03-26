/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactFlowProvider } from 'reactflow';
import { IllusionCanvas } from './components/canvas/IllusionCanvas';
import { SandboxPanel } from './components/sandbox/SandboxPanel';
import { PromptInput } from './components/ui/PromptInput';
import { PhaseLabel } from './components/ui/PhaseLabel';

export default function App() {
  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[#050505] text-white selection:bg-amber-500/30">
        {/* Main Canvas Area */}
        <main className="flex-1 relative">
          <PhaseLabel />
          <IllusionCanvas />
          <PromptInput />
        </main>

        {/* Sidebar Monitoring */}
        <SandboxPanel />
        
        {/* Decorative Overlay */}
        <div className="pointer-events-none fixed inset-0 z-50 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
      </div>
    </ReactFlowProvider>
  );
}

