# Grim Simulator Modifications Implementation Plan

This document outlines the precise code changes needed to address the following requirements:
1. Snapshot files must be written as plain text rather than as JSON.
2. Prompts to O1 must be constructed using a more thoughtful multi-message approach including "developer" role messages.
3. The simulation must leverage both the specific ground truth data and the model’s general world knowledge.
4. The Narrator and its experts must use tool calls (function calling) to, for example, select outcomes from a probability distribution.

---

## 1. Updating Snapshot Files to Plain Text

- **File:** src/cli.ts  
- **Change:**
  - Replace file names with a `.txt` extension instead of `.json`.
  - Replace the use of `JSON.stringify(...)` with a helper that formats the snapshot as free-form plain text.
- **Pseudo-code Changes:**

  ```typescript
  // OLD: Writing initial snapshot as JSON
  const initialSnapshotPath = join(outputDir, `snapshot-${initialDate}-initial.json`);
  await writeFile(initialSnapshotPath, JSON.stringify(currentSnapshot, null, 2));
  
  // NEW: Writing initial snapshot as plain text
  const initialSnapshotPath = join(outputDir, `snapshot-${initialDate}-initial.txt`);
  await writeFile(initialSnapshotPath, formatSnapshot(currentSnapshot));
  
  // Likewise, adjust the weekly snapshot
  const outputSnapshotPath = join(outputDir, `snapshot-${dateStr}.txt`);
  await writeFile(outputSnapshotPath, formatSnapshot(newSnapshot));
  
  // Helper function to produce plain text from the snapshot
  function formatSnapshot(snapshot: SimulationSnapshot): string {
    // Convert the snapshot object to free-form notes.
    // For example, if snapshot.notes exists, return that.
    return typeof snapshot === 'string' ? snapshot : (snapshot.notes || String(snapshot));
  }
  ```

---

## 2. Enhancing Prompt Construction with Multi-Message Support

- **File:** src/openai/apiHelper.ts  
- **Change:**
  - Modify the `sendPrompt` (or create a new method) to accept an array of messages rather than a single prompt string.
  - Ensure the message objects include a `"role"` property (e.g., `"developer"`, `"user"`).
  - Allow an optional `functions` parameter for function calling.
- **Pseudo-code Changes:**

  ```typescript
  // OLD: Single message prompt
  async sendPrompt(prompt: string): Promise<string> {
    // ...
    const response = await this.openai.chat.completions.create({
      model: "o1",
      messages: [{ role: "user", content: prompt }]
    });
    // ...
  }
  
  // NEW: Multi-message support with optional function calling
  async sendPrompt(
    messages: { role: string; content: string }[],
    functions?: any[]
  ): Promise<string> {
    const currentRequest = ++this.requestCount;
    debug(`API Request #${currentRequest} messages:`, messages);
    
    const requestPayload: any = {
      model: "o1",
      messages,
    };
    if (functions) {
      requestPayload.functions = functions;
    }
    
    try {
      const response = await this.openai.chat.completions.create(requestPayload);
      const result = response.choices[0]?.message?.content || '';
      info(`API Request #${currentRequest} completed (${result.length} chars)`);
      return result;
    } catch (err) {
      debug(`Error with API Request #${currentRequest}:`, err);
      throw err;
    }
  }
  ```

---

## 3. Incorporating General World Knowledge in Prompts

- **File:** src/simulation/narrator.ts  
- **Change:**
  - In methods such as `simulateOneWeek` and `generateInitialSnapshot`, build prompts as an array of messages that integrate:
    - A "developer" role message defining the simulation engine’s role and instructing it to bring in its general world knowledge.
    - A "user" role message that includes the current snapshot and a summary of ground truth data.
- **Pseudo-code Snippet:**

  ```typescript
  // Build the multi-message prompt
  const messages = [
    {
      role: "developer",
      content: "You are a world simulation engine. Leverage both your broad general knowledge about global trends and the specific ground truth data provided.",
    },
    {
      role: "user",
      content: `Current Snapshot: ${currentSnapshot ? formatSnapshot(currentSnapshot) : 'None'}\nGround Truth Summary: ${summarizeGroundTruth(groundTruth)}`,
    },
  ];
  
  // Call the updated API helper with multi-message prompt
  const narratorResponse = await this.apiHelper.sendPrompt(messages);
  ```

  - *Note:* You may need a helper like `summarizeGroundTruth(groundTruth)` to synthesize the ground truth data.

---

## 4. Enabling Tool Calls for Expert Interactions and Outcome Selection

- **Files Affected:**  
  - src/simulation/narrator.ts  
  - src/openai/apiHelper.ts (via the updated `sendPrompt` method)

- **Change:**
  - When delegating to domain experts, include in the messages an instruction (via a "developer" role message) that the expert should use tool calls to select outcomes.
  - Define function specifications for outcome selection according to the OpenAI function calling guidelines.
- **Pseudo-code Changes (Expert Call within Narrator):**

  ```typescript
  // Define the outcome selection function call spec
  const outcomeSelectionFunction = {
    name: "selectOutcome",
    description: "Selects an outcome from a probability distribution based on simulation parameters.",
    parameters: {
      type: "object",
      properties: {
        outcome: {
          type: "string",
          description: "Chosen outcome from the set of possibilities.",
        },
        probability: {
          type: "number",
          description: "The probability weight associated with the selected outcome.",
        },
      },
      required: ["outcome", "probability"],
    },
  };
  
  // Build expert messages including a developer role instruction for outcome selection
  const expertMessages = [
    {
      role: "developer",
      content: "You are a domain expert. Analyze the prompt and use the provided tool to select an outcome from the probability distribution when applicable.",
    },
    {
      role: "user",
      content: `Expert analysis required for the following details:\n${expertPromptDetail}`,
    },
  ];
  
  // Call the API helper with the function specification for tool calls
  const expertResponse = await this.apiHelper.sendPrompt(expertMessages, [outcomeSelectionFunction]);
  ```

---

## Summary of Required Changes

1. **Snapshot Files**: Update file extensions and output method in `src/cli.ts` to write plain text snapshots using a helper function (e.g., `formatSnapshot`).
2. **API Prompt Construction**: Refactor `sendPrompt` in `src/openai/apiHelper.ts` to accept an array of message objects (with roles such as `"developer"` and `"user"`) and an optional `functions` parameter.
3. **General Knowledge Integration**: In `src/simulation/narrator.ts`, build multi-message prompts that incorporate both the current simulation state and the model’s general world knowledge.
4. **Tool Calls for Experts**: Enhance expert interactions in the Narrator by specifying tool call functions (e.g., for outcome selection) and include these functions in the API call via the new `functions` parameter.

Implement these changes as specified across the respective modules to satisfy the new system requirements.
