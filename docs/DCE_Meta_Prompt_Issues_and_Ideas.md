# DCE Meta Prompt — Official Issues & Fix Ideas

> Date: 2026-05-19
> Status: Investigation / Pre-implementation
> Updated: 2026-05-19 — Added ranked issue list and quality-preserving solutions
> File under analysis: `src/components/flow/DeliverableCreatorStep.jsx` (lines 283-769)
> LLM service: `server/src/services/llm.service.js`
> Model default: `claude-opus-4-6` (configurable via `ANTHROPIC_MODEL`)

---

## Executive Summary

The Executive DCE meta prompt — the single prompt that generates all 8 copy-paste prompts — is not reliably producing all 8 prompts at target quality. Later prompts (typically 6-8) are either truncated, thinned out, or occasionally missing entirely. The root cause is a collision between the prompt's output demands and the available token budget, compounded by instruction bloat that dilutes the model's attention on what actually matters for generation.

---

## Issue 1: Output Token Ceiling vs. Output Demand

### The math

| Component | Tokens (est.) |
|---|---|
| **max_tokens setting** | **32,768** |
| Meta prompt input (prompt text alone) | ~6,700 |
| + Website scrape context (when enabled) | 500–5,000 |
| + Session knowledge files | 0–50,000+ |
| + Organization knowledge files | 0–50,000+ |

**Required output:**

| Scenario | Words | Tokens (est.) | Fits in 32K? |
|---|---|---|---|
| Minimum quality (800 words/prompt × 8) | ~7,000 | ~9,300 | Yes |
| Target quality (2,000 words/prompt × 8) | ~16,600 | ~22,100 | Tight |
| Target + JSON escaping overhead (~30%) | ~21,600 | ~28,800 | Barely — ~4K remaining |
| Target + model repeats boilerplate rules in each prompt | ~25,000+ | ~33,000+ | **No — exceeds ceiling** |

### What happens

- The model begins generating comprehensive prompts 1-4 at target quality (~2,000 words each).
- By prompt 5-6, it detects it's running out of output space.
- It self-compresses: prompts 6-8 come back as thin summaries (200-500 words instead of 800-2,000).
- OR the JSON is truncated mid-string, `JSON.parse()` fails, and the user gets "Failed to generate prompts."
- The `minItems: 8` constraint in the JSON schema is a hint, not enforced by the Anthropic API — the model can return fewer prompts and the code won't catch it.

### Evidence

- `llm.service.js:109` — `max_tokens: 32768` is the hard ceiling.
- `DeliverableCreatorStep.jsx:768` — "Each prompt should be 800-2000+ words" — that's the ask.
- `llm.service.js:160` — `JSON.parse(cleanedContent)` — no validation that 8 prompts were returned.
- No check that individual prompt lengths meet a minimum threshold.

---

## Issue 2: Section A19 Is Irrelevant to the Generation Call

### What A19 does

Section A19 (Functional Render Injection) governs what happens **when a user runs one of the generated prompts in a Claude.ai session** — specifically, when to offer a Tier 2 functional artifact upgrade. It contains:

- 3-tier artifact model definitions (A19-1)
- Functionality-implying artifact enum (A19-2)
- Engagement mode gate logic (A19-3)
- Exact scripted prompt text for functional upgrade offers (A19-4)
- React sandbox render rules (A19-5)
- "What's Next" ACD template (A19-6)
- `/functional` slash command handler (A19-7)
- Refusal envelope for excluded capabilities (A19-8)
- Output size check (A19-9)
- Regulated client rules (A19-10)
- Internal preview ribbon spec (A19-11)

### Why it's a problem here

**None of this fires during prompt generation.** The meta prompt's job is to produce a JSON object with 8 prompt strings. A19 rules govern the *execution environment* (Claude.ai artifact sandbox), not the *generation environment* (Anthropic API → JSON response).

**Cost:**
- A19 alone is ~2,143 words / ~2,857 tokens of input.
- That's **42% of the core prompt** (5,037 words total) devoted to rules the model cannot act on during this call.
- The model spends attention budget parsing engagement modes, refusal envelopes, ribbon styling specs, and slash command handlers — then has to set all of it aside and just write JSON.

### Where A19 *should* live

A19 rules should be embedded by the model **inside** the text of generated prompts 7 and 8 (where functional renders and portfolio hubs are relevant) — not in the meta prompt's own instruction set.

---

## Issue 3: Duplicated Instructions — Universal Rules vs. Section A

The meta prompt contains two blocks that cover substantially the same concepts:

| Concept | Universal Rules (lines 296-337) | Section A (lines 465-547) |
|---|---|---|
| Magic Wand | Rule 1 (8 lines) | Framework Req #1 (2 lines) |
| Pre-mortem | Rule 2 (4 lines) | Framework Req #2 (2 lines) |
| Expert Panel | Rule 3 (5 lines) | Framework Req #3 (2 lines) |
| Completion-first | Rule 5 (4 lines) | (implied throughout) |
| Output format | Rule 6 (5 lines) | (implied throughout) |
| Font / design | Rule 8 (4 lines) | Design Rules (15 lines, more detailed) |
| Context window mgmt | Rule 4 (18 lines) | Context Window Mgmt (15 lines, slightly different thresholds) |
| Formatting standards | Rule 8 | WCAG/toggle/footer (20 lines) |

**Problem:** The model reads the same concepts twice, in slightly different phrasings, with slightly different detail levels. This creates:

1. **Attention dilution** — the model doesn't know which version is authoritative.
2. **Token waste** — ~480 words of Section A are redundant with Universal Rules.
3. **Conflicting signals** — e.g., Rule 4 says context alerts at 50%/75%/80%, Section A says the same but with different phrasing ("⚡" vs "⚠") and additional accelerator triggers. The model has to reconcile.

---

## Issue 4: "Embed ALL Rules in EVERY Prompt" Creates Exponential Output

`DeliverableCreatorStep.jsx:293`:
> "Every prompt must carry enough context for that session to execute without referencing prior prompts. Embed the DCE rules, the role context, the deliverable name, and all relevant specifications directly inside each prompt's text."

`DeliverableCreatorStep.jsx:768`:
> "Each prompt should be 800-2000+ words"

If the model obeys both instructions literally, each prompt includes ~800 words of repeated DCE boilerplate (rules, role context, formatting standards) leaving only 0-1,200 words for the actual step-specific content. Across 8 prompts, that's ~6,400 tokens spent on rule repetition alone.

This is the instruction that most directly causes later prompts to thin out — the model "knows" it's supposed to repeat the full rule set but doesn't have the token budget to do so 8 times while also writing substantive step-specific content.

---

## Issue 5: No Post-Generation Validation

`DeliverableCreatorStep.jsx:807` — `setGeneratedPrompts(result)` accepts whatever JSON the model returns without checking:

- Did we get exactly 8 prompts?
- Does each prompt's `prompt` field exceed a minimum length?
- Are the prompts actually different from each other (not duplicates)?
- Did the model include the required elements (role context, deliverable name)?

If the model returns 5 thin prompts in valid JSON, the UI displays them as if generation succeeded.

---

## Issue 6: Knowledge File Context Can Blow the Input Budget

`llm.service.js:66-103` prepends session knowledge files AND organization knowledge files to the prompt. If a user has uploaded substantial documents (company dossiers, SOWs, etc.), the enriched prompt can easily reach 50,000+ tokens of input. Combined with the 32K output ceiling, this means:

- The model's effective context window is consumed primarily by input context.
- Less "thinking space" is available for generating the 8 complex prompts.
- On models with 200K context windows this doesn't cause input truncation, but it does increase the chance the model loses track of later instructions buried after large knowledge file blocks.

The knowledge files are prepended **before** the meta prompt (`llm.service.js:74, 94`), meaning the actual DCE instructions appear last in the message — after potentially tens of thousands of tokens of company data. The model may deprioritize the tail instructions.

---

## Issue 7: System Prompt Is Generic

`llm.service.js:45`:
```
let systemMessage = 'You are a helpful assistant that generates structured JSON responses.';
```

This is a generic system prompt. It doesn't prime the model for the specific task (generating a sophisticated 8-prompt DCE pack). A task-specific system prompt could improve instruction adherence for the complex meta prompt.

---

## Issue 8: Working Mode Has None of These Problems

For comparison, the Working mode (`server/src/routes/deliverable.js:32-61`) works differently:

- System prompt is concise and task-specific (30 lines)
- Output is freeform text (not JSON), so no escaping overhead
- Asks for 3-7 chunks (not a fixed 8), adapting to complexity
- No Section A or A19 appended
- No "embed all rules in every chunk" instruction
- Parsing is regex-based and tolerant of format variation

Working mode is leaner and more reliable because it doesn't try to pack governance rules for a different execution context into the generation call.

---

## Issue 9: stop_reason Is Never Checked — Silent Truncation

**This is arguably the most dangerous issue.**

The Anthropic API returns a `stop_reason` on every response:
- `"end_stop"` = the model finished naturally
- `"max_tokens"` = the model was cut off because it hit the `max_tokens` ceiling

The streaming code in `llm.service.js:123-135` accumulates text chunks but **never checks the final message's stop_reason**. When the model hits the 32K output ceiling mid-JSON, the stream ends, the code gets truncated JSON, `JSON.parse()` fails, and the user sees a generic "Failed to generate prompts" error.

But worse: if the model happens to produce *valid* JSON that's truncated at a clean boundary (e.g., it only managed 6 prompts before running out of space, but the JSON still closes properly because the model anticipated the limit), the truncation is **completely silent**. The user gets 6 prompts and never knows 2 are missing.

**Where:**
- `llm.service.js:123-135` — streaming loop, no stop_reason capture
- `llm.service.js:137` — logs char count but not why the stream ended
- The `anthropic.messages.stream()` SDK provides `stream.finalMessage()` or the `message_stop` event which contains the stop_reason — it's available but not used.

---

## Issue 10: SSE Complete Event — Single-Line JSON Fragility

The server sends the entire parsed result as one SSE `data:` line:

```js
// integrations.js:104
res.write(`event: complete\ndata: ${JSON.stringify(result)}\n\n`);
```

The client parses SSE by splitting on `\n\n` (double newline):

```js
// integrations.js:98 (client)
const messages = buffer.split('\n\n');
```

And then extracts data by finding lines starting with `data: `:

```js
// integrations.js:68
} else if (line.startsWith('data: ')) {
  data = line.slice(6);
}
```

**The problem:** If `JSON.stringify(result)` produces a string that, by any chance, contains a literal `\n\n` sequence (which shouldn't happen in well-formed JSON, but could in edge cases with malformed model output), the SSE framing breaks. The client would split the `data:` payload in the middle and fail to parse.

More practically: if the result JSON is ~80KB (8 comprehensive prompts), that entire 80KB goes as one `data:` line. While SSE technically supports this, some proxy layers (nginx, Vercel edge, CloudFlare) may have line-length limits or buffer boundaries that interfere. The `X-Accel-Buffering: no` header helps but doesn't cover all edge infrastructure.

**Risk level:** Low for local development, higher for deployed environments behind proxies.

---

## Issue 11: Progress Keepalive Granularity May Be Too Coarse

```js
// llm.service.js:128
if (chunkCount % 50 === 0) {
```

Progress events fire every 50 text delta chunks. For a typical Anthropic streaming response, a "chunk" is 1-10 tokens. At ~5 tokens/chunk average, 50 chunks ≈ 250 tokens ≈ ~190 words. For a 32K token generation, that's roughly 130 progress events over the full generation.

That's probably fine — the real risk is the **beginning of generation**. If the model takes time "thinking" before its first text delta (common with complex prompts), no progress events fire during that thinking time. If the initial latency exceeds the SSE connection's idle timeout (often 30-60s in proxies), the connection may drop before any data arrives.

The Anthropic SDK timeout is set to 600s (`llm.service.js:11`), but the **client's fetch** has no explicit timeout — it relies on the browser's default (which varies, but is typically fine). The real risk is a load balancer between client and server timing out during the model's initial "thinking" pause.

---

## Issue 12: The JSON Schema Is a Decoration, Not a Constraint

The `response_json_schema` is passed from the client to the server (`integrations.js:35`) but look at how it's used in `llm.service.js`:

```js
// llm.service.js:47-49
if (response_json_schema) {
  systemMessage += ' Always respond with valid JSON that matches the requested schema...';
}
```

The schema is **not passed to the Anthropic API call**. It's only used to append a sentence to the system prompt. The actual API call at `llm.service.js:107-117` doesn't include the schema in any structured way.

Compare this with what the Anthropic API supports:
- `tool_use` with strict schema validation
- Or at minimum, passing the schema structure in the prompt itself

Currently the model gets: "Always respond with valid JSON that matches the requested schema" — but the schema itself (the object at `DeliverableCreatorStep.jsx:774-796`) is never sent to the API. The model doesn't know what schema to match. It only knows from the prompt text to produce a JSON object with `deliverable_name`, `overview`, and `prompts`.

The `minItems: 8, maxItems: 8` constraints in the schema are completely invisible to the model.

---

## Issue 13: No Retry Logic for Partial Failures

When generation fails (JSON parse error, incomplete prompts, truncation), the user gets a toast: "Failed to generate prompts. Please try again." (`DeliverableCreatorStep.jsx:848-852`). There is no automatic retry.

Given that failures may be stochastic (the model sometimes fits 8 prompts, sometimes doesn't), a single automatic retry with adjusted parameters (e.g., slightly shorter prompt, or a "compact mode" instruction) could significantly improve the success rate without user intervention.

---

## Issue 14: The Meta Prompt and Section A Were Written for Different Audiences

This is a design-level issue, not a bug:

- **Universal Rules 1-10 + Prompt Structure** are written as instructions to the meta-prompt generator ("generate prompts that tell the executing AI to do X").
- **Section A** is written as instructions to the executing AI directly ("apply these rules to EVERY output generated in this session").

The meta prompt generator receives both and has to interpret Section A as "embed these instructions in the prompts I generate" rather than "follow these rules myself." But Section A doesn't say that — it says "Apply these rules to EVERY output generated in this session." From the model's perspective, IT is the session, and IT should apply these rules to ITS output (the JSON).

This causes the model to waste effort trying to comply with Section A's rules on the JSON generation itself (e.g., adding theme toggles, WCAG compliance, footer lines to... a JSON object), or to get confused about whether these rules are for itself or for the prompts it's generating.

---

## Ideas for Fixing — Ranked by Impact

### Tier 1: High impact, low risk

**1a. Check stop_reason — the single most important fix**
- After the streaming loop, call `stream.finalMessage()` to get the full response metadata.
- If `stop_reason === 'max_tokens'`, the output was truncated. Log it, and either retry with a shorter prompt or surface a specific error.
- This turns a silent, mysterious failure into a diagnosable event.
- **5-line code change in `llm.service.js`.**

**1b. Remove Section A19 from the meta prompt**
- Cut lines 549-752 from `DeliverableCreatorStep.jsx`
- A19 is not actionable during generation. It saves ~2,857 input tokens and removes a major attention distraction.
- Instead, add a brief instruction: "Prompts 7 and 8 should instruct the executing AI to follow Section A19 (Functional Render Injection) rules when producing interactive artifacts."
- The full A19 text could be injected by the *generated* prompts themselves, or carried in project knowledge files that the user pastes alongside the prompt.

**1c. Remove or reframe Section A — it's addressed to the wrong audience**
- Section A says "Apply these rules to EVERY output generated in this session" — but the meta prompt generator's session output is JSON, not HTML artifacts.
- Either remove Section A entirely (let the Universal Rules carry it) or rewrite it as: "The following rules must be embedded INSIDE the generated prompt text, not applied to this JSON generation call."
- This fixes Issue 14 (audience confusion) and Issue 3 (duplication) simultaneously.

**1d. Add post-generation validation**
- After `JSON.parse()`, check `result.prompts.length === 8`
- Check each `prompt` field is >= 2,000 characters (roughly 500 words minimum)
- If validation fails, retry once with a simplified prompt, or surface a specific error: "Only 5 of 8 prompts were generated at sufficient quality. Retry?"

### Tier 2: Medium impact, medium effort

**2a. Pass the JSON schema to the API, not just to the system prompt**
- Currently the schema object is passed from the client but only triggers a generic system prompt addition.
- Option A: Include the schema as structured text in the prompt itself.
- Option B: Use Anthropic's `tool_use` mode which enforces schema structure.
- Either way, the model would actually *see* the `minItems: 8` constraint.

**2b. Split generation into two calls**
- Call 1: Generate prompts 1-4 (with full rules + context)
- Call 2: Generate prompts 5-8 (with full rules + context + summary of prompts 1-4 titles)
- Each call only needs to produce ~4 prompts within 32K output — comfortably fits at target quality.
- Downside: 2x API cost, 2x latency, need to merge results.

**2c. Soften the "embed ALL rules" instruction**
- Change from: "Embed the DCE rules, the role context, the deliverable name, and all relevant specifications directly inside each prompt's text."
- To: "Each prompt must include the role context and deliverable name. Include the 3-4 DCE rules most relevant to that specific step. Reference the full rule set by name rather than repeating it verbatim."
- This lets the model allocate more output tokens to step-specific content.

**2d. Move knowledge files after the meta prompt, not before**
- Currently: `[KNOWLEDGE FILES]\n\n[META PROMPT]`
- Change to: `[META PROMPT]\n\n[KNOWLEDGE FILES — USE AS CONTEXT]`
- Ensures the generation instructions get primary attention position.

**2e. Raise max_tokens to 128,000**
- `llm.service.js:109` — change `max_tokens: 32768` to `128000`
- **CONFIRMED:** Claude Opus 4.6 supports up to 128K output tokens on the sync Messages API, and 300K on the Batch API (with `output-300k-2026-03-24` beta header). The current 32K setting uses only 25% of the model's capacity. Source: [Anthropic Models Overview](https://platform.claude.com/docs/en/docs/about-claude/models/overview)
- This alone may eliminate the primary failure mode (output truncation/thinning) without any prompt changes.
- Combined with stop_reason checking (1a), this provides both more room and visibility into when the room runs out.

### Tier 3: Lower priority, worth tracking

**3a. Use a task-specific system prompt**
- Replace generic "helpful assistant" with something like:
  "You are the DCE Meta Prompt Generator. Your sole job is to produce a JSON object containing exactly 8 comprehensive, self-contained prompts. Each prompt must be 800-2000 words. Never produce fewer than 8 prompts. Never truncate. If you cannot fit all 8 at target quality, compress the repeated boilerplate rules rather than the step-specific content."

**3b. Add streaming progress validation**
- During the streaming loop (`llm.service.js:123-135`), count how many `"step":` markers have appeared in the accumulated content.
- If the stream ends and fewer than 8 steps are detected, flag it before parsing.

**3c. Add automatic retry with fallback prompt**
- On first failure (parse error, incomplete prompts, stop_reason=max_tokens), retry once with:
  - A shorter prompt (strip Section A + A19)
  - Or a "compact mode" instruction: "Generate 8 prompts, each 500-800 words. Prioritize step-specific content over repeated boilerplate."
- Gives the user a degraded-but-complete result rather than a hard failure.

**3d. Progressive generation with caching**
- Generate prompt 1, cache it. Generate prompt 2 with prompt 1's summary as context, cache it. Etc.
- Maximum quality per prompt, no token ceiling pressure.
- Downside: 8 sequential API calls, much higher latency.

**3e. Create a "DCE Rules Reference" that generated prompts can link to**
- Instead of embedding all rules in every prompt, generate a "Prompt 0: DCE Rules Reference" that the user pastes once at the start of a Claude project.
- Prompts 1-8 then say "Apply the DCE Universal Rules from your project knowledge" — much shorter, same effect.
- This is an architectural shift in how the DCE is used, not just a prompt change.

**3f. Chunk the SSE complete payload for proxy safety**
- Instead of sending the entire 80KB JSON as one `data:` line, split it into multiple SSE events (e.g., one per prompt) and reassemble on the client.
- Reduces risk of proxy buffer limits breaking the payload in deployed environments.

---

## Immediate Diagnostic Steps (No Code Changes Required)

To confirm these issues empirically:

1. **Check stop_reason on next generation**: Add a temporary `console.log` after the streaming loop to capture `stream.finalMessage().stop_reason`. If it says `max_tokens`, truncation is confirmed as a live issue.

2. **Log individual prompt lengths**: After `JSON.parse()`, log each `result.prompts[i].prompt.length`. See if later prompts are systematically shorter (the "thinning out" pattern).

3. **Log total output size**: The existing log at `llm.service.js:137` shows `content.length`. Check server logs for recent generations — if they cluster near a ceiling (e.g., all around 130,000-131,000 chars), that's the max_tokens wall.

4. **Test with A19 removed manually**: Temporarily comment out lines 549-752 in the JSX and run a generation. Compare prompt quality and completeness.

5. **Test with max_tokens: 65536**: Change the one number, run a generation. See if the model uses the additional budget and produces fuller later prompts.

6. **Test with knowledge files disabled**: Run a generation with no knowledge files attached to isolate whether input context size is a factor.

7. **Test with Section A removed**: Comment out lines 465-547. If prompt quality improves, the audience confusion (Issue 14) is confirmed.

8. **Compare a "clean" generation**: Temporarily strip the prompt to just Universal Rules + Prompt Structure + JSON schema (no Section A, no A19, no knowledge files, no website scrape). This is the control group — if 8 full prompts come back at target quality, every issue above is confirmed by elimination.

---

## Failure Mode Summary

| Failure Mode | User Sees | Root Cause | Issues |
|---|---|---|---|
| "Failed to generate prompts" toast | JSON parse error | Output truncated at max_tokens, no stop_reason check | 1, 9 |
| 8 prompts but later ones are thin | Degraded quality | Token pressure forces model to compress | 1, 4 |
| Fewer than 8 prompts, no error | Missing prompts silently | Model closes JSON early, no count validation | 5, 9, 12 |
| "Stream ended without a result" | Client-side error | SSE payload fragmented by proxy | 10, 11 |
| All 8 prompts but Section A rules applied to JSON itself | Confused output | Section A addressed to wrong audience | 14 |
| Prompts don't carry A19 rules where needed | Execution-time failure | A19 in meta prompt but not forwarded to generated prompts | 2 |

---

## Files Involved

| File | Role |
|---|---|
| `src/components/flow/DeliverableCreatorStep.jsx:283-769` | Meta prompt text (Executive mode) |
| `server/src/services/llm.service.js:107-117` | API call with max_tokens, system prompt, streaming |
| `server/src/services/llm.service.js:123-135` | Streaming loop — no stop_reason capture |
| `server/src/services/llm.service.js:144-181` | JSON parsing with no completeness validation |
| `server/src/services/llm.service.js:45-49` | Generic system prompt, schema not passed to API |
| `server/src/config.js:36` | Model config (default: claude-opus-4-6) |
| `server/src/routes/integrations.js:104` | SSE complete event — full JSON in single data: line |
| `server/src/routes/deliverable.js:32-61` | Working mode system prompt (for comparison) |
| `src/api/integrations.js:57-106` | Client-side SSE parser |
| `vercel.json` | maxDuration: 800s (sufficient, not a bottleneck) |

---

# Issues Ranked: Most Likely → Least Likely

Ranked by probability of being the active cause of "prompts not firing all steps" when the user copies them into Claude.ai sessions.

## Rank 1 — ALMOST CERTAIN: Output Token Ceiling (Issues 1 + 9)

**Why this is #1:** The math doesn't lie. You're asking for 8 × 2,000-word prompts (16,000+ words) inside a 32,768-token output ceiling. With JSON escaping and boilerplate repetition, the model needs ~33,000+ tokens but only has 32,768. The model either truncates (hard failure) or self-compresses later prompts (silent quality degradation). And because stop_reason is never checked, you can't even tell when this happens.

**KEY FINDING:** Claude Opus 4.6 actually supports **128,000 output tokens** (sync API) and **300,000 output tokens** (Batch API). The current 32,768 setting is a self-imposed ceiling using only 25% of the model's capacity. Source: [Anthropic Models Overview](https://platform.claude.com/docs/en/docs/about-claude/models/overview). Raising `max_tokens` to 128000 gives 4x headroom and may resolve this issue entirely.

**What the user sees:** Prompts 6-8 are thin — they contain the step title and a vague summary instead of the full self-contained instruction set with Magic Wand, Expert Panel, Pre-mortem, MCQ protocol, etc. When pasted into Claude.ai, the executing AI doesn't fire those rules because the prompt literally doesn't contain them.

**Confidence: 95%** — This is the primary failure mode.

## Rank 2 — HIGHLY LIKELY: "Embed ALL rules in EVERY prompt" Collides with Token Budget (Issue 4)

**Why this is #2:** Even if the model had enough output tokens, the instruction to repeat ~800 words of DCE boilerplate in each of 8 prompts creates a 6,400-word overhead. The model faces a choice: repeat the rules and thin out the step-specific content, OR write rich step-specific content and skip some rules. Either way, something doesn't fire. The model typically chooses a middle ground — it includes some rules in early prompts and progressively fewer in later ones.

**What the user sees:** Prompt 1 has full rules. Prompt 4 has most rules. Prompt 7 has a one-line mention of "apply DCE methodology" instead of the actual rules. When pasted, the executing AI doesn't know what DCE methodology means because it's in a fresh session.

**Confidence: 90%** — This is the secondary compounding factor.

## Rank 3 — HIGHLY LIKELY: Section A Confuses the Generator (Issue 14 + Issue 3)

**Why this is #3:** Section A says "Apply these rules to EVERY output generated in this session." The meta-prompt generator interprets this ambiguously — should it apply Inter font and WCAG AA to its JSON output? Should it apply the MCQ protocol to its own generation? The model burns attention resolving this confusion, and the rules that were meant to be embedded in the generated prompts may instead get applied (incorrectly) to the JSON generation itself, or dropped entirely.

The duplication between Universal Rules and Section A compounds this — the model sees the same concept twice in different phrasings and doesn't know which is authoritative or who each version is for.

**What the user sees:** Generated prompts may contain garbled or inconsistent rule references. Some prompts reference "Section A" without including the actual rules. The MCQ protocol instructions may vary between prompts because the model was pulling from two conflicting sources.

**Confidence: 80%**

## Rank 4 — LIKELY: Section A19 Wastes 42% of Attention Budget (Issue 2)

**Why this is #4:** A19 is 2,143 words about functional render injection — engagement modes, React sandbox rules, refusal envelopes, ribbon styling. None of this is actionable during JSON generation. But the model still has to read and process it, reducing the attention available for the actual task. More critically: the model may try to embed A19 rules in EVERY prompt (because of the "embed ALL rules" instruction), when A19 is only relevant to prompts 7-8 at most.

**What the user sees:** Earlier prompts may waste space on A19 references that don't apply. Later prompts may be even thinner because the model allocated token budget to embedding irrelevant A19 content in prompts 1-6.

**Confidence: 75%**

## Rank 5 — LIKELY: Knowledge Files Bury the Instructions (Issue 6)

**Why this is #5:** Knowledge files are prepended BEFORE the meta prompt. If a user uploads a 20-page company dossier, the model reads 30,000+ tokens of company data and then hits the DCE generation instructions at the very end. Attention to instructions in the tail of a long context is measurably weaker. The model may produce prompts that are rich in company context but thin on DCE methodology rules.

**What the user sees:** Generated prompts reference company specifics well but don't include the full MCQ protocol, Expert Panel requirements, or Pre-mortem structure. The rules that should fire in every prompt are attenuated.

**Confidence: 65%**

## Rank 6 — MODERATE: Schema Constraints Are Invisible to the Model (Issue 12)

**Why this is #6:** The JSON schema with `minItems: 8` is never sent to the API. The model only knows "8 prompts" from the prose in the prompt text. If the model runs short on space, there's no structural guardrail preventing it from closing the JSON array at 5 or 6 prompts. Combined with no validation on the code side (Issue 5), this means fewer-than-8 prompts can sail through silently.

**What the user sees:** Sometimes only 5-7 prompt cards appear in the UI. No error message. They might not even notice prompts are missing.

**Confidence: 50%**

## Rank 7 — MODERATE: No Post-Generation Validation (Issue 5)

**Why this is #7:** Even when the model does produce 8 prompts, there's no check that they're substantive. A prompt could be 50 words ("Generate V2 of the deliverable using best practices and expert panel review") and it would pass validation. The UI would show it, the user would paste it, and Claude.ai would produce a generic output without the DCE rules firing.

**What the user sees:** All 8 cards appear. But some prompts are too vague to drive the full DCE methodology in the execution session.

**Confidence: 50%**

## Rank 8 — MODERATE: Generic System Prompt (Issue 7)

**Why this is #8:** "You are a helpful assistant that generates structured JSON responses" doesn't prime the model for the complexity of what's about to be asked. A task-specific system prompt would establish that this is a meta-prompt generation task, that exactly 8 comprehensive prompts are non-negotiable, and that output quality should degrade the boilerplate repetition before degrading the step-specific content.

**What the user sees:** Inconsistent quality between generations. Sometimes the model "gets it" and produces great output; sometimes it treats this as a generic JSON task and produces thin results.

**Confidence: 40%**

## Rank 9 — LOW: No Retry Logic (Issue 13)

**Why this is #9:** This doesn't cause failures — it just means every failure is a hard stop that the user must manually retry. Given that some failures are stochastic (the model sometimes fits, sometimes doesn't), automatic retry would meaningfully improve success rate.

**What the user sees:** "Failed to generate prompts" toast. Has to click the button again. May get a different (better or worse) result.

**Confidence as root cause: 10%** — but high impact as an amplifier.

## Rank 10 — LOW: SSE Payload Fragility (Issue 10)

**Why this is #10:** The 80KB single-line SSE payload is a theoretical risk, mostly relevant in deployed environments behind proxy layers. In local development, this almost certainly isn't an issue. On Vercel, the `X-Accel-Buffering: no` header and the 800s maxDuration should cover it.

**What the user sees:** "Stream ended without a result" — but only if deployed behind a proxy with strict buffer limits.

**Confidence: 15% in production, 5% locally**

## Rank 11 — LOW: Keepalive Granularity (Issue 11)

**Why this is #11:** Progress events every 50 chunks is probably fine. The only risk is the initial thinking pause before the first token, which could trigger an idle timeout on some proxies. This would manifest as a complete connection drop, not a quality issue.

**What the user sees:** "Failed to generate prompts" before any prompts appear — a full timeout, not a partial result.

**Confidence: 10%**

## Rank 12 — REFERENCE ONLY: Working Mode Comparison (Issue 8)

Not a bug — included as evidence that the architecture works when the prompt is lean and the output format is flexible.

---

# Solutions — Zero Quality Loss

Every solution below preserves the full DCE instruction set. Nothing is removed — the instructions are reorganized so the model can execute all of them within the available token budget.

## Solution A: Two-Pass Generation with Full Rules per Pass

**What changes:** Split the single API call into two sequential calls.

- **Pass 1:** Generate prompts 1-4. The meta prompt includes ALL Universal Rules, Section A, and prompt definitions 1-4 only. max_tokens: 32768. The model has the full rule set and only needs to produce 4 comprehensive prompts — well within budget at 2,000+ words each.

- **Pass 2:** Generate prompts 5-8. Same meta prompt with ALL rules, but now includes prompt definitions 5-8 and a summary of what prompts 1-4 covered (titles only, not full text). Section A19 is included ONLY in Pass 2, since it's relevant to prompts 7-8.

**What this preserves:** Every rule, every framework, every word of instruction. The model sees the full quality bar each time. It just has half the output volume to produce per call.

**What this fixes:** Issues 1, 2, 4, 9 (output ceiling, A19 attention, embed-all pressure, truncation).

**Trade-off:** 2x API calls, ~2x latency, ~2x cost. Need to merge results on the server. UI needs a progress indicator for "Generating prompts 1-4..." then "Generating prompts 5-8..."

## Solution B: Separate Instruction Layers — "Rules for You" vs. "Rules to Embed"

**What changes:** Restructure the meta prompt into two clearly separated sections with explicit audience labels:

```
═══ INSTRUCTIONS FOR THIS GENERATION CALL ═══
(these rules govern how YOU produce the JSON output)
- Produce exactly 8 prompts
- Each prompt must be 800-2000+ words
- Return valid JSON matching [schema]
- Never produce fewer than 8 prompts
- If running low on space, compress boilerplate repetition, not step-specific content

═══ RULES TO EMBED INSIDE EACH GENERATED PROMPT ═══
(copy these into the "prompt" field text — they are for the EXECUTING AI, not for you)
[Universal Rules 1-10]
[Section A design rules]
[Section A19 — only in prompts 7-8]
```

**What this preserves:** Every rule intact. The model sees the full instruction set. But now it knows unambiguously: "The Universal Rules are not for me to follow — they're text I embed in my output."

**What this fixes:** Issues 3, 14 (duplication, audience confusion). Partially fixes Issue 4 (the model understands the embed instruction is about copying text, not about following rules during JSON generation).

**Trade-off:** Prompt restructure effort. Testing to confirm the model respects the separation.

## Solution C: Raise max_tokens to 128K + stop_reason Check + Validation Gate

**Critical discovery:** The current `max_tokens: 32768` is using only **25% of the model's actual capacity.** Per the [official Anthropic docs](https://platform.claude.com/docs/en/docs/about-claude/models/overview):

| Model | Current Setting | Actual Max (Sync API) | Actual Max (Batch API) |
|---|---|---|---|
| Claude Opus 4.6 (our model) | 32,768 | **128,000** | 300,000 |
| Claude Opus 4.7 (latest) | — | 128,000 | 300,000 |
| Claude Sonnet 4.6 | — | 64,000 | 300,000 |

At 128K output tokens, even the worst-case scenario (8 × 2,000-word prompts with full boilerplate repetition = ~33K tokens) uses only **26% of the available budget**. This single change may resolve the primary failure mode (Issue 1) entirely without any prompt modifications.

**What changes:** Three small code changes, no prompt changes at all:

1. `llm.service.js:109` — raise `max_tokens` from `32768` to `128000`.

2. `llm.service.js:135` — after the streaming loop, check stop_reason:
```js
const finalMessage = await stream.finalMessage();
if (finalMessage.stop_reason === 'max_tokens') {
  console.error('OUTPUT TRUNCATED — hit max_tokens ceiling');
  throw new Error('Generation truncated. Output exceeded token limit.');
}
```

3. `llm.service.js:160` — after JSON.parse, validate:
```js
if (parsed.prompts?.length !== 8) {
  throw new Error(`Expected 8 prompts, got ${parsed.prompts?.length}`);
}
for (let i = 0; i < parsed.prompts.length; i++) {
  if (parsed.prompts[i].prompt.length < 2000) {
    console.warn(`Prompt ${i+1} is only ${parsed.prompts[i].prompt.length} chars (min: 2000)`);
  }
}
```

**What this preserves:** The entire prompt, unchanged. No instruction quality loss. Just gives the model more room and adds visibility + guardrails.

**What this fixes:** Issues 1, 5, 9 (token ceiling, no validation, silent truncation).

**Trade-off:** None meaningful. Slightly higher API cost if the model uses more output tokens.

## Solution D: Move Knowledge Files Behind the Prompt + Task-Specific System Prompt

**What changes:** Two changes in `llm.service.js`:

1. Reorder the enriched prompt construction so knowledge files appear AFTER the meta prompt:
```js
// Before: [KNOWLEDGE FILES]\n\n[WEBSITE CONTEXT]\n\n[META PROMPT]
// After:  [META PROMPT]\n\n[KNOWLEDGE FILES]\n\n[WEBSITE CONTEXT]
enrichedPrompt = `${prompt}\n\n${knowledgeContext}\n\n${websiteContext}`;
```

2. Replace the generic system message with:
```
You are the DCE Meta Prompt Generator. Your task: produce a JSON object containing exactly 8 comprehensive, self-contained prompts.

CRITICAL REQUIREMENTS:
- Exactly 8 prompts in the array — never fewer, never more
- Each prompt must be 800-2000+ words of complete, standalone instruction
- Each prompt must embed ALL DCE rules (Magic Wand, Pre-mortem, Expert Panel, MCQ, Context Window, Formatting) so a fresh AI session can execute without any other context
- If you sense you are running low on output space, compress the BOILERPLATE REPETITION (shorten the rule embedding), NEVER the step-specific content
- Return ONLY valid JSON — no markdown, no explanations

Always respond with valid JSON matching the requested schema.
```

**What this preserves:** All instructions, all knowledge file content. Just changes the order so the model reads the task instructions first (high attention) and reference material second.

**What this fixes:** Issues 6, 7 (knowledge file burial, generic system prompt).

**Trade-off:** Minimal. The knowledge files are still there — just positioned where the model treats them as reference context rather than primary instructions.

## Solution E: Schema-Enforced Generation via tool_use

**What changes:** Switch from "ask the model to produce JSON" to Anthropic's `tool_use` mode, which enforces the output schema structurally.

Define a tool called `generate_dce_pack` with the exact schema:
```js
tools: [{
  name: "generate_dce_pack",
  description: "Generate the 8-prompt DCE pack",
  input_schema: {
    type: "object",
    properties: {
      deliverable_name: { type: "string" },
      overview: { type: "string", minLength: 100 },
      prompts: {
        type: "array",
        minItems: 8,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            step: { type: "number" },
            title: { type: "string" },
            description: { type: "string" },
            prompt: { type: "string", minLength: 2000 }
          },
          required: ["step", "title", "description", "prompt"]
        }
      }
    },
    required: ["deliverable_name", "overview", "prompts"]
  }
}],
tool_choice: { type: "tool", name: "generate_dce_pack" }
```

The API enforces the schema — 8 prompts, minimum 2000 chars each. The model can't close the array early or skip prompts.

**What this preserves:** All instructions. The meta prompt stays the same — it's just the output mechanism that changes from "please write JSON" to "call this tool with these constraints."

**What this fixes:** Issues 5, 12 (no validation, schema decoration). Partially fixes Issue 1 (the model still can't exceed max_tokens, but it can't cheat by producing fewer prompts).

**Trade-off:** Requires refactoring `llm.service.js` to handle tool_use responses. The schema `minLength` enforcement may or may not be strictly validated server-side by Anthropic (needs testing). Tool_use responses may have different token consumption characteristics.

## Solution F: Progressive Generation — One Prompt Per Call

**What changes:** Generate each prompt individually in its own API call.

For each of prompts 1-8:
- Send the full meta prompt with ALL rules
- But ask for only ONE prompt at a time: "Generate ONLY Prompt [N]: [title]. Return a single JSON object with step, title, description, and prompt fields."
- Collect all 8 results and assemble into the final array

**What this preserves:** Maximum quality. Each prompt gets the full 32K (or 65K) output budget and the model's full attention. Every DCE rule can be embedded comprehensively in every single prompt because there's no token competition between prompts.

**What this fixes:** Issues 1, 4, 9 (token ceiling, embed-all pressure, truncation). This is the nuclear option that eliminates the output budget problem entirely.

**Trade-off:** 8x API calls, 8x cost, significant latency (though calls could be parallelized 2-4 at a time). Need progress UI ("Generating prompt 3 of 8..."). Most expensive solution.

---

# Issue → Solution Matrix

Every issue mapped to which solutions address it, and whether the fix is full or partial.

| Issue | Description | Sol A (Two-Pass) | Sol B (Audience Labels) | Sol C (128K + stop_reason + validation) | Sol D (Reorder + System Prompt) | Sol E (tool_use schema) | Sol F (One Per Call) |
|---|---|---|---|---|---|---|---|
| **1. Output token ceiling** | 32K is 25% of model capacity; output doesn't fit | FULL | — | **FULL** | — | Partial | FULL |
| **2. A19 irrelevant to generation** | 2,143 words of attention waste on rules that don't fire | FULL (A19 only in Pass 2) | Partial (labeled as embed-only) | — | — | — | FULL (each call focused) |
| **3. Duplicated rules** | Universal Rules and Section A conflict | — | **FULL** (single source of truth) | — | — | — | — |
| **4. Embed ALL rules × 8 prompts** | Exponential output demand from boilerplate repetition | FULL (only 4 prompts per pass) | Partial (model knows it's copying, not following) | **Partial** (128K gives room to actually do it) | Partial (system prompt says compress boilerplate before content) | — | FULL (no competition between prompts) |
| **5. No post-generation validation** | Thin/missing prompts pass silently | — | — | **FULL** (count + length check) | — | **FULL** (schema enforced) | FULL (validated per prompt) |
| **6. Knowledge files bury instructions** | Dossiers prepended before meta prompt | — | — | — | **FULL** (meta prompt first) | — | — |
| **7. Generic system prompt** | "Helpful assistant" doesn't prime for the task | — | — | — | **FULL** (task-specific system prompt) | — | — |
| **8. Working mode comparison** | Reference only — not a bug | — | — | — | — | — | — |
| **9. stop_reason never checked** | Silent truncation, no visibility | — | — | **FULL** (stop_reason check) | — | — | FULL (per-call check) |
| **10. SSE payload fragility** | 80KB single-line payload, proxy risk | — | — | — | — | — | Partial (smaller payloads per call) |
| **11. Keepalive granularity** | Initial thinking pause may timeout | — | — | — | — | — | — |
| **12. Schema invisible to model** | minItems: 8 constraint never sent to API | — | — | — | — | **FULL** (schema enforced by API) | — |
| **13. No retry logic** | Every failure is a hard stop for the user | — | — | Partial (validation enables smart retry) | — | — | Partial (can retry single prompt) |
| **14. Section A wrong audience** | "Apply to every output" confuses generator | — | **FULL** (explicit audience separation) | — | Partial (system prompt clarifies task) | — | — |

### Coverage Summary

| Solution | Issues Fully Fixed | Issues Partially Fixed | Issues Not Addressed | Effort |
|---|---|---|---|---|
| **C: 128K + stop_reason + validation** | 1, 5, 9 | 4, 13 | 2, 3, 6, 7, 10, 11, 12, 14 | **Low** (3 code changes, no prompt changes) |
| **D: Reorder + System Prompt** | 6, 7 | 4, 14 | 1, 2, 3, 5, 9, 10, 11, 12, 13 | **Low** (2 code changes, no prompt changes) |
| **B: Audience Labels** | 3, 14 | 2, 4 | 1, 5, 6, 7, 9, 10, 11, 12, 13 | **Medium** (prompt restructure) |
| **A: Two-Pass** | 1, 2, 4, 9 | — | 3, 5, 6, 7, 10, 11, 12, 13, 14 | **Medium** (code + UI changes) |
| **E: tool_use Schema** | 5, 12 | 1 | 2, 3, 4, 6, 7, 9, 10, 11, 13, 14 | **Medium** (llm.service refactor) |
| **F: One Per Call** | 1, 4, 5, 9 | 2, 10, 13 | 3, 6, 7, 11, 12, 14 | **High** (8x API calls, progress UI) |

### What "Raise max_tokens Only" Leaves Unfixed

If we ONLY do `max_tokens: 128000` (without stop_reason check or validation):

| Still Broken | Why It Matters |
|---|---|
| Issue 2 (A19 attention waste) | Model still reads 2,143 words of irrelevant rules, reducing focus on actual task |
| Issue 3 (duplicated rules) | Model still sees conflicting phrasings of the same rules |
| Issue 5 (no validation) | If model produces 6 thin prompts in valid JSON, no error is raised |
| Issue 6 (knowledge file ordering) | Instructions still buried after dossier content |
| Issue 7 (generic system prompt) | Model still not primed for the specific task complexity |
| Issue 9 (stop_reason) | If something DOES truncate (edge case), still no visibility |
| Issue 12 (invisible schema) | Model still doesn't see minItems: 8 constraint |
| Issue 14 (wrong audience) | Section A still confuses the generator about who the rules are for |

**Bottom line:** Raising max_tokens eliminates the hard ceiling (Rank 1, 95% confidence) and gives the model room to handle the embed-all instruction (Rank 2). But 6 of the 14 issues are completely independent of output token limits. The attention, confusion, and validation issues persist regardless of how much room the model has to write.

### Minimum Viable Fix (Addresses All Critical Issues)

To cover every issue at Rank 5 or above (65%+ confidence):

**Solution C + Solution D + Solution B**

| Phase | Solution | Issues Fixed | Effort |
|---|---|---|---|
| Phase 1 | C: `max_tokens: 128000` + stop_reason + validation | 1, 5, 9 + partial 4, 13 | 3 code changes |
| Phase 1 | D: Reorder knowledge files + system prompt | 6, 7 + partial 4, 14 | 2 code changes |
| Phase 2 | B: Restructure prompt with audience labels | 3, 14 + partial 2, 4 | Prompt rewrite |

After Phase 1 + Phase 2, every issue at Rank 5 or above has at least a partial fix:

| Rank | Issue | Fixed By |
|---|---|---|
| **Rank 1** (95%) | Output token ceiling | **C** — FULL |
| **Rank 2** (90%) | Embed ALL rules pressure | **C** (room to do it) + **D** (system prompt prioritizes content) + **B** (model knows it's copying text) |
| **Rank 3** (80%) | Section A wrong audience + duplication | **B** — FULL |
| **Rank 4** (75%) | A19 attention waste | **B** — Partial (labeled as embed-only for prompts 7-8) |
| **Rank 5** (65%) | Knowledge files bury instructions | **D** — FULL |

Only Issue 2 (A19 attention) remains partially unresolved. To fully fix it, add Solution A (two-pass, A19 only in Pass 2) or simply add a one-line instruction in the prompt: "Section A19 content should only be embedded in Prompts 7 and 8."

## Recommended Combination

For maximum quality preservation with minimum risk:

**Phase 1 (immediate, no prompt changes, 5 code changes):**
- Solution C — raise max_tokens to 128000, check stop_reason, add validation gate
- Solution D — reorder knowledge files behind prompt, add task-specific system prompt
- Fixes: Issues 1, 5, 6, 7, 9. Partially: 4, 13, 14.

**Phase 2 (prompt restructure, no code changes):**
- Solution B — separate "rules for you" vs. "rules to embed" with explicit audience labels
- Fixes: Issues 3, 14. Partially: 2, 4.

**Phase 3 (if still failing after Phase 1+2):**
- Solution A — two-pass generation (prompts 1-4, then 5-8)
- Fixes: Issues 1, 2, 4, 9 completely.

**Phase 4 (if maximum quality is required for every user):**
- Solution F — one prompt per call (expensive but guaranteed)
- Fixes: Issues 1, 4, 5, 9 completely. Partially: 2, 10, 13.
