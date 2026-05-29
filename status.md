# PROJECT STATUS: Insight (Trading Journal Command Center)

## CURRENT ARCHITECTURE
- **Backend:** PHP 8.x (Strict Typing / PDO / Native Relative Paths via `__DIR__`)
- **Database:** MySQL 8.x (Relational / Sub-millisecond Compound Indexing)
- **Frontend:** daisyUI 5 / Tailwind CSS / Vanilla JS (No NPM/Bundlers)
- **Environment:** WSL (Ubuntu)
- **Primary Agent Rules:** Managed via `gemini.md` (Coder) and Architect Gem Instructions.

## PROJECT LOG
### [2026-05-01] - Project Initialization & Agent Hand-off
- **Goal:** Establish a multi-agent workflow (Architect/Coder) and finalize technical standards.
- **Completed:** - Defined Architect Gem instructions for strategic planning.
  - Created `gemini.md` for VS Code Implementation Agent.
  - Configured daisyUI 5 as the primary UI framework.
  - Created `RESOURCES.md` to bridge Architect Gem to live daisyUI 5 documentation.
- **Technical Note:** All future DB schema changes must be cross-referenced with `SCHEMA.sql`.

### [2026-05-26] - Phase 1: Core Foundations & Dashboard Setup
- **Goal:** Instantiate baseline relational schema, core engine math, and high-density triage dashboard.
- **Completed:**
  - **Database:** Initialized tables (`brokers`, `wheel_cycles`, `stock_orders`, `option_orders`). Restrained `assigned_shares` strictly to 100-share lots via SQL `CHECK` constraints.
  - **Engine Logic:** Deployed `WheelMath::calculateNetCostBasis` utilizing a strict **Independence Guard** rule to ignore surplus option contracts.
  - **Automation Hooks:** Implemented `WheelRepository::logOptionAssignment` to cleanly execute Option A auto-termination/archiving of cycles upon short call assignment.
  - **UI Grid:** Built a high-density, real-time command center interface sorting rows dynamically in-memory (Short ITM Alert -> Lowest DTE Heatmap -> Alphabetical) to protect the UI thread from external API latency.
- **Technical Note:** Stripped all documentation-level path aliases (`@`). All backend scripts strictly utilize native relative paths (`__DIR__ . '/../../src/...'`) to prevent WSL folder structure hallucinations.

## VERIFIED DIRECTORY MAPPING
```text
/var/www/html/
├── config/
│   └── database.php
├── src/
│   ├── Engine/ # Contains core business logic
│   │   └── WheelMath.php
│   └── Repository/ # Contains database interaction logic
│       ├── StrategyRepository.php
│       └── WheelRepository.php
├── api/ # API endpoints for frontend interaction
│   ├── market_data.php
│   ├── log_strategy.php
│   └── log_transaction.php
├── assets/ # Static assets like JavaScript and CSS
│   └── js/
│       ├── QuickFill.js
│       └── dashboard.js
└── index.php # Main application entry point