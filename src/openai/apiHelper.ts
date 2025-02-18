import OpenAI from 'openai';
import { debug, info } from '../utils/logger';

export class APIHelper {
  private openai: OpenAI;
  private requestCount = 0;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async sendPrompt(prompt: string): Promise<string> {
    const currentRequest = ++this.requestCount;
    debug(`API Request #${currentRequest}:`, prompt);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: "o1",
        messages: [{ role: "user", content: prompt }]
      });

      const result = response.choices[0]?.message?.content || '';
      info(`API Request #${currentRequest} completed (${result.length} chars)`);
      debug(`API Response #${currentRequest}:`, result);
      
      return result;
    } catch (err) {
      debug(`Error with API Request #${currentRequest}:`, err);
      throw err;
    }
  }
}
