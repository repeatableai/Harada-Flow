# DCE Meta Prompt — Era 1: Genesis

> Commit: `8b3ea78` — Initial commit: Harada Flow
> Source: `src/components/flow/DeliverableCreatorStep.jsx:31-58`
> Prompt size: ~25 lines
> Prompts generated: 3-5 (variable)
> No methodology. No rules. No governance.

---

```
Role: ${company.job_title}
Company Size: ${company.company_size}
Industry: ${company.industry}
Selected Deliverable: ${selectedDeliverable.name}
Matrix Type: ${selectedDeliverable.type}

Create comprehensive, detailed, copy-paste ready prompts that a user can paste into any LLM to produce the selected deliverable.

The prompts should be:
1. Logically sequential (build on each other)
2. Highly detailed and specific
3. Ready to copy and paste
4. Tailored to the specific role and industry
5. Include all necessary context and requirements

Generate 3-5 prompts that walk through the complete creation process for this deliverable.

Return the data in JSON format with this structure:
{
  "deliverable_name": "${selectedDeliverable.name}",
  "overview": "Brief overview of what this deliverable is and why it's important",
  "prompts": [
    {
      "step": 1,
      "title": "Step Title",
      "description": "What this step accomplishes",
      "prompt": "The actual prompt to copy and paste into an LLM"
    }
  ]
}
```

---

## What existed

- Role context injection (job title, company size, industry, deliverable name, matrix type)
- JSON output schema (no enforcement — no minItems/maxItems)
- 3-5 generic sequential prompts

## What did NOT exist yet

- DCE Universal Rules (Magic Wand, Pre-Mortem, Expert Panel, MCQ, Fork Detection, Context Window, Completion-First, Output Format, Website Safety, Formatting)
- 8-prompt fixed structure
- Self-contained prompt requirement
- Section A governance (Inter font, theme toggle, WCAG AA, ACD, context window alerts)
- Section A19 Functional Render Injection
- Attending Asset Discovery
- Parallel Production Queue
- Portfolio Hub (Prompt 8)
- Time Study tracking
- Synthetic data labeling
- Company URL / web context
- Quality requirement (800-2000+ words per prompt)
- JSON schema enforcement (minItems/maxItems)
- Auto-save to library
- Trial account limits
