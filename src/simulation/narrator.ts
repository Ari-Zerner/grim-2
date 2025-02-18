import { APIHelper } from '../openai/apiHelper';
import { GroundTruthData } from '../utils/groundTruthLoader';
import { debug, info, progress } from '../utils/logger';

export interface SimulationSnapshot {
  week: number;
  date: string;
  content: string;  // Markdown content
}

export class Narrator {
  private readonly MAX_CONTEXT_LENGTH = 100000;
  private readonly SIMULATION_START_DATE = new Date();

  constructor(private apiHelper: APIHelper) {}

  private async getGroundTruthContext(groundTruth: GroundTruthData[]): Promise<string> {
    // Sort ground truth by date for chronological context
    const sortedData = [...groundTruth].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Format each piece of ground truth data
    const formattedData = sortedData.map(data => {
      const date = data.date.toISOString().split('T')[0];
      return `[${date}]\n${data.content}\n`;
    });

    // Join all data with separators, respecting MAX_CONTEXT_LENGTH
    let context = formattedData.join('\n---\n');
    if (context.length > this.MAX_CONTEXT_LENGTH) {
      // If too long, take most recent data up to MAX_CONTEXT_LENGTH
      const chunks = formattedData.reverse();
      context = '';
      for (const chunk of chunks) {
        if ((context + chunk).length > this.MAX_CONTEXT_LENGTH) {
          break;
        }
        context = chunk + (context ? '\n---\n' + context : '');
      }
    }
    
    return context;
  }

  private getSimulationDate(week: number): Date {
    const date = new Date(this.SIMULATION_START_DATE);
    date.setDate(date.getDate() + (week * 7));
    return date;
  }

  async generateInitialSnapshot(groundTruth: GroundTruthData[]): Promise<SimulationSnapshot> {
    const groundTruthContext = await this.getGroundTruthContext(groundTruth);
    
    progress('Initial Analysis', 'Generating current world state snapshot');
    const initialPrompt = `You are tasked with creating a comprehensive snapshot of the current state of the world based on the provided ground truth data. This snapshot will serve as the foundation for future simulation steps.

Ground Truth Data:
${groundTruthContext}

Create a detailed markdown document that captures the complete current state of the world. This document must be exhaustive enough to serve as the sole source of truth for future simulation steps.

Structure your response as a markdown document with the following sections:

# Global Situation
- Comprehensive overview
- Major threats and their analysis
- Key actors and their current status
- Systemic risks and global trends

# Domain Analysis
For each relevant domain (climate, economy, technology, etc.):
- Current state and trends
- Critical developments
- Key players and dynamics
- Vulnerabilities and opportunities
- Interconnections with other domains

# Significant Events
- Recent developments
- Impacts and consequences
- Actor involvement
- Public reaction and expert analysis

# Key Metrics and Indicators
- Critical measurements
- Trends and trajectories
- Warning signs
- Reliability assessment

# Intelligence Assessment
- Confirmed information
- Areas of uncertainty
- Active monitoring needs
- Source reliability

# Response Capabilities
- Available resources
- Current preparedness
- Constraints and vulnerabilities
- Contingency plans

# Analysis Framework
- Key assumptions
- Known biases
- Information gaps
- Methodological notes

Remember: Include all details that could be relevant for understanding future developments. When in doubt, include more detail rather than less.`;

    const content = await this.apiHelper.sendPrompt(initialPrompt);
    
    return {
      week: 0,
      date: this.SIMULATION_START_DATE.toISOString(),
      content,
    };
  }

  private buildNarratorPrompt(snapshot: SimulationSnapshot | null, groundTruthText: string): string {
    const context = snapshot 
      ? `Current simulation week: ${snapshot.week}\nCurrent state:\n\n${snapshot.content}\n`
      : 'Starting new simulation.\n';

    return `You are the Narrator of a world simulation focused on exploring potential catastrophes and worst-case scenarios. Your role is to analyze the situation and assemble a Cabinet of domain experts.

Current Context:
${context}

Ground Truth Data:
${groundTruthText}

Analyze the current situation and provide your response in the following markdown format:

# Initial Assessment
[Provide your high-level analysis of the current situation]

# Required Expertise
For each domain requiring expert analysis, provide:
## [Domain Name]
### Expert Profile
[Detailed description of the expert's background and capabilities]
### Analysis Required
[Specific questions or areas requiring the expert's analysis]

# Expected Developments
[Summary of anticipated developments for the coming week]`;
  }

  private async processExpertResponses(
    narratorResponse: string
  ): Promise<Array<{ domain: string, response: string }>> {
    // Extract expert requests from markdown using regex
    const expertSections = narratorResponse.match(/## ([^\n]+)\n### Expert Profile\n([^\n]+)\n### Analysis Required\n([^\n]+)/g) || [];
    
    const expertPromises = expertSections.map(async (section) => {
      const [_, domain, profile, query] = section.match(/## ([^\n]+)\n### Expert Profile\n([^\n]+)\n### Analysis Required\n([^\n]+)/) || [];
      
      const expertPrompt = `You are a leading expert in ${domain}. ${profile}

Analyze the following aspects:
${query}

Provide your analysis in markdown format, using headings and bullet points to organize your insights.`;

      const response = await this.apiHelper.sendPrompt(expertPrompt);
      return { domain, response };
    });

    return Promise.all(expertPromises);
  }

  async simulateOneWeek(
    snapshot: SimulationSnapshot | null,
    groundTruth: GroundTruthData[]
  ): Promise<{ snapshot: SimulationSnapshot; report: string; date: Date }> {
    const groundTruthContext = await this.getGroundTruthContext(groundTruth);
    
    progress('Narrator Analysis', 'Getting initial assessment');
    const narratorPrompt = this.buildNarratorPrompt(snapshot, groundTruthContext);
    const narratorResponse = await this.apiHelper.sendPrompt(narratorPrompt);
    
    progress('Expert Consultation', 'Delegating to domain experts');
    const expertResponses = await this.processExpertResponses(narratorResponse);
    info(`Consulting ${expertResponses.length} domain experts`);
    
    progress('Final Analysis', 'Generating comprehensive simulation update');
    const finalAnalysisPrompt = `Based on the following information, create two detailed markdown documents:
1. A comprehensive snapshot of the world state
2. A detailed intelligence report

Initial Analysis:
${narratorResponse}

Expert Analyses:
${expertResponses.map(er => `# ${er.domain}\n${er.response}`).join('\n\n')}

For the snapshot document, follow the same structure as the previous snapshot, ensuring all relevant details are preserved and updated.

For the report document, structure it as a high-stakes intelligence briefing with:
# Executive Summary

# Critical Developments

# Comprehensive Threat Assessment

# Key Actor Analysis

# Domain-by-Domain Analysis

# Strategic Implications

# Indicators & Warnings

# Scenario Projections

# Response Options

# Intelligence Gaps

# Recommendations

Remember: The snapshot must be detailed enough to serve as the sole source of truth for future simulation steps.

Provide your response in two parts, separated by the marker [SPLIT]:

[First part: Complete snapshot markdown]
[SPLIT]
[Second part: Complete report markdown]`;

    const finalResponse = await this.apiHelper.sendPrompt(finalAnalysisPrompt);
    
    try {
      const [snapshotContent, report] = finalResponse.split('[SPLIT]');
      const week = (snapshot?.week ?? 0) + 1;
      const date = this.getSimulationDate(week);
      const newSnapshot = {
        week,
        date: date.toISOString(),
        content: snapshotContent.trim(),
      };
      
      info(`Week ${week} simulation complete (${date.toISOString()})`);
      return { snapshot: newSnapshot, report: report.trim(), date };
    } catch (err) {
      debug('Error parsing final response:', err);
      throw new Error('Failed to generate simulation output');
    }
  }
}
