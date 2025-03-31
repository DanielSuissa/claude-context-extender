#!/usr/bin/env node

/**
 * Script to organize files based on location comments in code
 * Searches for pattern: "// Location: /claude-context-extender/..."
 * Moves files to their correct locations and renames them if needed
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const copyFile = promisify(fs.copyFile);
const stat = promisify(fs.stat);

// Root directory where the project will be organized
const projectRoot = path.join(process.cwd(), 'claude-context-extender');

/**
 * Main function to organize files
 */
async function organizeFiles() {
  try {
    console.log('Starting file organization...');
    
    // Create project root if it doesn't exist
    if (!fs.existsSync(projectRoot)) {
      await mkdir(projectRoot, { recursive: true });
      console.log(`Created project root: ${projectRoot}`);
    }
    
    // Get all files in current directory
    const files = await readdir(process.cwd());
    
    for (const file of files) {
      try {
        const filePath = path.join(process.cwd(), file);
        const fileStat = await stat(filePath);
        
        // Skip directories and non-JS/JSON files for simplicity
        if (fileStat.isDirectory() || 
            (!file.endsWith('.js') && !file.endsWith('.json') && 
             !file.endsWith('.md') && !file.endsWith('.txt'))) {
          continue;
        }
        
        // Read file content
        const content = await readFile(filePath, 'utf8');
        
        // Find location comment
        const locationMatch = content.match(/\/\/\s*Location:\s*(\/claude-context-extender\/[^\s\n]+)/);
        
        if (locationMatch) {
          const targetPath = locationMatch[1];
          
          // Find file name comment (optional)
          const fileNameMatch = content.match(/\/\/\s*File:\s*([^\s\n]+)/);
          const targetFileName = fileNameMatch ? fileNameMatch[1] : path.basename(filePath);
          
          // Construct full target path
          const fullTargetPath = path.join(projectRoot, ...targetPath.split('/').filter(p => p && p !== 'claude-context-extender'));
          const targetDir = path.dirname(fullTargetPath);
          
          // Create target directory if it doesn't exist
          if (!fs.existsSync(targetDir)) {
            await mkdir(targetDir, { recursive: true });
            console.log(`Created directory: ${targetDir}`);
          }
          
          // Copy file to target location
          await copyFile(filePath, path.join(targetDir, targetFileName));
          console.log(`Copied ${filePath} to ${path.join(targetDir, targetFileName)}`);
        } else {
          // For files without location comments, try to infer from file names
          let targetDir = '';
          
          if (file === 'app.js') {
            targetDir = path.join(projectRoot, 'src');
          } else if (file === 'package.json' || file === 'README.md' || file === '.env.example') {
            targetDir = projectRoot;
          } else if (file === 'cli.js') {
            targetDir = path.join(projectRoot, 'bin');
          } else if (file.includes('Manager.js')) {
            if (file.includes('CLI')) {
              targetDir = path.join(projectRoot, 'src', 'cli');
            } else if (file.includes('Config') || file.includes('Logger')) {
              targetDir = path.join(projectRoot, 'src', 'utils');
            } else {
              targetDir = path.join(projectRoot, 'src', 'services');
            }
          } else if (file.includes('Controller.js')) {
            targetDir = path.join(projectRoot, 'src', 'controllers');
          } else if (file === 'Chunk.js') {
            targetDir = path.join(projectRoot, 'src', 'models');
          }
          
          if (targetDir) {
            // Create target directory if it doesn't exist
            if (!fs.existsSync(targetDir)) {
              await mkdir(targetDir, { recursive: true });
              console.log(`Created directory: ${targetDir}`);
            }
            
            // Copy file to target location
            await copyFile(filePath, path.join(targetDir, file));
            console.log(`Inferred and copied ${filePath} to ${path.join(targetDir, file)}`);
          } else {
            console.log(`Skipping ${file} - no location information found`);
          }
        }
      } catch (fileError) {
        console.error(`Error processing file ${file}:`, fileError.message);
      }
    }
    
    console.log('File organization completed successfully!');
  } catch (error) {
    console.error('Error organizing files:', error.message);
    process.exit(1);
  }
}

// Run the main function
organizeFiles();
