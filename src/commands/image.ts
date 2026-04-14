import fs from 'fs';
import path from 'path';
import { ImageRequest, ImageResponse } from '../types.js';
import { loadConfig, resolveProvider } from '../config.js';
import { createProvider } from '../providers/index.js';

export interface ImageCommandOptions {
  model?: string;
  width?: number;
  height?: number;
  input?: string;
  output?: string;
  json?: boolean;
}

export async function handleImageCommand(
  prompt: string | undefined,
  options: ImageCommandOptions
): Promise<void> {
  try {
    const config = loadConfig();

    // Determine model
    const model = options.model || config.defaults.image;
    if (!model) {
      throw new Error('No model specified and no default image model configured');
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

    // Determine output path
    const outputPath = options.output || path.join(process.cwd(), `image-${Date.now()}.png`);

    // Resolve provider
    const { provider: providerName, config: providerConfig } = resolveProvider(model);
    const provider = createProvider(providerConfig.type, providerConfig);

    // Build request
    const request: ImageRequest = {
      model,
      prompt: finalPrompt,
      outputPath,
      width: options.width,
      height: options.height,
    };

    // Generate image
    const response = await provider.generateImage(request);

    // Output result
    if (options.json !== false) {
      console.log(JSON.stringify(response, null, 2));
    } else {
      console.log(`Image saved to: ${response.filePath}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ error: message }, null, 2));
    process.exit(1);
  }
}
