AI Providers (Gateway)

Overview
- The app can use non‑official provider gateways for LLMs (Gemini and ChatGPT) via a single endpoint.
- Edge Functions call the gateway using a model string that encodes the upstream (e.g. `google/gemini-2.5-flash`, `openai/gpt-4o-mini`).

Environment
- Set a gateway API key:
  - `LOVABLE_API_KEY`: Preferred variable name (also read as `AI_GATEWAY_API_KEY`).
- Optional default provider:
  - `AI_PROVIDER_DEFAULT`: one of `gemini`, `chatgpt`, `mannus` (default: `gemini`).

Edge Functions
- `supabase/functions/ai-chat/index.ts`
  - Accepts body fields: `provider?: string`, `model?: string`.
  - Picks the target model using the mapping rules below.
  - Streams OpenAI‑style SSE.
- `supabase/functions/ai-function-call/index.ts`
  - Accepts `provider?: string`, `model?: string` and relays a function‑calling request to the gateway.
- `supabase/functions/ai-agent-execute/index.ts`
  - Uses `agentConfig.provider`/`agentConfig.model` if provided, else request body, else `AI_PROVIDER_DEFAULT`.

Provider → Model Mapping
- If a fully‑qualified model (contains `/`) is provided, it is used as‑is.
- Otherwise, the following defaults/qualifiers apply:
  - `gemini` or `google` → prefix `google/` (default `google/gemini-2.5-flash`)
  - `chatgpt` or `openai` → prefix `openai/` (default `openai/gpt-4o-mini`)
  - `mannus` → default to `google/gemini-2.5-flash` (or qualify by name if it starts with `gpt`)

Frontend
- In `src/pages/ConfiguracoesIA.tsx`, the provider list includes:
  - `Mannus AI (gateway)`, `ChatGPT (gateway)`, `Gemini (gateway)` plus the original entries.
- `src/services/ai.ts` optionally accepts `{ provider, model }` and forwards them to the Edge Function.

Secrets Checklist (Supabase > Project Settings > Secrets)
- `LOVABLE_API_KEY`: required for the gateway.
- Optionally set `AI_PROVIDER_DEFAULT` to `gemini` or `chatgpt`.
- For direct media processing with Gemini in the API service (image tagging/analysis):
  - `GEMINI_API_KEY` (used by `apps/api/src/services/ai-media.service.ts`).

Notes
- If you prefer official APIs directly, set the corresponding keys (e.g., `OPENAI_API_KEY`, `GEMINI_API_KEY`) and adjust the functions to bypass the gateway.
