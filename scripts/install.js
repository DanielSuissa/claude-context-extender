#!/usr/bin/env node

/**
 * Installation script for Claude Context Extender
 * Installs all dependencies and handles errors gracefully
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

// Package.json path
const packageJsonPath = path.join(process.cwd(), 'package.json');

/**
 * Log with color
 */
function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

/**
 * Check if a command exists
 */
function commandExists(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Run a command with promise
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

/**
 * Create required directories
 */
function createDirectories() {
  const dirs = [
    'config',
    'data',
    'data/indexes',
    'data/conversations',
    'logs'
  ];

  log('Creating required directories...', colors.blue);
  
  for (const dir of dirs) {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      log(`✓ Created directory: ${dir}`, colors.green);
    } else {
      log(`✓ Directory already exists: ${dir}`, colors.yellow);
    }
  }
}

/**
 * Create default config if not exists
 */
function createDefaultConfig() {
  const configPath = path.join(process.cwd(), 'config', 'default.json');
  
  if (!fs.existsSync(configPath)) {
    log('Creating default configuration...', colors.blue);
    
    // Basic default config
    const defaultConfig = {
      claude: {
        model: 'claude-3-5-haiku-20241022',
        maxTokens: 100000,
        responseMaxTokens: 4000
      },
      chunking: {
        chunkSizePercentage: 40,
        overlapPercentage: 10
      },
      fileProcessing: {
        supportedTextExtensions: ['.txt', '.md', '.json', '.js', '.py', '.html', '.css'],
        supportedPdfExtensions: ['.pdf']
      },
      conversation: {
        maxRecentExchanges: 5,
        mergeFrequency: 3
      }
    };
    
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    log(`✓ Created default configuration at: ${configPath}`, colors.green);
  } else {
    log(`✓ Configuration already exists at: ${configPath}`, colors.yellow);
  }
}

/**
 * Create .env file if not exists
 */
function createEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  
  if (!fs.existsSync(envPath)) {
    log('Creating .env file...', colors.blue);
    
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      log(`✓ Created .env file from .env.example`, colors.green);
    } else {
      // Create basic .env file
      const envContent = `# Claude API Key
CLAUDE_API_KEY=your_claude_api_key_here

# Log level (error, warn, info, debug)
LOG_LEVEL=info

# Node environment (development, production)
NODE_ENV=development
`;
      fs.writeFileSync(envPath, envContent);
      log(`✓ Created basic .env file`, colors.green);
    }
    
    log(`⚠️  Remember to update your Claude API key in the .env file`, colors.yellow);
  } else {
    log(`✓ .env file already exists`, colors.yellow);
  }
}

/**
 * Install dependencies
 */
async function installDependencies() {
  if (!fs.existsSync(packageJsonPath)) {
    log('❌ package.json not found. Cannot install dependencies.', colors.red);
    return false;
  }
  
  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    log(`❌ Failed to parse package.json: ${error.message}`, colors.red);
    return false;
  }
  
  const dependencies = { ...packageJson.dependencies };
  const devDependencies = { ...packageJson.devDependencies };
  
  const packageManager = commandExists('yarn') ? 'yarn' : 'npm';
  log(`Using ${packageManager} as package manager`, colors.blue);
  
  log('Installing dependencies...', colors.blue);
  
  const failedPackages = [];
  
  // Install regular dependencies
  for (const [pkg, version] of Object.entries(dependencies)) {
    try {
      log(`Installing ${pkg}@${version}...`, colors.blue);
      await runCommand(packageManager, ['add', `${pkg}@${version}`]);
      log(`✓ Installed ${pkg}@${version}`, colors.green);
    } catch (error) {
      log(`⚠️  Failed to install specific version of ${pkg}, trying latest...`, colors.yellow);
      try {
        await runCommand(packageManager, ['add', pkg]);
        log(`✓ Installed ${pkg} (latest)`, colors.green);
      } catch (latestError) {
        log(`❌ Failed to install ${pkg}: ${latestError.message}`, colors.red);
        failedPackages.push(pkg);
      }
    }
  }
  
  // Install dev dependencies
  if (Object.keys(devDependencies).length > 0) {
    log('Installing dev dependencies...', colors.blue);
    
    for (const [pkg, version] of Object.entries(devDependencies)) {
      try {
        const devFlag = packageManager === 'yarn' ? '--dev' : '--save-dev';
        log(`Installing ${pkg}@${version}...`, colors.blue);
        await runCommand(packageManager, ['add', devFlag, `${pkg}@${version}`]);
        log(`✓ Installed ${pkg}@${version}`, colors.green);
      } catch (error) {
        log(`⚠️  Failed to install specific version of ${pkg}, trying latest...`, colors.yellow);
        try {
          const devFlag = packageManager === 'yarn' ? '--dev' : '--save-dev';
          await runCommand(packageManager, ['add', devFlag, pkg]);
          log(`✓ Installed ${pkg} (latest)`, colors.green);
        } catch (latestError) {
          log(`❌ Failed to install ${pkg}: ${latestError.message}`, colors.red);
          failedPackages.push(pkg);
        }
      }
    }
  }
  
  if (failedPackages.length > 0) {
    log(`⚠️  Some packages failed to install: ${failedPackages.join(', ')}`, colors.yellow);
    log('The application may not work correctly.', colors.yellow);
    return false;
  }
  
  return true;
}

/**
 * Make CLI executable
 */
function makeCliExecutable() {
  const cliPath = path.join(process.cwd(), 'bin', 'cli.js');
  
  if (fs.existsSync(cliPath)) {
    log('Making CLI executable...', colors.blue);
    
    try {
      fs.chmodSync(cliPath, '755');
      log(`✓ Made CLI executable`, colors.green);
    } catch (error) {
      log(`⚠️  Failed to make CLI executable: ${error.message}`, colors.yellow);
      log('You may need to run: chmod +x bin/cli.js', colors.yellow);
    }
  }
}

/**
 * Main installation function
 */
async function install() {
  log('Starting Claude Context Extender installation...', colors.blue);
  
  try {
    // Create required directories
    createDirectories();
    
    // Create configuration
    createDefaultConfig();
    
    // Create .env file
    createEnvFile();
    
    // Install dependencies
    const dependenciesInstalled = await installDependencies();
    
    // Make CLI executable
    makeCliExecutable();
    
    if (dependenciesInstalled) {
      log('\n✅ Installation completed successfully!', colors.green);
      log('Next steps:', colors.blue);
      log('1. Update your Claude API key in the .env file', colors.reset);
      log('2. Run the application with: node src/app.js', colors.reset);
      log('3. Or use the CLI with: ./bin/cli.js', colors.reset);
    } else {
      log('\n⚠️  Installation completed with warnings.', colors.yellow);
      log('The application may not work correctly until all dependencies are installed.', colors.yellow);
    }
  } catch (error) {
    log(`\n❌ Installation failed: ${error.message}`, colors.red);
  }
}

// Run the installer
install();
