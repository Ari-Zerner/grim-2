import { APIHelper, ChatMessage } from '../openai/apiHelper';
import { GroundTruthData } from '../utils/groundTruthLoader';
import { debug } from '../utils/logger';

export interface SimulationSnapshot {
  notes: string;
  date: Date;
  expertAnalyses?: string[];
}

export const outcomeSelectionFunction = {
  name: "sample_from_weighted_outcomes",
  description: "Randomly selects an outcome from a weighted list of possibilities",
  parameters: {
    type: "object",
    properties: {
      outcomes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            outcome: {
              type: "string",
              description: "The description of the outcome"
            },
            weight: {
              type: "number",
              description: "The weight/probability of this outcome"
            }
          },
          required: ["outcome", "weight"]
        }
      }
    },
    required: ["outcomes"]
  }
};

export class Narrator {
  private apiHelper: APIHelper;

  constructor(apiHelper: APIHelper) {
    this.apiHelper = apiHelper;
  }

  private buildBaseMessages(role: string, context: string): ChatMessage[] {
    return [
      {
        role: 'developer',
        content: `You are a sophisticated world simulation engine. Your role is to:
1. Analyze both specific ground truth data and leverage your broad knowledge of global trends
2. Consider multiple possible outcomes and their probabilities
3. Generate detailed, thoughtful analyses that combine factual data with reasoned speculation
4. Maintain consistent world state across simulation steps`,
        summary: 'Developer role: World simulation engine setup',
      },
      {
        role: 'user',
        content: `Role: ${role}\nContext: ${context}`,
        summary: `User request: ${role}`,
      },
    ];
  }

  async generateInitialSnapshot(groundTruth: GroundTruthData[]): Promise<SimulationSnapshot> {
    const messages = this.buildBaseMessages('Initial State Analysis', 
      `Analyze the following ground truth data to establish a detailed initial world state. Consider both the specific data provided and your general knowledge of global systems and trends.\n\n` +
      groundTruth.map(gt => `File: ${gt.filePath}\nContent: ${gt.content}`).join('\n\n')
    );
    messages[1].summary = `Initial state analysis request (${groundTruth.length} ground truth files)`;

    const response = await this.apiHelper.sendPrompt(messages);
    return {
      notes: response,
      date: new Date()
    };
  }

  async simulateOneWeek(
    currentSnapshot: SimulationSnapshot | null,
    groundTruth: GroundTruthData[]
  ): Promise<{ snapshot: SimulationSnapshot; report: string; date: Date }> {
    const baseDate = currentSnapshot?.date || new Date();
    const simulationDate = new Date(baseDate);
    simulationDate.setDate(simulationDate.getDate() + 7);
    
    // Expert analysis with outcome selection
    const expertDomains = ['Climate', 'Economy', 'Geopolitics', 'Technology', 'Society'];
    const expertResponses = await Promise.all(
      expertDomains.map(async domain => {
        const expertMessages = [
          {
            role: 'developer',
            content: `You are an expert in ${domain}. Analyze the current situation and propose possible outcomes with associated probabilities.`,
            summary: `Developer role: ${domain} expert setup`,
          },
          {
            role: 'user',
            content: `What are the most likely developments in ${domain} over the next week, given the current state:\n${currentSnapshot?.notes || 'Initial state'}`,
            summary: `${domain} expert analysis request`,
          },
        ];

        return this.apiHelper.sendPrompt(expertMessages, [outcomeSelectionFunction]);
      })
    );

    // Generate new snapshot with expert insights
    const newSnapshot: SimulationSnapshot = {
      notes: `Simulation date: ${simulationDate.toISOString()}\n\nExpert Analyses:\n${expertResponses.join('\n\n')}`,
      date: simulationDate,
      expertAnalyses: expertResponses,
    };

    // Generate report
    const reportMessages = this.buildBaseMessages('Report Generation',
      `Generate a detailed report based on expert analyses:\n${expertResponses.join('\n\n')}`
    );

    const report = await this.apiHelper.sendPrompt(reportMessages);

    return {
      snapshot: newSnapshot,
      report,
      date: simulationDate
    };
  }
}
