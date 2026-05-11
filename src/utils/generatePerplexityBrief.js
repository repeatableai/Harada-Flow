/**
 * Generates a Perplexity deep research brief for a deliverable.
 * Extracted from PerplexityPromptStep so both Working and Executive
 * flows can call it directly without rendering the full component.
 */

import { InvokeLLM } from '@/api/integrations';
import perplexityTemplate from '@/prompts/Perplexity_Research_Brief_Template.md?raw';

/**
 * @param {{ company: object, deliverable: object }} params
 * @returns {Promise<string>} The generated research brief text
 */
export async function generatePerplexityBrief({ company, deliverable }) {
  const inputs = {
    deliverable_name:        deliverable.name || 'Deliverable',
    deliverable_type:        deliverable.type || 'productivity',
    column_name:             deliverable.column || deliverable.category || 'General',
    deliverable_description: deliverable.description || deliverable.name || '',
    is_custom:               String(deliverable.isCustom || false),
    job_title:               company.job_title || 'Executive',
    industry:                company.industry || 'General',
    company_size:            company.company_size || 'Unknown',
    company_url:             company.company_url || 'Not provided',
    dossier_summary:         company.dossier_content
                               ? company.dossier_content.substring(0, 500)
                               : 'No dossier available',
  };

  // Interpolate all {{variable}} placeholders in the template
  let rendered = perplexityTemplate;
  for (const [key, value] of Object.entries(inputs)) {
    rendered = rendered.replaceAll(`{{${key}}}`, value);
  }

  const result = await InvokeLLM({
    prompt: rendered,
    add_context_from_internet: !!company.company_url,
    operationType: 'perplexity_research_brief',
    operationName: deliverable.name,
    companyId: company.id,
    industry: company.industry,
    companySize: company.company_size,
    deliverableName: deliverable.name,
  });

  // The LLM returns the brief as plain text (possibly wrapped in backticks)
  const raw = typeof result === 'string'
    ? result
    : (result.research_brief || result.text || JSON.stringify(result, null, 2));
  return raw.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
}
