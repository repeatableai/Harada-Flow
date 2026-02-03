import { apiClient } from './apiClient';

// InvokeLLM - calls the backend which proxies to Anthropic Claude
export const InvokeLLM = async ({
  prompt,
  response_json_schema,
  add_context_from_internet,
  company_url,
  // Time study tracking params
  operationType,
  operationName,
  companyId,
  // Dynamic baseline params
  industry,
  companySize,
  deliverableName,
}) => {
  const result = await apiClient.request('/integrations/llm', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      response_json_schema,
      add_context_from_internet,
      company_url,
      // Time study tracking params
      operationType,
      operationName,
      companyId,
      // Dynamic baseline params
      industry,
      companySize,
      deliverableName,
    }),
  });
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
