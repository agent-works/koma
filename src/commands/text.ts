import fs from 'fs';
import { TextRequest, TextResponse } from '../types.js';
import { loadConfig, resolveProvider } from '../config.js';
import { createProvider } from '../providers/index.js';

export interface TextCommandOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  system?: string;
  input?: string;
  output?: string;
  json?: boolean;
}

export async function handleTextCommand(
  prompt: string | undefined,
  options: TextCommandOptions
): Promise<void> {
  try {
    const config = loadConfig();

    // Determine model
    const model = options.model || config.defaults.text;
    if (!model) {
      throw new Error('No model specified and no default text model configured');
    }

    // Get prompt from argument or file
    let finalPrompt: string;
    if (options.input) {
      finalPrompt = fs.readFileSync(options.input, 'utf-8');
    } else if (prompt) {
      finalPrompt = prompt;
    } else {
      throw new Error('No prompt provided (use positional argument or --input flag)');
    }

    // Resolve provider
    const { provider: providerName, config: providerConfig } = resolveProvider(model);
    const provider = createProvider(providerConfig.type, providerConfig);

    // Build request
    const request: TextRequest = {
      model,
      prompt: finalPrompt,
      systemPrompt: options.system,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    };

    // Generate text
    const response = await provider.generateText(request);

    // Output result
    if (options.json !== false) {
      console.log(JSON.stringify(response, null, 2));
    } else {
      console.log(response.text);
    }

    // Write to file if specified
    if (options.output) {
      fs.writeFileSync(options.output, response.text, 'utf-8');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ error: message }, null, 2));
    process.exit(1);
  }
}
