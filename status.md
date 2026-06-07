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

### [2026-05-28] - Phase 3: Frictionless Quick-Fill UI Modal — COMPLETED
- **Completed:** Embedded dual-pipeline entry modal UI served natively from http://localhost. Streamlined entries to drop the status selector and automatically default to 'FILLED' on ledger execution.

### [2026-05-28] - Phase 4: Inline Dashboard Grid Actions — ACTIVE
- **Goal:** Add inline grid execution action buttons to close, expire, or process option assignments from table rows, handling exit pricing inputs and firing automated wheel transaction hooks.
- **In Progress:** Generating `api/update_leg_status.php` and updating click listeners in `dashboard.js`.

### [2026-06-07] - Phase 4: Symmetrical Persistent Table Grouping & Dynamic Sorting
- **Completed:** Restructured dashboard grid to implement a persistent Master-Child visual bracket layout. Added interactive header sorting (Ticker, Exp. Date, P/L $) that sorts rows atomically as single blocks, preventing strategy leg fracturing. Integrated inline lifecycle control buttons (`Close`, `Expire`, `Assign`) with native text prompts.

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