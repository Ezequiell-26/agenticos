# Initial Provider Matrix

This file is intentionally conservative. Availability, models, quotas and prices change, so AgentiCOS should refresh provider metadata instead of treating this table as permanent truth.

| Provider | Billing class | Integration | Base URL |
|---|---|---|---|
| OpenRouter | free-tier + paid | OpenAI-compatible | https://openrouter.ai/api/v1 |
| Groq | free-tier + paid | OpenAI-compatible | https://api.groq.com/openai/v1 |
| Google Gemini | free-tier + paid | OpenAI compatibility + native API later | https://generativelanguage.googleapis.com/v1beta/openai |
| DeepSeek | paid | OpenAI-compatible Chat + Responses | https://api.deepseek.com |
| OpenAI | paid | native OpenAI API | https://api.openai.com/v1 |
| Custom | depends on user | OpenAI-compatible | user supplied |

## Design rule

The user owns the API keys. AgentiCOS routes requests through the keys configured by that user; it does not distribute or embed provider credentials.
