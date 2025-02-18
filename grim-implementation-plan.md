# Grim World Simulator Implementation Plan

This document describes the implementation plan for the Grim world simulator CLI tool.

## 1. Project Structure

- /cli.ts  
  Entry point for the CLI tool using Bun. This file will:
  - Parse command-line arguments (output directory, optional snapshot file).
  - Initialize and invoke the simulation engine.

- /simulation/simulator.ts  
  Contains the simulation engine with the core loop:
  - Loads ground truth from the `world/` directory.
  - Performs one-week simulation timesteps.
  - Delegates tasks to the Narrator.

- /simulation/narrator.ts  
  Implements the Narrator class that:
  - Manages the single top-level O1 instance.
  - Dynamically determines the Cabinet of experts.
  - Delegates domain-specific queries (for climate, economy, etc.) to experts.
  - Aggregates expert responses (executed in parallel).

- /openai/apiHelper.ts  
  Provides helper functions for interfacing with the OpenAI O1 API:
  - Exposes a function like `sendPrompt(prompt: string): Promise<string>`.
  - Logs API requests/responses at the debug level.
  - Implements sensible defaults for error handling.

- /utils/groundTruthLoader.ts  
  Contains logic to load the ground truth:
  - Recursively reads all files in the `world/` directory.
  - Treats file contents as raw text, agnostic of file type/structure.

- /utils/logger.ts  
  Sets up a simple logger (or configures Bun's logging) to output at debug level.
    
## 2. Key Components and Interfaces

### 2.1 CLI Entry Point (cli.ts)

- **Responsibilities:**
  - Parse arguments:
    - `--output <output_directory>`: Directory for output files.
    - `--snapshot <snapshot_file>`: Optional file to resume a simulation.
  - Initialize simulation dependencies (API helper, narrator, ground truth loader).
  - Trigger one-week simulation run and write outputs.

- **Pseudo-code Example:**

  // cli.ts
  ```
  function main() {
    const args = parseArgs(process.argv);
    const outputDir = args.output;
    const snapshot = args.snapshot ? loadSnapshot(args.snapshot) : null;

    // Load ground truth from the 'world/' directory
    const groundTruth = loadGroundTruth('./world');

    // Initialize API helper and Narrator
    const apiHelper = new APIHelper();
    const narrator = new Narrator(apiHelper);

    // Run one-week simulation
    const simulationResult = await narrator.simulateOneWeek(snapshot, groundTruth);

    // Write the detailed snapshot (JSON) and report (Markdown)
    writeFile(path.join(outputDir, 'snapshot.json'), JSON.stringify(simulationResult.snapshot, null, 2));
    writeFile(path.join(outputDir, 'report.md'), simulationResult.report);
  }
  ```

### 2.2 Ground Truth Loader (groundTruthLoader.ts)

- **Responsibilities:**
  - Recursively traverse the `world/` directory.
  - Read each file as raw text and return as an array or map.
  
- **Function Signature:**
  ```
  async function loadGroundTruth(directory: string): Promise<GroundTruthData[]> {
    // For each file in the directory (and subdirectories):
    //   - Read file content as text.
    //   - Return an object with file path and content.
  }
  ```

### 2.3 OpenAI API Helper (apiHelper.ts)

- **Responsibilities:**
  - Manage OpenAI call with the O1 model.
  - Log all requests and responses at debug level.
  - Handle basic error logging and possibly retries.

- **Pseudo-code Example:**
  ```
  class APIHelper {
    async sendPrompt(prompt: string): Promise<string> {
      logger.debug(`Sending prompt: ${prompt}`);
      try {
        const response = await openai.callModel({ prompt });
        logger.debug(`Received response: ${response}`);
        return response;
      } catch (err) {
        logger.debug(`Error with API call: ${err}`);
        throw err;
      }
    }
  }
  ```

### 2.4 Narrator and Cabinet Management (narrator.ts)

- **Responsibilities:**
  - Represent the top-level Narrator that uses a single O1 instance.
  - On each simulation step:
    - Builds a prompt from current state and ground truth.
    - Uses the API helper to request an overall update.
    - Determines what domain-specific expertise is needed by extracting expert prompts from the Narrator’s response.
    - Delegates inquiries to experts concurrently.
    - Aggregates and processes expert responses to form the new simulation state.
    - Generates both a detailed snapshot (in JSON) and a human-readable report (in Markdown).

- **Class Outline:**
  ```
  class Narrator {
    private apiHelper: APIHelper;
    
    constructor(apiHelper: APIHelper) {
      this.apiHelper = apiHelper;
    }
  
    async simulateOneWeek(snapshot: SimulationSnapshot | null, groundTruth: GroundTruthData[]): Promise<{ snapshot: SimulationSnapshot, report: string }> {
      // 1. Build a composite prompt using snapshot and ground truth.
      const prompt = buildNarratorPrompt(snapshot, groundTruth);
      
      // 2. Get overall simulation directive.
      const narratorResponse = await this.apiHelper.sendPrompt(prompt);
      
      // 3. Extract expert prompts from the Narrator’s response.
      const expertPrompts = extractExpertPrompts(narratorResponse);
      
      // 4. Process expert prompts in parallel.
      const expertResponses = await Promise.all(expertPrompts.map(ep => {
         // Use the same API helper or instantiate a specialized instance if necessary.
         return this.apiHelper.sendPrompt(ep);
      }));
      
      // 5. Combine results to form new simulation state.
      const newSnapshot = updateSnapshot(snapshot, narratorResponse, expertResponses);
      const report = generateMarkdownReport(newSnapshot, narratorResponse, expertResponses);
      
      return { snapshot: newSnapshot, report };
    }
  }
  ```
  
### 2.5 Simulation Output Handling

- **Responsibilities:**
  - Write simulation state to JSON file (`snapshot.json`).
  - Write human-readable simulation report to Markdown file (`report.md`).
  
- **Details:**
  - Use the output directory provided by the command-line argument.
  - Ensure file writing operations are asynchronous.

## 3. Concurrency and Parallel Processing

- In the Narrator class, use `Promise.all` to run expert responses concurrently.
- Structure the code to enable easy swap-out if more complex concurrency control is needed later.

## 4. Logging

- Use debug-level logging within:
  - The API helper (log all API interaction details).
  - The simulation engine (log key simulation events, input parameters, and errors, if any).
- Ensure that logging does not interfere with control flow, but properly reports API interactions for later debugging.

## 5. Extensibility and Separation of Concerns

- Keep all CLI-specific logic in cli.ts.
- Encapsulate simulation logic in separate modules to allow future adaptations (e.g., converting the project into a standalone library).
- Maintain clean interfaces between components (Ground truth loader, Narrator, API helper).

## 6. Pseudo-Code Summary of Key Interfaces

- API Helper Interface:
  ```
  interface APIHelperInterface {
    sendPrompt(prompt: string): Promise<string>;
  }
  ```
  
- Narrator Method Signature:
  ```
  async function simulateOneWeek(snapshot: SimulationSnapshot|null, groundTruth: GroundTruthData[]): Promise<{ snapshot: SimulationSnapshot, report: string }>
  ```

- Ground Truth Data Type:
  ```
  interface GroundTruthData {
    filePath: string;
    content: string;
  }
  ```
  
- Simulation Snapshot Type (example structure):
  ```
  interface SimulationSnapshot {
    week: number;
    state: any; // Detailed simulation state data
  }
  ```

This plan provides a comprehensive yet concise description of the code structure and modifications necessary to implement Grim world simulator as a CLI tool with extensible design. Future enhancements including library/web interface integration should build upon these clear separations of concerns.
