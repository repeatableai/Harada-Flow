import Anthropic from '@anthropic-ai/sdk';
import config from '../config.js';
import { scrapeCompanyWebsite } from './scraper.service.js';
import { createTimeStudy } from './timeStudy.service.js';
import { extractTextFromFiles } from './fileExtractor.service.js';
import { getFilesForSession, getFilesByIds } from './knowledgeFile.service.js';
import prisma from '../db.js';

const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
  timeout: 600000, // 10 minutes timeout for complex prompts
});

export async function invokeLLM({
  prompt,
  response_json_schema,
  // NEW: strict tool_use schema — when provided, uses grammar-constrained tool_use instead of text generation
  tool_use_schema,
  add_context_from_internet,
  company_url,
  // Additional knowledge files as context
  knowledgeFileIds,
  user,
  // Time study tracking params
  operationType,
  operationName,
  companyId,
  userId,
  // Dynamic baseline params
  industry,
  companySize,
  deliverableName,
  // Optional SSE progress callback (keeps connection alive during streaming)
  onProgress,
}) {
  if (!config.anthropic.apiKey) {
    throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY in your .env file.');
  }

  console.log(`LLM request - Model: ${config.anthropic.model}, API key present: ${!!config.anthropic.apiKey}`);

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

    // Automatically include knowledge files linked to the session
    if (companyId) {
      try {
        const sessionFiles = await getFilesForSession(companyId);
        if (sessionFiles && sessionFiles.length > 0) {
          console.log(`Found ${sessionFiles.length} knowledge files for session ${companyId}`);
          const fileContent = await extractTextFromFiles(sessionFiles);

          if (fileContent && fileContent.trim().length > 0) {
            const knowledgeContext = `[SESSION KNOWLEDGE FILES]\n${fileContent}\n[END SESSION KNOWLEDGE FILES]`;
            enrichedPrompt = `${knowledgeContext}\n\n${enrichedPrompt}`;
            console.log(`Added ${fileContent.length} chars of session file context to prompt`);
          }
        }
      } catch (fileError) {
        console.error('Error loading session knowledge files:', fileError);
        // Continue without file context
      }
    }

    // Include additional knowledge files selected by the user (organization/company-wide files)
    if (knowledgeFileIds && knowledgeFileIds.length > 0 && user) {
      try {
        const additionalFiles = await getFilesByIds(knowledgeFileIds, user);
        if (additionalFiles && additionalFiles.length > 0) {
          console.log(`Found ${additionalFiles.length} additional knowledge files for context`);
          const fileContent = await extractTextFromFiles(additionalFiles);

          if (fileContent && fileContent.trim().length > 0) {
            const orgContext = `[ORGANIZATION KNOWLEDGE FILES]\n${fileContent}\n[END ORGANIZATION KNOWLEDGE FILES]`;
            enrichedPrompt = `${orgContext}\n\n${enrichedPrompt}`;
            console.log(`Added ${fileContent.length} chars of organization file context to prompt`);
          }
        }
      } catch (fileError) {
        console.error('Error loading additional knowledge files:', fileError);
        // Continue without additional file context
      }
    }

    // ═══ PATH A: Strict tool_use mode (grammar-constrained schema enforcement) ═══
    if (tool_use_schema) {
      console.log('Using strict tool_use mode for schema-enforced generation...');
      const stream = anthropic.messages.stream({
        model: config.anthropic.model,
        max_tokens: 128000,
        system: systemMessage,
        messages: [{ role: 'user', content: enrichedPrompt }],
        tools: [{
          name: tool_use_schema.name || 'generate_structured_output',
          description: tool_use_schema.description || 'Generate structured output matching the schema',
          strict: true,
          input_schema: tool_use_schema.input_schema,
        }],
        tool_choice: { type: 'tool', name: tool_use_schema.name || 'generate_structured_output' },
      });

      // Accumulate streamed tool_use input JSON
      let toolInput = '';
      let chunkCount = 0;

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'input_json_delta') {
          toolInput += event.delta.partial_json;
          chunkCount++;
          if (chunkCount % 50 === 0) {
            console.log(`Tool streaming progress: ${chunkCount} chunks, ${toolInput.length} chars received`);
            if (onProgress) {
              onProgress({ chunks: chunkCount, chars: toolInput.length });
            }
          }
        }
      }

      console.log(`Tool streaming complete: ${chunkCount} total chunks, ${toolInput.length} total chars`);

      if (!toolInput) {
        throw new Error('No tool_use input received from Anthropic');
      }

      const parsed = JSON.parse(toolInput);

      // Validate prompt pack completeness
      const promptArray = parsed.build_prompts || parsed.prompts;
      if (promptArray && Array.isArray(promptArray)) {
        console.log(`Prompt pack: ${promptArray.length} build prompts generated`);
        for (let i = 0; i < promptArray.length; i++) {
          const promptLen = promptArray[i]?.prompt?.length || 0;
          console.log(`  Prompt ${i + 1}: ${promptLen} chars`);
          if (promptLen < 2000) {
            console.warn(`  WARNING: Prompt ${i + 1} is thin (${promptLen} chars, min recommended: 2000)`);
          }
        }
        if (parsed.attending_asset_discovery) {
          console.log(`  Attending Asset Discovery: ${parsed.attending_asset_discovery.prompt?.length || 0} chars`);
        } else {
          console.warn(`  MISSING: attending_asset_discovery`);
        }
        if (parsed.portfolio_hub) {
          console.log(`  Portfolio Hub: ${parsed.portfolio_hub.prompt?.length || 0} chars`);
        } else {
          console.warn(`  MISSING: portfolio_hub`);
        }
      }

      await saveTimeStudyIfTracking({
        startTime, operationType, operationName, companyId, userId, industry, companySize, deliverableName,
      });

      return parsed;
    }

    // ═══ PATH B: Standard text generation (existing behavior for matrices, role extraction, etc.) ═══
    console.log('Starting streaming request to Anthropic...');
    const stream = anthropic.messages.stream({
      model: config.anthropic.model,
      max_tokens: 128000,
      system: systemMessage,
      messages: [
        {
          role: 'user',
          content: enrichedPrompt,
        },
      ],
    });

    // Accumulate streamed text chunks
    let content = '';
    let chunkCount = 0;

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        content += event.delta.text;
        chunkCount++;
        if (chunkCount % 50 === 0) {
          console.log(`Streaming progress: ${chunkCount} chunks, ${content.length} chars received`);
          if (onProgress) {
            onProgress({ chunks: chunkCount, chars: content.length });
          }
        }
      }
    }

    console.log(`Streaming complete: ${chunkCount} total chunks, ${content.length} total chars`);

    if (!content) {
      throw new Error('No response content from Anthropic');
    }

    // Parse JSON response if schema was provided
    if (response_json_schema) {
      try {
        let cleanedContent = content.trim();
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

        await saveTimeStudyIfTracking({
          startTime, operationType, operationName, companyId, userId, industry, companySize, deliverableName,
        });

        return parsed;
      } catch (parseError) {
        console.error('Failed to parse LLM JSON response:', content);
        console.error('Parse error:', parseError.message);
        const preview = content.substring(0, 500);
        throw new Error(`Invalid JSON response from LLM. Preview: ${preview}`);
      }
    }

    await saveTimeStudyIfTracking({
      startTime, operationType, operationName, companyId, userId, industry, companySize, deliverableName,
    });

    return content;
  } catch (error) {
    console.error('Anthropic API error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));

    if (error.status === 401) {
      throw new Error('Invalid Anthropic API key. Please check your configuration.');
    }

    if (error.status === 429) {
      throw new Error('Anthropic API rate limit exceeded. Please try again later.');
    }

    if (error.status === 400) {
      throw new Error('Invalid request to Anthropic API: ' + error.message);
    }

    if (error.status === 404) {
      throw new Error(`Model not found: ${config.anthropic.model}. Check ANTHROPIC_MODEL setting.`);
    }

    throw new Error(`Anthropic API error: ${error.message || error}`);
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

/**
 * Extract role information from uploaded files using LLM
 * @param {string[]} fileIds - Array of knowledge file IDs
 * @param {string} userId - User ID for permission check
 * @returns {Promise<{job_title: string, industry: string, company_size: string, company_url?: string}>}
 */
export async function extractRoleInfoFromFiles(fileIds, userId) {
  // Fetch the files from database
  const files = await prisma.knowledgeFile.findMany({
    where: {
      id: { in: fileIds },
      uploaderId: userId, // Ensure user owns the files
    },
    select: {
      id: true,
      filename: true,
      originalName: true,
      mimeType: true,
    },
  });

  if (files.length === 0) {
    throw new Error('No accessible files found');
  }

  // Extract text content from all files
  const fileContents = await extractTextFromFiles(files);

  if (!fileContents || fileContents.trim().length === 0) {
    throw new Error('Could not extract text from uploaded files');
  }

  // Use LLM to extract role information
  const prompt = `You are analyzing documents about a person's job role. Extract the following information:

1. Job Title - The specific job title or position (e.g., "Software Engineer", "Marketing Director", "Corporate Controller")
2. Industry - The industry or sector (e.g., "Technology", "Healthcare", "Finance", "Manufacturing")
3. Company Size - Estimate based on context. Use one of: "startup", "small", "medium", "large", "enterprise"
4. Company URL - If a company website is mentioned, include it

If any information is not clearly stated, make a reasonable inference based on the context.

DOCUMENTS:
${fileContents}

Return the data as JSON with this exact structure:
{
  "job_title": "extracted job title",
  "industry": "extracted industry",
  "company_size": "startup|small|medium|large|enterprise",
  "company_url": "url if found, or empty string"
}`;

  const result = await invokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        job_title: { type: "string" },
        industry: { type: "string" },
        company_size: { type: "string" },
        company_url: { type: "string" }
      },
      required: ["job_title", "industry", "company_size"]
    },
  });

  return result;
}
