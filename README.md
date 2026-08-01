# 🔬 Computational Entropy Lab

## Quantifying the Energy Cost of Semantic Instability in Large Language Models

[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 Research Abstract

This research platform investigates a hypothesis: **semantic instability in natural language prompts is associated with measurable differences in LLM inference energy.**

We introduce the **Prompt Entropy Coefficient (PEC)** — a metric quantifying the relationship between linguistic clarity and computational efficiency, via the **Semantic Instability Index (SII)**, a composite score computed by the app's mutation engine.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPUTATIONAL ENTROPY LAB                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   React      │    │   FastAPI    │    │   LLM        │                   │
│  │   Dashboard  │◄──►│   Backend    │◄──►│   Engine     │                   │
│  │   (Frontend) │    │   (API)      │    │  (Ollama by  │                   │
│  │              │    │              │    │   default)   │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                   │                   │                            │
│         ▼                   ▼                   ▼                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   Real-time  │    │   Analysis   │    │   Energy     │                   │
│  │   Charts     │    │   Engine     │    │   Monitor    │                   │
│  │   (Recharts) │    │   (SciPy)    │    │ (real NVML   │                   │
│  │              │    │              │    │ GPU + TDP    │                   │
│  │              │    │              │    │ CPU proxy)   │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     PostgreSQL / SQLite Database                     │    │
│  │  • Experiments • Prompts • Mutations • Measurements • Analytics     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 🖥️ Interactive Research Dashboard
- Real-time experiment monitoring over a real WebSocket connection
- Recharts-based visualizations
- Comparative analysis across mutation types
- CSV / JSON / LaTeX / reproducibility-package (ZIP) export
- Dark/Light theme support

### 🧬 Advanced Mutation Engine
- **9 mutation conditions** (including baseline): Typo Noise, Verbosity, Semantic Ambiguity, Contradiction, Negation, Reordering, Formality Shift, Code-Switching
- Configurable intensity (0.0–1.0)
- Integrated readability/complexity scoring (Flesch reading ease, lexical diversity)
- Optional length-matched control per mutation, to separate a prompt-length confound from the mutation-type effect itself
- Seeded, reproducible mutations

### 📊 Statistical Analysis Suite
- Correlation analysis (Pearson, Spearman, Kendall) with confidence intervals
- ANOVA + Kruskal-Wallis (non-parametric alternative)
- Effect size calculations (Cohen's d, Hedges' g, η², ω²)
- Publication-ready LaTeX tables

### ⚡ Energy Monitoring
- **Real GPU power** via NVIDIA NVML when a GPU is present -- genuine hardware wattage, not an estimate
- **CPU and RAM power are always modeled estimates** (TDP × utilization, and a flat per-GB heuristic respectively) -- there is no RAPL or other real CPU hardware-energy access on this platform
- Every measurement records which of these applied (`measurement_source`: `nvml_real`, `tdp_proxy`, or `synthetic_simulation`) so real and estimated numbers are never silently blended without a way to tell them apart
- Per-token energy efficiency metrics (EPT, mJ/token)
- Optional CodeCarbon cross-check

### 📝 Research Tools
- LaTeX report/table export
- Reproducibility package export (raw data + protocol + environment info, as a ZIP)

---

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- [Ollama](https://ollama.com) running locally, with at least one model pulled (default: `phi3.5:3.8b`) — this is the default generation backend. Without it, the app falls back to OpenAI/Anthropic (with your own API key) or an explicit synthetic simulation mode.
- NVIDIA GPU + driver (optional) — enables real NVML-measured GPU energy instead of an estimate

### Windows One-Click Setup

```bat
:: From the repo root
setup.bat        REM creates venvs, installs backend + frontend deps
run_all.bat      REM starts backend (port 8000) and frontend (port 3000) together
```

(`setup.py`/`run.py` do not exist in this repo -- `setup.bat`/`run_backend.bat`/`run_frontend.bat`/`run_all.bat` are the real entry points, Windows-only.)

### Manual Installation (any OS)

```bash
# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install

# Start backend
cd ../backend
uvicorn app.main:app --reload --port 8000

# Start frontend (new terminal)
cd ../frontend
npm start
```

Open your browser to **http://localhost:3000**

---

## 📈 Key Metrics

| Metric | Description | Formula |
|--------|-------------|---------|
| **PEC** | Prompt Entropy Coefficient | Spearman ρ(SII, EPT) |
| **EPT** | Energy Per Token (mJ) | total_energy_joules / output_tokens × 1000 |
| **SII** | Semantic Instability Index | hand-tuned base score per mutation type + readability/lexical/sentence-length adjustments |

---

## 📁 Project Structure

```
comp_ent/
├── backend/                 # FastAPI Backend
│   ├── app/
│   │   ├── api/            # REST API endpoints
│   │   ├── core/           # Core configuration, DB, logging
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Mutation engine, energy monitor, LLM service,
│   │   │                   # experiment runner, analysis engine, corpus
│   │   └── main.py         # FastAPI application
│   ├── data/                # SQLite DB + settings.json (created at runtime)
│   ├── logs/                 # App logs (created at runtime)
│   ├── results/exports/      # Export output (created at runtime)
│   └── requirements.txt
├── frontend/                # React Dashboard
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API client (api.ts)
│   │   └── App.tsx          # Main app
│   └── package.json
├── sii_ept_research/        # Standalone real-hardware SII/EPT research pipeline
│                            # (separate from the web app; see its own README.md)
├── setup.bat / run_all.bat / run_backend.bat / run_frontend.bat
├── render.yaml               # Backend deployment config (Render)
└── DEPLOYMENT.md
```

No top-level `research/`, `data/`, `models/`, or `tests/` directories, and no `backend/alembic/` migrations exist in this repo -- schema changes are applied via SQLAlchemy's `create_all` (new tables only; existing tables need a manual migration, see git history for an example).

---

## 🧪 Running Experiments

### Via Dashboard
1. Navigate to "New Experiment"
2. Configure parameters (provider defaults to Ollama)
3. Click "Run Experiment"
4. Monitor real-time results (progress + live SII/EPT arrive over the dashboard WebSocket)

### Via API
```python
import requests

experiment = {
    "name": "Semantic Ambiguity Study",
    "mutation_types": ["ambiguity_semantic", "ambiguity_contradiction"],
    "num_prompts": 20,
    "runs_per_prompt": 5,
    "config": {"provider": "ollama"}
}

response = requests.post("http://localhost:8000/api/experiments/", json=experiment)
run = requests.post(f"http://localhost:8000/api/experiments/{response.json()['id']}/run")
```

`num_prompts` is capped at the real 60-prompt corpus size (`app/services/corpus.py`) and the schema's own advertised limit (50); `runs_per_prompt` is capped at 10.

---

## 📊 Demo Data

`POST /api/demo/seed` populates the database with illustrative demo experiments using a synthetic energy heuristic (`generate_realistic_measurement` in `demo.py`) — useful for exploring the dashboard UI without running a real experiment, but these numbers are not from a real model or real hardware measurement. Look for `measurement_source: "synthetic_simulation"` (or the demo endpoint itself) to distinguish demo/simulated rows from real ones.

---

## 📄 Citation

```bibtex
@article{computational_entropy_2025,
  title={Computational Entropy: Quantifying the Energy Cost of
         Semantic Instability in Large Language Models},
  author={[Your Name]},
  journal={[Target Conference/Journal]},
  year={2025},
  note={Available at: https://github.com/yourusername/comp_ent}
}
```
