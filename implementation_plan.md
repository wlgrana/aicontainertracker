# Implementation Plan - Gemini to Deepseek Migration

## Goal
Replace the Google Gemini integration with Deepseek-V3.2 hosted on Azure AI Foundry.

## User Reviews
- **Credentials**: Ensure the API Key and Endpoint provided are correct.
- **Model Name**: The screenshot indicates "DeepSeek-V3.2", but the endpoint URL suggests a generic model path. We will configure the client to use the available model (likely `DeepSeek-V3.2` as the body parameter).

## Proposed Changes

### 1. Dependencies
#### [MODIFY] package.json
- Remove `@google/generative-ai`
- Add `openai` (The official library supports Azure/Custom endpoints)

### 2. Configuration
#### [NEW] .env
- Add `AZURE_AI_ENDPOINT="https://aimlprojectsai.services.ai.azure.com/models"`
- Add `AZURE_AI_KEY="..."`
(Note: The user provided full URL `.../chat/completions`. We will strip the suffix for the `baseURL` init).

#### [MODIFY] lib/ai.ts
- Initialize `OpenAI` client with `baseURL` and `apiKey`.
- Re-implement `highThinkModel`, `mediumThinkModel`, `lowThinkModel` abstractions.
    - Instead of returning a model object with `generateContent`, we will likely export helper functions `generateText(prompt, temperature)` or wrap the client to maintain a similar API to minimize refactoring churn, OR refactor the callsites.
    - **Decision**: Refactor callsites to use a unified helper `generateAIResponse(prompt, temperature)` to simplify future switches.

### 3. Agent Refactoring
All agents currently use `model.generateContent(prompt)`. We will change them to use the new `generateAIResponse` or direct usage of `client.chat.completions.create`.

#### [MODIFY] agents/schema-detector.ts
- Switch from `highThinkModel` to `client.chat.completions.create` with `temperature: 0.2`.
- Update response parsing (OpenAI returns `choices[0].message.content`).

#### [MODIFY] agents/data-normalizer.ts
- Switch from `lowThinkModel` to `client` with `temperature: 0.7`.

#### [MODIFY] agents/exception-classifier.ts
- Switch from `mediumThinkModel` to `client` with `temperature: 0.4`.

#### [MODIFY] app/actions/analyzeImport.ts
- Switch from `highThinkModel` to `client`.
- Update prompt handling if necessary.

#### [MODIFY] app/actions/ai/actions.ts
- Update the mocked/commented code to reflect the new provider.

## Verification Plan
1.  **Environment**: Verify `.env` keys.
2.  **Scripts**: Run `npx tsx verify_agents.ts` to test Schema and Normalizer agents with the new backend.
3.  **End-to-End**: Run `npx tsx test_exceptions.ts` once the reference data (from previous turn) is fixed/seeded.
