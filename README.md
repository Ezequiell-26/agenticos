# AgentiCOS

AgentiCOS is a multi-provider AI agent runtime.

## First subsystem: Provider Engine

The Provider Engine lets one AgentiCOS installation connect to:

- free APIs and free-tier services;
- paid APIs;
- local model servers;
- custom OpenAI-compatible endpoints.

The agent will not be coupled to one company or model. Provider selection is a separate runtime concern.

### Current built-in providers

- OpenRouter — free plan/free models plus paid usage.
- Groq — free tier plus paid Developer tier.
- Google Gemini — free tier for selected models plus paid usage.
- DeepSeek — paid API.
- OpenAI — paid API.
- Custom OpenAI-compatible endpoints — user supplied.

Provider pricing and quotas change over time, so the catalog stores provider metadata while model catalogs and limits are discovered dynamically when possible.

## Current architecture

```
User
  |
  v
AgentICOS
  |
  +--> Provider Registry
          |
          +--> OpenRouter
          +--> Groq
          +--> Gemini
          +--> DeepSeek
          +--> OpenAI
          +--> Custom endpoint
          |
          v
      Model Router
          |
          v
      Agent Engine
```

## What is already implemented

- typed provider contract;
- billing classification: free/free-tier/paid/local/custom;
- OpenAI-compatible HTTP adapter;
- model discovery through `GET /models`;
- normalized chat requests/responses;
- normalized rate-limit/quota/network errors;
- provider health state;
- ordered fallback execution;
- environment-variable based API keys;
- custom OpenAI-compatible endpoint support;
- CLI provider/model inspection and chat smoke test.

## Configuration

Copy `.env.example` to `.env` and add any keys you own.

Never commit real keys.

Install and validate:

```bash
npm install
npm run check
npm run providers
npm run models
```

Smoke-test one provider:

```bash
npm run dev -- chat openrouter <MODEL_ID> "Hello from AgentiCOS"
```

## Next step

The next subsystem is the Intelligent Model Router.

It will choose providers/models using:

- requested capabilities;
- free-first or paid-first policy;
- current health;
- quota/rate-limit state;
- latency;
- estimated token cost;
- explicit user preferences;
- fallback order.

AgentiCOS will keep provider-specific features inside adapters so the agent core remains vendor-neutral.
