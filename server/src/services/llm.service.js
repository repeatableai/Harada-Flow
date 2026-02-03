import Anthropic from '@anthropic-ai/sdk';
import config from '../config.js';
import { scrapeCompanyWebsite } from './scraper.service.js';
import { createTimeStudy } from './timeStudy.service.js';

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
});

export async function invokeLLM({
  prompt,
  response_json_schema,
  add_context_from_internet,
  company_url,
  // Time study tracking params
  operationType,
  operationName,
  companyId,
  userId,
  // Dynamic baseline params
  industry,
  companySize,
  deliverableName,
}) {
  if (!config.anthropic.apiKey) {
    throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY in your .env file.');
  }

  // Start timing for time study tracking
  const startTime = Date.now();

  try {
    // Build the system message for JSON responses
    let systemMessage = 'You are a helpful assistant that generates structured JSON responses.';

    if (response_json_schema) {
      systemMessage += ' Always respond with valid JSON that matches the requested schema. Do not include any explanations, markdown formatting, or code blocks - only the raw JSON object.';
    }

    // Scrape company website for context if requested
    let enrichedPrompt = prompt;
    if (add_context_from_internet && company_url) {
      console.log(`Scraping company website for context: ${company_url}`);
      const websiteContext = await scrapeCompanyWebsite(company_url);

      if (websiteContext) {
        enrichedPrompt = `${websiteContext}\n\n${prompt}`;
        console.log(`Added ${websiteContext.length} chars of website context to prompt`);
      } else {
        console.log('No website content scraped, proceeding without context');
      }
    }

    const message = await anthropic.messages.create({
      model: config.anthropic.model,
      max_tokens: 8192,
      system: systemMessage,
      messages: [
        {
          role: 'user',
          content: enrichedPrompt,
        },
      ],
    });

    // Extract the text content from the response
    const content = message.content[0]?.text;

    if (!content) {
      throw new Error('No response content from Anthropic');
    }

    // Parse JSON response if schema was provided
    if (response_json_schema) {
      try {
        // Clean the response - remove any markdown code blocks if present
        let cleanedContent = content.trim();

        // Remove markdown code blocks if present
        if (cleanedContent.startsWith('```json')) {
          cleanedContent = cleanedContent.slice(7);
        } else if (cleanedContent.startsWith('```')) {
          cleanedContent = cleanedContent.slice(3);
        }
        if (cleanedContent.endsWith('```')) {
          cleanedContent = cleanedContent.slice(0, -3);
        }
        cleanedContent = cleanedContent.trim();

        const parsed = JSON.parse(cleanedContent);

        // Save time study if tracking params provided
        await saveTimeStudyIfTracking({
          startTime,
          operationType,
          operationName,
          companyId,
          userId,
          industry,
          companySize,
          deliverableName,
        });

        return parsed;
      } catch (parseError) {
        console.error('Failed to parse LLM JSON response:', content);
        console.error('Parse error:', parseError.message);
        throw new Error('Invalid JSON response from LLM');
      }
    }

    // Save time study if tracking params provided
    await saveTimeStudyIfTracking({
      startTime,
      operationType,
      operationName,
      companyId,
      userId,
      industry,
      companySize,
      deliverableName,
    });

    return content;
  } catch (error) {
    console.error('Anthropic API error:', error);

    if (error.status === 401) {
      throw new Error('Invalid Anthropic API key. Please check your configuration.');
    }

    if (error.status === 429) {
      throw new Error('Anthropic API rate limit exceeded. Please try again later.');
    }

    if (error.status === 400) {
      throw new Error('Invalid request to Anthropic API: ' + error.message);
    }

    throw error;
  }
}

/**
 * Helper to save time study record if tracking parameters are provided
 */
async function saveTimeStudyIfTracking({
  startTime,
  operationType,
  operationName,
  companyId,
  userId,
  industry,
  companySize,
  deliverableName,
}) {
  if (!operationType || !companyId || !userId) {
    return null;
  }

  try {
    const endTime = Date.now();
    const actualMinutes = (endTime - startTime) / (1000 * 60); // Convert ms to minutes

    const timeStudy = await createTimeStudy({
      operationType,
      operationName,
      actualMinutes,
      companyId,
      userId,
      industry,
      companySize,
      deliverableName,
    });

    console.log(`Time study saved: ${operationType} - ${actualMinutes.toFixed(2)} minutes (saved ${timeStudy.minutesSaved.toFixed(0)} minutes)`);
    return timeStudy;
  } catch (error) {
    // Don't fail the main operation if time study saving fails
    console.error('Failed to save time study:', error);
    return null;
  }
}
