# Development Environment & Workflow

## Overview

We utilize a **Branch-Based Development Workflow** using Neon (PostgreSQL). This allows us to develop and test new features (like Schema changes) in an isolated environment without risking the stability or data integrity of the Production database.

## Environments

### 1. Production (Main)
- **Branch**: `main` (Neon)
- **Database**: `neondb` (Production Data)
- **Usage**: Live application usage. **DO NOT** run experimental migrations or test data imports here.

### 2. Development (Dev)
- **Branch**: `dev` (Neon)
- **Database**: `neondb` (Test Data)
- **Created**: 2026-01-28
- **Purpose**:
    - Testing new Schema migrations (e.g., adding `forwarder` column).
    - Verifying manual mapping workflows.
    - Importing "Messy" or "Test" Excel files to train the AI.

## Switching Environments

We manage environments by swapping the `.env` file.

### Switch to DEV (Safe Mode)
Run this command in your terminal:
```bash
mv .env .env.production
mv .env.local .env
# OR manually update DATABASE_URL in .env to the 'dev' branch URL
```

### Switch to PRODUCTION (Live Mode)
Run this command in your terminal:
```bash
# Verify you have a backup of your dev env if needed, or just swap back
mv .env .env.local
mv .env.production .env
```

## Workflow for New Features

1.  **Create/Switch to Dev Branch**: Ensure your `.env` points to the `dev` Neon branch.
2.  **Develop**: Write code, update `schema.prisma`.
3.  **Migrate**: Run `npx prisma migrate dev` to apply changes to the Dev DB.
4.  **Verify**: Test the feature (e.g., Import a file).
5.  **Commit**: Git commit your code changes (but NOT your `.env` file).
6.  **Deploy**: When merging to main/deploying, the Production database will need the migrations applied.
