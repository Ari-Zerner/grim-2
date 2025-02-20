import { APIHelper } from './openai/apiHelper';
import { Narrator, SimulationSnapshot } from './simulation/narrator';
import { loadGroundTruth } from './utils/groundTruthLoader';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { debug, error, info, progress } from './utils/logger';
import { mkdir } from 'fs/promises';

async function loadSnapshot(path: string): Promise<SimulationSnapshot | null> {
  try {
    const content = await Bun.file(path).text();
    if (path.endsWith('.json')) {
      return JSON.parse(content);
    }
    return { notes: content };
  } catch (err) {
    debug('Error loading snapshot:', err);
    return null;
  }
}

function formatSnapshot(snapshot: SimulationSnapshot): string {
  if (typeof snapshot === 'string') {
    return snapshot;
  }
  if (typeof snapshot.notes === 'string') {
    return snapshot.notes;
  }
  return Object.entries(snapshot)
    .map(([key, value]) => `${key}:\n${JSON.stringify(value, null, 2)}`)
    .join('\n\n');
}

async function ensureDirectoryExists(dir: string) {
  try {
    await mkdir(dir, { recursive: true });
  } catch (err) {
    if ((err as any).code !== 'EEXIST') {
      throw err;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const outputDirIndex = args.indexOf('--output');
  const snapshotIndex = args.indexOf('--snapshot');
  let snapshotPath = null;
  
  // Default output directory is "simulation" if not specified
  const outputDir = outputDirIndex !== -1 ? args[outputDirIndex + 1] : 'simulation';
  if (snapshotIndex !== -1) {
    snapshotPath = args[snapshotIndex + 1];
  }
  
  try {
    progress('Initialization', 'Starting simulation');
    
    await ensureDirectoryExists(outputDir);
    
    progress('Loading ground truth', './world directory');
    const groundTruth = await loadGroundTruth('./world');
    info(`Loaded ${groundTruth.length} ground truth files`);
    
    progress('Setup', 'Initializing simulation components');
    const apiHelper = new APIHelper();
    const narrator = new Narrator(apiHelper);
    
    let currentSnapshot;
    if (snapshotPath) {
      progress('Loading snapshot', snapshotPath);
      currentSnapshot = await loadSnapshot(snapshotPath);
    } else {
      progress('Initial Analysis', 'Generating current world state');
      currentSnapshot = await narrator.generateInitialSnapshot(groundTruth);
      const initialDate = new Date().toISOString().split('T')[0];
      const initialSnapshotPath = join(outputDir, `snapshot-${initialDate}-initial.txt`);
      await writeFile(initialSnapshotPath, formatSnapshot(currentSnapshot));
      info(`Initial snapshot written to: ${initialSnapshotPath}`);
    }
    
    progress('Simulation', 'Running one-week simulation');
    const { snapshot: newSnapshot, report, date } = await narrator.simulateOneWeek(currentSnapshot, groundTruth);
    
    const dateStr = date.toISOString().split('T')[0];
    
    progress('Output', 'Writing simulation results');
    const outputSnapshotPath = join(outputDir, `snapshot-${dateStr}.txt`);
    const reportPath = join(outputDir, `report-${dateStr}.md`);
    
    await writeFile(outputSnapshotPath, formatSnapshot(newSnapshot));
    await writeFile(reportPath, typeof report === 'string' ? report : JSON.stringify(report, null, 2));
    
    info(`Snapshot written to: ${outputSnapshotPath}`);
    info(`Report written to: ${reportPath}`);
    
    progress('Complete', 'Simulation finished successfully');
  } catch (err) {
    error('Simulation failed:', err);
    process.exit(1);
  }
}

main();
