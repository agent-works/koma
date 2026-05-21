import fs from 'fs';
import path from 'path';
import { ImageRequest } from '../types.js';
import { loadConfig, resolveProviders } from '../config.js';
import { callWithFailover } from '../failover.js';
import { resolveFile, formatError } from '../utils.js';

export interface ImageCommandOptions {
  model?: string;
  size?: string;
  quality?: string;
  width?: number;
  height?: number;
  input?: string;
  output?: string;
  json?: boolean;
  file?: string[];
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

    // Resolve providers (ordered by priority)
    const providers = resolveProviders(model);

    // Resolve attached files
    const files = options.file?.map(f => resolveFile(f));

    // Build request
    const request: ImageRequest = {
      model,
      prompt: finalPrompt,
      outputPath,
      size: options.size,
      quality: options.quality,
      width: options.width,
      height: options.height,
      files,
    };

    // Generate image with failover
    const response = await callWithFailover(providers, (provider) =>
      provider.generateImage(request)
    );

    // Output result
    if (options.json !== false) {
      console.log(JSON.stringify(response, null, 2));
    } else {
      console.log(`Image saved to: ${response.filePath}`);
    }
  } catch (error) {
    console.error(JSON.stringify({ error: formatError(error) }, null, 2));
    process.exit(1);
  }
}

export function buildImageHelp(): string {
  let modelSection = '';
  try {
    const config = loadConfig();
    const lines: string[] = [];

    for (const [name, provider] of Object.entries(config.providers)) {
      for (const model of provider.models) {
        const isLikelyImageModel =
          model === config.defaults.image ||
          model.includes('image') ||
          model.startsWith('imagen');
        if (!isLikelyImageModel) continue;

        const suffix = model === config.defaults.image ? '  (default:image)' : '';
        lines.push(`    ${model}${suffix}    [${name}]`);
      }
    }

    modelSection = lines.length
      ? `Available Image Models:\n${lines.join('\n')}`
      : 'Available Image Models:\n    (no likely image models found in config)';
  } catch {
    modelSection = 'Available Image Models:\n    (run "koma models" after configuring koma.yaml)';
  }

  return `
koma image [prompt]
===================

Generate an image and save it to a file. Use --file for reference-image
editing or style transfer when the selected model/provider supports it.

Options:
  -m, --model <name>           Model to use (overrides default image model)
  --input <file>               Read prompt from file
  -o, --output <file>          Output image path
  --file <path>                Reference image file, repeatable
  --size <size>                Image size (OpenAI-compatible: auto, 1024x1024, 1536x1024, 1024x1536)
  --quality <quality>          Image quality (OpenAI-compatible: auto, low, medium, high)
  --json                       JSON output (default: true)
  -h, --help                   Show this help

${modelSection}

Examples:
  # Text-to-image
  koma image "isometric pixel-art village at dusk" --size 1536x1024 -o village.png

  # Reference image / editing
  koma image "转换为水彩画风格" --file photo.png --quality high -o watercolor.png
`.trim();
}
