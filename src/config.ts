import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { KomaConfig, ProviderConfig } from './types.js';

let configCache: KomaConfig | null = null;
let modelToProviderMap: Map<string, string> | null = null;
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

  // Build model-to-provider map
  modelToProviderMap = new Map();
  for (const [providerName, providerConfig] of Object.entries(
    configCache.providers
  )) {
    for (const model of providerConfig.models) {
      modelToProviderMap.set(model, providerName);
    }
  }

  return configCache;
}

export function resolveProvider(modelName: string): {
  provider: string;
  config: ProviderConfig;
} {
  const config = loadConfig();

  if (!modelToProviderMap) {
    modelToProviderMap = new Map();
    for (const [providerName, providerConfig] of Object.entries(
      config.providers
    )) {
      for (const model of providerConfig.models) {
        modelToProviderMap.set(model, providerName);
      }
    }
  }

  const providerName = modelToProviderMap.get(modelName);
  if (!providerName) {
    throw new Error(
      `Model "${modelName}" not found in any provider. Available models: ${Array.from(
        modelToProviderMap.keys()
      ).join(', ')}`
    );
  }

  const providerConfig = config.providers[providerName];
  if (!providerConfig) {
    throw new Error(`Provider "${providerName}" not configured`);
  }

  return { provider: providerName, config: providerConfig };
}

export function getDefaultModel(type: 'text' | 'image' | 'video'): string {
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
  const models: string[] = [];

  for (const providerConfig of Object.values(config.providers)) {
    models.push(...providerConfig.models);
  }

  return models;
}

export function getConfigDir(): string {
  // Ensure config is loaded to set configDirCache
  loadConfig();
  return configDirCache || process.cwd();
}
