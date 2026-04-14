#!/usr/bin/env node

import { Command } from 'commander';
import { handleTextCommand } from './commands/text.js';
import { handleImageCommand } from './commands/image.js';
import { handleModelsCommand } from './commands/models.js';
import { loadConfig } from './config.js';

/**
 * Build the rich help text with live model info from config
 */
function buildHelp(): string {
  let modelSection = '';
  try {
    const config = loadConfig();
    const lines: string[] = [];

    lines.push('  Available Models:');
    for (const [name, provider] of Object.entries(config.providers)) {
      for (const model of provider.models) {
        const tags: string[] = [];
        if (model === config.defaults.text) tags.push('default:text');
        if (model === config.defaults.image) tags.push('default:image');
        if (model === config.defaults.video) tags.push('default:video');
        const suffix = tags.length ? `  (${tags.join(', ')})` : '';
        lines.push(`    ${model}${suffix}    [${name}]`);
      }
    }
    modelSection = lines.join('\n');
  } catch {
    modelSection = '  Available Models:\n    (run "koma models" after configuring koma.yaml)';
  }

  return `
koma — Unified AI model CLI for agents and researchers
=======================================================

A tool that lets agents (and humans) call text, image, and video
generation models from different providers through one interface.
Configure once, use everywhere.

Commands:
  koma text [prompt]     Generate text (chat completion)
  koma image [prompt]    Generate an image and save to file
  koma video [prompt]    Generate a video (placeholder)
  koma models            List all available models as JSON

Global Options:
  -m, --model <name>     Model to use (overrides default)
  --system <text>        System prompt / role instruction
  --temperature <n>      Sampling temperature (0.0–2.0)
  --max-tokens <n>       Max output tokens
  --input <file>         Read prompt from file (useful for long text)
  -o, --output <file>    Write result to file
  --json                 JSON output (default: true)
  -V, --version          Show version
  -h, --help             Show this help

${modelSection}

Examples:

  # Text generation (uses default model)
  koma text "用三句话介绍人工智能"

  # Text with specific model and system prompt
  koma text -m gemini-2.5-pro --system "你是一个分镜设计师" "把这段描述拆成5个分镜"

  # Text from file input, save output
  koma text --input chapter.txt --system "分析这个章节的主要人物" -o analysis.txt

  # Image generation (Nano Banana Pro)
  koma image "一只橘猫戴着礼帽坐在窗台上，水彩画风格" -o cat.png

  # Image with specific model
  koma image -m gemini-3.1-flash-image-preview "a cyberpunk cityscape" -o city.png

  # List all models and defaults (JSON)
  koma models

Output Format:
  All commands output JSON to stdout by default.
  Errors go to stderr as JSON: {"error": "message"}

  text response:  {"model": "...", "text": "...", "usage": {"inputTokens": N, "outputTokens": N}}
  image response: {"model": "...", "filePath": "...", "mimeType": "...", "sizeBytes": N}

Configuration:
  Config file: ./koma.yaml or ~/.koma/config.yaml
  Keys can reference env vars: $OPENAI_API_KEY
  Run "koma models" for full JSON config details.
`.trim();
}

const program = new Command();

program
  .name('koma')
  .version('0.1.0')
  .option('-m, --model <model>', 'Model to use')
  .option('--temperature <number>', 'Temperature for generation', (val: string) => parseFloat(val))
  .option('--max-tokens <number>', 'Maximum tokens to generate', (val: string) => parseInt(val))
  .option('--system <text>', 'System prompt')
  .option('--input <file>', 'Input file for prompt')
  .option('-o, --output <file>', 'Output file for response')
  .option('--json', 'Output JSON (default true)', true)
  .helpOption('-h, --help', 'Show help with usage, models, and examples')
  .addHelpText('beforeAll', '')  // suppress default
  .configureHelp({ formatHelp: () => buildHelp() });

program
  .command('text [prompt]')
  .description('Generate text using an AI model')
  .action(async (prompt: string | undefined) => {
    const parent = program.opts();
    await handleTextCommand(prompt, {
      model: parent.model,
      temperature: parent.temperature,
      maxTokens: parent.maxTokens,
      system: parent.system,
      input: parent.input,
      output: parent.output,
      json: parent.json !== false,
    });
  });

program
  .command('image [prompt]')
  .description('Generate an image using an AI model')
  .action(async (prompt: string | undefined) => {
    const parent = program.opts();
    await handleImageCommand(prompt, {
      model: parent.model,
      width: undefined,
      height: undefined,
      input: parent.input,
      output: parent.output,
      json: parent.json !== false,
    });
  });

program
  .command('video [prompt]')
  .description('Generate a video using an AI model (placeholder)')
  .action(async () => {
    console.error(
      JSON.stringify(
        { error: 'Video generation not yet implemented' },
        null,
        2
      )
    );
    process.exit(1);
  });

program
  .command('models')
  .description('List available models')
  .action(async () => {
    const parent = program.opts();
    await handleModelsCommand({
      json: parent.json !== false,
    });
  });

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  console.log(buildHelp());
}
