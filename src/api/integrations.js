import { apiClient } from './apiClient';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// InvokeLLM - calls the backend which proxies to Anthropic Claude
// Uses SSE streaming to prevent 504 gateway timeouts on long generations
export const InvokeLLM = async ({
  prompt,
  response_json_schema,
  tool_use_schema,
  add_context_from_internet,
  company_url,
  knowledgeFileIds,
  operationType,
  operationName,
  companyId,
  industry,
  companySize,
  deliverableName,
}) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  // Use the apiClient's access token for auth
  if (apiClient.accessToken) {
    headers['Authorization'] = `Bearer ${apiClient.accessToken}`;
  }

  const response = await fetch(`${API_BASE}/integrations/llm/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt,
      response_json_schema,
      tool_use_schema,
      add_context_from_internet,
      company_url,
      knowledgeFileIds,
      operationType,
      operationName,
      companyId,
      industry,
      companySize,
      deliverableName,
    }),
  });

  if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  // Parse SSE stream — read until we get a 'complete' or 'error' event
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;

  const processMessages = (messages) => {
    for (const msg of messages) {
      const lines = msg.trim().split('\n');
      if (!lines.length || !lines[0]) continue;
      let eventType = 'message';
      let data = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7);
        } else if (line.startsWith('data: ')) {
          data = line.slice(6);
        }
      }

      if (eventType === 'complete' && data) {
        try {
          result = JSON.parse(data);
        } catch {
          console.warn('SSE: failed to parse complete event data');
        }
      } else if (eventType === 'error' && data) {
        let err;
        try {
          err = JSON.parse(data);
        } catch {
          throw new Error('LLM request failed');
        }
        throw new Error(err.message || 'LLM request failed');
      }
      // 'progress' events are keepalives — ignore on frontend
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE messages (separated by double newlines)
    const messages = buffer.split('\n\n');
    buffer = messages.pop(); // Keep incomplete message in buffer
    processMessages(messages);
  }

  // Process any remaining data in the buffer after stream ends
  if (buffer.trim()) {
    processMessages(buffer.split('\n\n'));
  }

  if (!result) {
    throw new Error('Stream ended without a result');
  }

  return result;
};

// Stub implementations for other integrations
// These can be implemented later as needed

export const SendEmail = async (params) => {
  console.warn('SendEmail not yet implemented');
  throw new Error('SendEmail integration not implemented');
};

export const UploadFile = async (params) => {
  console.warn('UploadFile not yet implemented');
  throw new Error('UploadFile integration not implemented');
};

export const GenerateImage = async (params) => {
  console.warn('GenerateImage not yet implemented');
  throw new Error('GenerateImage integration not implemented');
};

export const ExtractDataFromUploadedFile = async (params) => {
  console.warn('ExtractDataFromUploadedFile not yet implemented');
  throw new Error('ExtractDataFromUploadedFile integration not implemented');
};

export const CreateFileSignedUrl = async (params) => {
  console.warn('CreateFileSignedUrl not yet implemented');
  throw new Error('CreateFileSignedUrl integration not implemented');
};

export const UploadPrivateFile = async (params) => {
  console.warn('UploadPrivateFile not yet implemented');
  throw new Error('UploadPrivateFile integration not implemented');
};

// Core namespace for backwards compatibility
export const Core = {
  InvokeLLM,
  SendEmail,
  UploadFile,
  GenerateImage,
  ExtractDataFromUploadedFile,
  CreateFileSignedUrl,
  UploadPrivateFile,
};
