# Zoroark 🔥

An AI-powered agent orchestration platform that combines **visual node-based flows** with **autonomous multi-step planning** and **persistent memory**. Build, visualize, and execute complex data pipelines—from document processing to web scraping—powered by local LLMs.

## Features

- **Visual Node-Based Interface**: Interactive React Flow canvas with real-time node execution visualization
- **Autonomous Planning**: Ollama-based agent planner that breaks down tasks into executable steps
- **Persistent Memory**: ChromaDB vector store that learns from successful node executions
- **Local-First Architecture**: No external APIs required (except optional Gemini); works offline with Ollama
- **Sandbox Execution**: Safe Python/JavaScript execution environment with web scraping capabilities
- **Real-Time Updates**: WebSocket communication between frontend and backend
- **Pre-Built Scrapers**: GitHub trending, LinkedIn jobs, Hacker News, market data, and more

## Architecture

```
Frontend (React + TypeScript)
├── ReactFlow Canvas (node visualization)
├── Sandbox Panel (execution logs)
└── WebSocket client

Backend Services
├── FastAPI (main orchestrator)
├── TSX/Express (dev server)
├── Ollama (local LLM inference)
├── ChromaDB (persistent memory)
└── Python Sandbox (code execution)
```

## Prerequisites

- **Node.js** (v18+)
- **Python 3.10+**
- **Ollama** (download from [ollama.ai](https://ollama.ai))
- **Ollama Models**: `ollama pull llama3` and `ollama pull llama2` (run before starting)

### Optional
- Gemini API key (for enhanced planning features)
- Internet connection (for web scraping features)

## Installation

### 1. Clone the repository
```bash
git clone https://github.com/Ayush9874/Zoroark.git
cd Zoroark
```

### 2. Install Node.js dependencies
```bash
npm install
```

### 3. Create Python virtual environment
```bash
python -m venv zoroark-env
zoroark-env\Scripts\activate  # Windows
# or
source zoroark-env/bin/activate  # macOS/Linux
```

### 4. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 5. Configure environment (optional)
Create `.env.local` for optional Gemini API key:
```
GEMINI_API_KEY=your_api_key_here
API_PORT=8000
FRONTEND_PORT=3000
```

### 6. Ensure Ollama is running
```bash
ollama serve
```

In a new terminal, pull required models:
```bash
ollama pull llama3
ollama pull llama2
```

## Quick Start

### Start development mode
```bash
npm run dev
```

This command:
- Starts the FastAPI backend (`api.py`) on port 8000
- Starts the dev server (`server.ts`) on port 3000
- Opens both services with live reload enabled

The app automatically:
- Checks Ollama availability
- Ensures BeautifulSoup4 and lxml are installed
- Initializes ChromaDB vector store
- Loads all available LLM models

### Access the UI
Open `http://localhost:3000` in your browser

## Project Structure

```
Zoroark/
├── src/                           # Frontend React + TypeScript
│   ├── App.tsx                    # Main app component
│   ├── LandingPage.tsx            # Landing/intro page
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── IllusionCanvas.tsx # Main node canvas
│   │   │   ├── EdgeAnimated.tsx   # Animated connections
│   │   │   └── nodes/             # Node type components (Trigger, Brain, etc.)
│   │   ├── sandbox/
│   │   │   ├── SandboxPanel.tsx   # Execution logs
│   │   │   └── AgentCard.tsx      # Agent status cards
│   │   └── ui/
│   │       ├── PromptInput.tsx    # Input interface
│   │       └── PhaseLabel.tsx     # Pipeline phase indicator
│   ├── hooks/                     # Custom React hooks
│   │   ├── useCameraControl.ts    # Canvas pan/zoom
│   │   ├── useNodeStatus.ts       # Node execution state
│   │   └── useWebSocket.ts        # WebSocket management
│   ├── lib/
│   │   ├── utils.ts              # Helper utilities
│   │   └── progressAnimator.ts   # Animation logic
│   └── store/
│       └── pipelineStore.ts       # Zustand state management
├── api.py                         # FastAPI backend orchestrator
├── planner3.py                    # Autonomous task planning (Ollama-based)
├── memory1.py                     # ChromaDB persistence layer
├── server.ts                      # Dev server + proxy setup
├── vite.config.ts                 # Vite bundler config
├── package.json                   # Node dependencies
├── requirements.txt               # Python dependencies
├── tsconfig.json                  # TypeScript config
├── zoroark_memory/                # Vector DB store (generated)
└── outputs/                       # Scraper output CSVs (generated)
    ├── github_repos.csv
    ├── linkedin_python.csv
    └── ...and more
```

## Key Modules

### `api.py` - FastAPI Backend
- Receives node execution requests from frontend
- Coordinates between planner, memory, and sandbox
- Exposes REST endpoints for tasks and status
- Handles CORS and cross-origin requests

### `planner3.py` - Autonomous Planning
- Uses Ollama to decompose tasks into steps
- Contains hardcoded verified scrapers (GitHub, LinkedIn, HN, etc.)
- Falls back to LLM-generated code for custom tasks
- Retries on failures with timeout protection

### `memory1.py` - Vector Memory
- Stores successful node executions as embeddings
- Uses sentence-transformers for similarity search
- Retrieves past solutions to accelerate future tasks
- Persistent across runs via ChromaDB

### Frontend Components
- **IllusionCanvas**: Renders the reactive node graph using reactflow
- **SandboxPanel**: Shows logs and status of running agents
- **PromptInput**: User query interface
- **useWebSocket**: Real-time bidirectional communication

## Usage Examples

### 1. Scrape GitHub Trending
1. Enter: `"Get the top 10 trending GitHub repos"`
2. Planner creates scraper nodes
3. Sandbox executes and saves to `outputs/github_repos.csv`

### 2. Custom Data Processing
1. Upload or describe a dataset
2. LLM generates processing pipeline
3. Memory stores successful nodes for future use

### 3. Multi-Step Workflows
Combine multiple nodes:
- **Trigger** → **Brain** (LLM) → **Executor** → **Memory** → **Output**

## Commands

```bash
# Start development (frontend + backend)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run lint

# Clean build artifacts
npm run clean
```

## Dependencies

### Frontend
- React 19, ReactFlow 11, Tailwind CSS 4
- Zustand (state management), Motion (animations)
- Vite (bundler), TypeScript

### Backend (Python)
- FastAPI + Uvicorn (REST framework)
- Ollama (LLM), ChromaDB (vector DB)
- LangChain, sentence-transformers
- BeautifulSoup4, requests (web scraping)

### Backend (Node)
- Express + HTTP Proxy Middleware
- Concurrently (run multiple services)
- TSX (TypeScript execution)

## Troubleshooting

### Ollama Connection Failed
```
[Planner] ERROR: Ollama not running
```
**Solution**: Start Ollama in a separate terminal: `ollama serve`

### Missing llama3 Model
```
llama3 not pulled. Run: ollama pull llama3
```
**Solution**: Download in a new terminal:
```bash
ollama pull llama3
ollama pull llama2
```

### Port Already in Use
If port 3000 or 8000 is occupied, modify `package.json` scripts or `.env.local`:
```
FRONTEND_PORT=3001
API_PORT=8001
```

### ChromaDB Error
Memory files are stored in `zoroark_memory/`. If corrupted:
```bash
rm -rf zoroark_memory/
npm run dev  # Reinitialize
```

### WebSocket Connection Issues
Ensure both services are running and check browser console for proxy errors.

## Future Enhancements

- [ ] Database integration for result persistence
- [ ] Advanced scheduling and job queues
- [ ] Multi-language code execution support
- [ ] Custom node creation UI
- [ ] Performance monitoring dashboard
- [ ] Distributed execution support

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT License - see LICENSE file for details

## Contact

Ayush Bhattacharyya - [@Ayush9874](https://github.com/Ayush9874)

---

**Named after Zoroark** 🔥 — the Pokémon known for creating illusions and hidden depths, reflecting the project's ability to orchestrate complex, multi-layered AI workflows.
