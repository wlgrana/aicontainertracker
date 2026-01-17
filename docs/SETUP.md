# Project Setup Guide

## Prerequisites
- **Node.js**: v20 or higher recommended.
- **npm**: Comes with Node.js.

## Installation

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Configuration**
    - Copy `.env.example` to `.env`:
        ```bash
        cp .env.example .env
        ```
        *(On Windows: `copy .env.example .env`)*
    - Open `.env` and fill in the required values:
        - `AZURE_AI_ENDPOINT`: Your Azure OpenAI endpoint.
        - `AZURE_AI_KEY`: Your Azure OpenAI API key.
        - `DATABASE_URL`: Your PostgreSQL database connection string (e.g., NeonDB).

3.  **Database Setup**
    Generate the Prisma client:
    ```bash
    npx prisma generate
    ```

## Running the Application

Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔧 Troubleshooting

### Missing DATABASE_URL / Prisma Client Error
If you encounter an error like `Environment variable not found: DATABASE_URL` or `PrismaClientInitializationError`, it is likely that your local environment is not linked to the correct Vercel project or the environment variables haven't been pulled.

**Fix:**
1.  **Check Vercel Link**:
    Ensure you are linked to the `shipment-tracker` project, not `aicontainertracker`.
    ```bash
    vercel link
    # Select 'shipment-tracker' if prompted
    ```

2.  **Pull Environment Variables**:
    Download the latest production secrets (including `DATABASE_URL` and `AZURE_AI_KEY`).
    ```bash
    vercel env pull .env
    ```

3.  **Regenerate Prisma Client**:
    ```bash
    npx prisma generate
    ```

4.  **Restart Server**:
    Stop and restart `npm run dev`.
