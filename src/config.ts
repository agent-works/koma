import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { KomaConfig, ProviderConfig } from './types.js';

let configCache: KomaConfig | null = null;
let modelToProviderMap: Map<string, string[]> | null = null;
let configDirCache: string | null = null;

function resolveEnvVars(value: any): any {
  if (typeof value === 'string') {
    return value.replace(/\$(\w+)/g, (match, envVar) => {
      return process.env[envVar] || match;
    });
  }
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.map(resolveEnvVars);
    }
    const resolved: any = {};
    for (const [key, val] of Object.entries(value)) {
      resolved[key] = resolveEnvVars(val);
    }
    return resolved;
  }
  return value;
}

export function loadConfig(): KomaConfig {
  if (configCache) {
    return configCache;
  }

  // Search order:
  // 1. ./koma.yaml  (current working directory, project-level)
  // 2. ~/.koma/koma.yaml (global)
  const searchPaths = [
    path.join(process.cwd(), 'koma.yaml'),
    path.join(process.env.HOME || '~', '.koma', 'koma.yaml'),
  ];

  let configPath: string | undefined;
  for (const p of searchPaths) {
    if (fs.existsSync(p)) {
      configPath = p;
      break;
    }
  }

  if (!configPath) {
    throw new Error(
      `No koma.yaml found. Checked:\n${searchPaths.map(p => '  - ' + p).join('\n')}`
    );
  }

  configDirCache = path.dirname(configPath);
  const configContent = fs.readFileSync(configPath, 'utf-8');
  const rawConfig = yaml.load(configContent) as KomaConfig;

  // Resolve environment variables
  configCache = resolveEnvVars(rawConfig) as KomaConfig;

  // Build model-to-provider map (one model can map to multiple providers)
  modelToProviderMap = new Map();
  for (const [providerName, providerConfig] of Object.entries(
    configCache.providers
  )) {
    for (const model of providerConfig.models) {
      const existing = modelToProviderMap.get(model) || [];
      existing.push(providerName);
      modelToProviderMap.set(model, existing);
    }
  }

  return configCache;
}

export function resolveProviders(modelName: string): Array<{
  provider: string;
  config: ProviderConfig;
}> {
  const config = loadConfig();

  if (!modelToProviderMap) {
    modelToProviderMap = new Map();
    for (const [providerName, providerConfig] of Object.entries(
      config.providers
    )) {
      for (const model of providerConfig.models) {
        const existing = modelToProviderMap.get(model) || [];
        existing.push(providerName);
        modelToProviderMap.set(model, existing);
      }
    }
  }

  const providerNames = modelToProviderMap.get(modelName);
  if (!providerNames || providerNames.length === 0) {
    throw new Error(
      `Model "${modelName}" not found in any provider. Available models: ${Array.from(
        modelToProviderMap.keys()
      ).join(', ')}`
    );
  }

  return providerNames.map(name => {
    const providerConfig = config.providers[name];
    if (!providerConfig) {
      throw new Error(`Provider "${name}" not configured`);
    }
    return { provider: name, config: providerConfig };
  });
}

export function getDefaultModel(type: 'text' | 'image' | 'video' | 'tts'): string {
  const config = loadConfig();
  const modelName = config.defaults[type];

  if (!modelName) {
    throw new Error(
      `No default ${type} model configured in koma.yaml or ~/.koma/koma.yaml`
    );
  }

  return modelName;
}

export function getAllModels(): string[] {
  const config = loadConfig();
  const seen = new Set<string>();

  for (const providerConfig of Object.values(config.providers)) {
    for (const model of providerConfig.models) {
      seen.add(model);
    }
  }

  return Array.from(seen);
}

export function getConfigDir(): string {
  // Ensure config is loaded to set configDirCache
  loadConfig();
  return configDirCache || process.cwd();
}
