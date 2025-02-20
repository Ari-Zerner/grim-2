# Grim

Grim is a world simulation tool focused on exploring potential catastrophes and worst-case scenarios. It uses OpenAI's O1 model to analyze ground truth data and simulate possible future developments in one-week timesteps.

## Overview

Grim works by:
1. Loading ground truth data from the `world/` directory
2. Creating a detailed snapshot of the current world state
3. Simulating developments in one-week increments
4. Generating comprehensive snapshots and intelligence reports

The simulation is managed by a Narrator (an O1 instance) that coordinates with a dynamic Cabinet of domain experts (also O1 instances) specialized in areas like climate, economy, geopolitics, etc.

## Usage

```bash
# Install dependencies
bun install

# Run simulation with default output directory (./simulation)
bun start

# Run simulation with different output directory
bun start --output <output-directory>

# Continue simulation from previous snapshot
bun start --snapshot <snapshot-file>
```

## Ground Truth Data

Place your ground truth data files in the `world/` directory. These can be any text files containing information about the current state of the world. The system will process all files recursively, regardless of their structure or format.

## Outputs

For each simulation step, Grim generates two files:
- `snapshot-[DATE].md`: A comprehensive snapshot of the world state
- `report-[DATE].md`: A detailed intelligence briefing analyzing developments

The snapshot serves as the foundation for future simulation steps, while the report provides human-readable analysis and insights.

## Environment Variables

Required:
- `OPENAI_API_KEY`: Your OpenAI API key

Optional:
- `DEBUG`: Set to any value to enable debug logging
