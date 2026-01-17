# 🚢 Shipment Tracker: Operational Intelligence Platform

Modern, high-fidelity logistical tracking system built with Next.js 15, Prisma, and Tailwind CSS. Designed for real-time visibility and exception management in global supply chains.

## 🚀 Key Features

### 1. **Operational Dashboard & Dispatch**
- **Exception Monitoring**: Real-time alerts for containers with customs holds, terminal delays, or missing documentation.
- **Financial Exposure**: Automatic calculation of estimated demurrage based on port-specific free-time rules.
- **Inventory Ledger**: Complete view of the entire active fleet with multi-source status updates.
- **Forwarder Attribution**: Strict lineage tracking linking every shipment to its data provider.
- **Smart Filtering**: Advanced filtering by Forwarder, Business Unit, and Operational Status.

### 2. **Deep Container Intelligence & Simulation (New)**
- **Simulation Mode**: A developer-focused "Transparent AI" dashboard (`/simulation`) that visualizes the entire ingestion pipeline step-by-step.
    - **Step-by-Step Execution**: Manually trigger Archivist, Translator, Auditor, Importer, and Learner agents.
    - **Variable Batch Size**: Control upload limits (10, 25, 100, 1k rows) for rapid testing.
    - **Live Logs**: Downloadable full execution logs for forensic debugging.
- **AI-Driven Narrative**: The Container Details page answers ONE question at a time in priority order:
    1.  **What's wrong?** (Status Banner)
    2.  **What do I need to do?** (Recommended Actions)
    3.  **What's the current state?** (Situation Summary)
    4.  **What's the history?** (Timeline)
- **Status Banner**: Conditional alerts for critical issues (Data Conflicts, Overdue Milestones).
- **Shipment Snapshot**: Two-column reference card with essential Identity, Routing, Timeline, and Parties data.
- **Data Quality Alerts**: Specific flags for missing or conflicting data (e.g., "Status shows BOOKED but ATD is past").
- **Operational Status Classification**: AI-driven "Truth Engine" that determines the *actual* status (e.g., IN_TRANSIT) by analyzing conflicting signals (ATD, Dates, Status Codes) rather than trusting a single field.
- **Agent Processing Timeline**: A forensic audit trail visualizing every step of the AI ingestion pipeline (Archivist → Translator → Validation). Displays confidence scores, exact field mappings, and any data discrepancies preventing "black box" confusion.

### 3. **AI-Driven Data Ingestion Architecture (4-Agent System)**
The system uses a robust 4-agent architecture to ensure "Zero Data Loss" and high-fidelity data mapping.

#### **The Agents**
1.  **Archivist** (`agents/archivist.ts`)
    *   **Role**: The "Librarian" (Non-AI).
    *   **Function**: Ingests raw Excel files, captures every row as-is into `RawRow` tables, and creates the initial `ImportLog`. Ensures full traceability and auditability.

2.  **Translator** (`agents/translator.ts`)
    *   **Role**: The "Mapper" (AI - High Reasoning).
    *   **Function**: Analyzes raw headers to detect schema, performs complex data transformations (e.g., Excel date conversion), and generates normalized `Container` and `ContainerEvent` records based on the canonical schema.

3.  **Auditor** (`agents/auditor.ts`)
    *   **Role**: The "Reviewer" (AI - High Reasoning).
    *   **Function**: Acts as a quality control layer. Reviews the Translator's output for logical inconsistencies (e.g., ATD > ATA), missing critical fields, or low confidence mappings. Can request revisions in a feedback loop.

4.  **Oracle Chat** (`agents/oracle-chat.ts`)
    *   **Role**: The "Assistant" (AI - Interactive).
    *   **Function**: Provides a conversational interface for users. Can answer questions about container status ("Why is this flagged?") and perform actions like adding notes or updating statuses via tool calling.

#### **Ingestion Flow**
`Excel File` -> **Archivist** (Raw Storage) -> **Translator** (Mapping) -> **Auditor** (Validation Loop) -> `Database (Structured)`

### 4. **Self-Improving Ingestion Engine (New)**
The system now features an autonomous improvement loop that can iterate on data parsing rules without human intervention.
- **Mechanism**: Orchestrates the agents in a loop (Translator -> Auditor -> Analyzer -> Updater).
- **Goal**: Achieves >90% coverage and accuracy by automatically updating internal dictionaries (`business_units.yml`, `container_ontology.yml`).
- **Docs**: [Self-Improving Engine](./docs/SELF_IMPROVING_ENGINE.md)

### 5. **Manual Intervention Tools**
- **Protocol Override**: Force update container status when automated feeds lag.
- **Exception Resolution**: Formalized workflow for clearing holds.
- **Priority Flagging**: Tag containers for executive attention.
- **Contextual Editing**: Direct "Edit Details" mode on container pages with **AI Field Locking** to prevent automation overwrites.
- **Documentation**: Integrated persistent notes system for container-specific context.

## 🛠️ Technology Stack

- **Framework**: [Next.js 15+](https://nextjs.org) (App Router, Server Actions)
- **Database**: [Neon](https://neon.tech) (PostgreSQL) via [Prisma ORM](https://www.prisma.io)
- **AI Provider**: [DeepSeek](https://www.deepseek.com/) via Azure AI Foundry
- **UI Architecture**: [Tailwind CSS](https://tailwindcss.com) + [Shadcn/UI](https://ui.shadcn.com)
- **Animations**: [Lucide React](https://lucide.dev) & Tailwind Transitions
- **Logic**: TypeScript for end-to-end type safety

## 📂 Project Structure

- `/app/actions`: Server-side logic for data ingestion, operational overrides, and AI interactions.
- `/components/shipment`: High-fidelity UI components (ActionCenter, AiAnalysisCard, ContainerDetailView).
- `/agents`: Core AI logic (`archivist`, `translator`, `auditor`, `oracle-chat`).
- `/agents/prompts`: Markdown-based system and user prompts for AI agents.
- `/prisma`: Database schema and migrations.
- `/lib`: Shared utilities, including `import-orchestrator.ts`.
- `/scripts`: Utility scripts including ingestion (`ingest_excel.ts`) and verification (`verify_locking.ts`).

## 🏁 Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Initialize Database**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

4. **Visit Dashboard**:
   Open [http://localhost:3000](http://localhost:3000)

## 🚀 Vercel Deployment (No-Git Approach)

The application is deployed to Vercel using the **Vercel CLI** (direct-to-production deployment).

- **Project Name**: `shipment-tracker`
- **Organization**: `wlgranas-projects`
- **Production URL**: [https://shipment-tracker.vercel.app](https://shipment-tracker.vercel.app)
- **Dashboard**: [https://vercel.com/wlgranas-projects/shipment-tracker](https://vercel.com/wlgranas-projects/shipment-tracker)
- **Env Variables**: Requires `DATABASE_URL` (Neon), `AZURE_AI_ENDPOINT`, `AZURE_AI_KEY`, and `AZURE_AI_MODEL`.

### 🔌 Neon Database Details
- **Host**: `ep-small-voice-ahhy8aje-pooler.c-3.us-east-1.aws.neon.tech`
- **Database**: `neondb`
- **User**: `neondb_owner`
- **Connection String**: `postgres://neondb_owner:******@ep-small-voice-ahhy8aje-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require`

1. **Install Vercel CLI**: `npm i -g vercel`
2. **Pull Environment Settings**: `vercel env pull`
3. **Deploy to Production**: `vercel --prod`

## 🤖 Agent Audit

For a detailed breakdown of the AI agents, their prompts, and invocation flows, please refer to:
[AGENTS_AUDIT.md](./docs/AGENTS_AUDIT.md)

## 🧹 Maintenance

### Database Cleanup
To clear all operational data (Shipments, Containers, Logs) while preserving configuration (Carriers, Ports):
```bash
npx tsx scripts/clear_db.ts
```

## 📄 License
Internal Operational Tool - All Rights Reserved.
