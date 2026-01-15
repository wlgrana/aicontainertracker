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
