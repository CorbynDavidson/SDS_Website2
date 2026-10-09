# Chatbot operation

The initial launch uses relevant approved FAQ responses with paid AI disabled. Questions without a matching FAQ are directed to the enquiry form for a team review. The browser calls the same-origin Worker. If AI is enabled later, the Worker validates input, reserves D1 allowance atomically, and then calls the fixed `gpt-5-nano` model. Every assistant reply includes a link to `/housing-disrepair-enquiries/`.

## Configuration

Production uses `DB` and the existing `submission_rate_limits` table; no new migration is needed. Configure these secrets in Cloudflare Worker production settings:

- `OPENAI_API_KEY`: dedicated chatbot API key, never a browser variable or tracked file.
- `RATE_LIMIT_SECRET`: existing private HMAC salt used for form throttling.
- `TURNSTILE_SECRET_KEY`: optional Turnstile secret; pair with public `TURNSTILE_SITE_KEY`. Restrict the widget to the actual site hostname.

The key created for this change belongs to the OpenAI Default project. It is a dedicated key, but not an isolated project. Project-level budget alerts are additional monitoring, not an application hard stop.

Wrangler defines `CHAT_AI_ENABLED=false`, `CHAT_AI_DAILY_LIMIT=200`, and `CHAT_AI_MONTHLY_LIMIT=3000`. Production and preview AI are disabled for the initial FAQ launch. To enable AI later, set the production enable flag to `true` and install the production secrets. Set it back to `false` or either allowance to `0` to stop paid calls. Missing secrets, unavailable D1, exhausted allowance and provider errors all return an approved factual answer with the enquiry link.

## Limits and privacy

- Maximum 500 characters per question; four history entries of at most 500 characters each.
- Maximum five requests per visitor per minute and twenty per hour. Identifiers are HMACs of Cloudflare IP and window, never stored raw IPs.
- Turnstile only after three requests in a minute, fourteen in an hour, or an available bot score below 30. If verification is not configured, these requests receive approved answers instead.
- At most 200 paid attempts per UTC day and 3,000 per UTC month. Failed calls count; conservative reservations may exhaust allowance earlier. There are no automatic retries.
- Provider timeout eight seconds; output limit 300 tokens, including reasoning. Responses use `store:false`.
- Only an exact fixed public FAQ with no history is cached for one hour. Personal questions and conversation history are never put in the shared cache or D1.
- Aggregate counters retain roughly 35 days after their period. Expired chatbot counters are removed in bounded batches.

These controls bound AI request volume, not total hosting costs or all account spending. Cloudflare infrastructure usage and calls using other keys are outside this application allowance.

## Monitor

Use the [D1 console](https://dash.cloudflare.com/6d4e6588768588102930fc80929d51d2/workers/d1/databases/bb14ab54-b4eb-4300-9b5d-569636ec64fb/console):

```sql
SELECT bucket_key, count
FROM submission_rate_limits
WHERE bucket_key LIKE 'chat:budget:%'
   OR bucket_key LIKE 'chat:metric:%'
ORDER BY bucket_key DESC;
```

`ai_attempts` counts provider requests; `input_tokens` and `output_tokens` show reported usage; `cache_hits`, `fallbacks`, `provider_errors`, and `guardrail_errors` help diagnose operation. Do not delete active budget counters to reset limits.

## Activation verification

After adding the production secret and deploying, ask a generic FAQ on the site. The network response from `/api/claim-assistant` should contain `mode: "ai"` and the form URL. Without the key it returns `mode: "approved", reason: "ai-disabled"`. Keep API key values out of screenshots, logs and support messages. Run `npm run check` and `npm run deploy:check` before deploying code changes.
