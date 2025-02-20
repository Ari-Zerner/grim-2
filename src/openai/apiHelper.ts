import OpenAI from 'openai';
import { debug, info } from '../utils/logger';
import { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions.mjs";

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'developer';
  content: string;
  summary?: string;  // Optional summary for debug logging
}

export interface Outcome {
  outcome: string;
  weight: number;
}

function sampleFromWeightedOutcomes(outcomes: Outcome[]): string {
  const totalWeight = outcomes.reduce((sum, o) => sum + o.weight, 0);
  const normalizedWeights = outcomes.map(o => o.weight / totalWeight);

  const rand = Math.random();
  let cumSum = 0;

  for (let i = 0; i < outcomes.length; i++) {
    cumSum += normalizedWeights[i];
    if (rand <= cumSum) {
      return outcomes[i].outcome;
    }
  }

  return outcomes[outcomes.length - 1].outcome;
}

export const maxIntelligenceModelParams: Pick<ChatCompletionCreateParamsNonStreaming, "model" | "reasoning_effort"> = { 
  model: "o1", 
  reasoning_effort: 'high' 
};

export class APIHelper {
  private openai: OpenAI;
  private requestCount = 0;
  private seed?: number;

  constructor(apiKey?: string, seed?: number) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.seed = seed;
  }

  setSeed(seed: number | undefined): void {
    this.seed = seed;
  }

  async sendPrompt(
    messages: ChatMessage[],
    functions?: any[]
  ): Promise<string> {
    const currentRequest = ++this.requestCount;
    
    const debugMessages = messages.map(msg => ({
      ...msg,
      content: msg.summary || (msg.content.length > 100 ? 
        `${msg.content.substring(0, 100)}... (${msg.content.length} chars)` : 
        msg.content)
    }));
    debug(`API Request #${currentRequest} messages:`, debugMessages);
    
    const requestPayload: ChatCompletionCreateParamsNonStreaming = {
      ...maxIntelligenceModelParams,
      messages: messages.map(({ summary, ...msg }) => msg),
      stream: false,
      seed: this.seed
    };

    if (functions?.length) {
      requestPayload.functions = functions;
      debug(`API Request #${currentRequest} functions:`, functions);
    }
    
    try {
      const response = await this.openai.chat.completions.create(requestPayload);
      
      const message = response.choices[0]?.message;
      if (message?.function_call) {
        debug(`API Request #${currentRequest} function call:`, message.function_call);
        const args = JSON.parse(message.function_call.arguments);
        if (message.function_call.name === 'sample_from_weighted_outcomes') {
          return sampleFromWeightedOutcomes(args.outcomes);
        }
        return JSON.stringify(message.function_call);
      }

      const result = message?.content || '';
      info(`API Request #${currentRequest} completed (${result.length} chars)`);
      debug(`API Response #${currentRequest}:`, result);
      
      return result;
    } catch (err) {
      debug(`Error with API Request #${currentRequest}:`, err);
      throw err;
    }
  }
}
