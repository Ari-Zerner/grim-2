import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { debug } from './logger';

export interface GroundTruthData {
  filePath: string;
  content: string;
  date: Date;
}

export async function loadGroundTruth(directory: string): Promise<GroundTruthData[]> {
  const groundTruth: GroundTruthData[] = [];
  
  function extractDateFromFilename(filename: string): Date {
    // Try to extract date from various filename formats
    const datePatterns = [
      /(\d{4})-(\d{1,2})-(\d{1,2})/,  // YYYY-MM-DD
      /week-(\d{1,2})(\d{4})/,         // week-WWYYYY
      /week-(\d{1,2})(\d{4})-/,        // week-WWYYYY-something
    ];
    
    for (const pattern of datePatterns) {
      const match = filename.match(pattern);
      if (match) {
        if (match[1] && match[2] && match[3]) {
          // YYYY-MM-DD format
          return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        } else if (match[1] && match[2]) {
          // Week-based format
          const year = parseInt(match[2]);
          const week = parseInt(match[1]);
          const date = new Date(year, 0, 1);
          date.setDate(date.getDate() + (week - 1) * 7);
          return date;
        }
      }
    }
    
    // Default to file creation date if no date found in filename
    return new Date();
  }
  
  async function processDirectory(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await processDirectory(fullPath);
      } else {
        try {
          const content = await readFile(fullPath, 'utf-8');
          groundTruth.push({
            filePath: fullPath,
            content,
            date: extractDateFromFilename(entry.name),
          });
          debug(`Loaded ground truth from ${fullPath}`);
        } catch (err) {
          debug(`Error loading ${fullPath}:`, err);
        }
      }
    }
  }
  
  await processDirectory(directory);
  return groundTruth;
}
