import { AIProvider } from './types';
import { GeminiAIProvider } from './ai-provider-gemini';
import { MockAIProvider } from './ai-provider-mock';

export type AIProviderType = 'gemini' | 'openai' | 'claude' | 'mock';

export interface AIProviderConfig {
  type: AIProviderType;
  apiKey?: string;
  modelName?: string;
}

export function createAIProvider(config: AIProviderConfig): AIProvider {
  switch (config.type) {
    case 'gemini':
      if (!config.apiKey) {
        throw new Error('Gemini provider requires an API key');
      }
      return new GeminiAIProvider(config.apiKey, config.modelName);
    
    case 'mock':
      return new MockAIProvider();
    
    default:
      throw new Error(`Unknown AI provider type: ${config.type}`);
  }
}