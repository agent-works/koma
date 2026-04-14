import { loadConfig } from '../config.js';

export interface ModelsCommandOptions {
  json?: boolean;
}

export async function handleModelsCommand(options: ModelsCommandOptions): Promise<void> {
  try {
    const config = loadConfig();

    const modelsInfo = Object.entries(config.providers).map(([providerName, providerConfig]) => ({
      provider: providerName,
      type: providerConfig.type,
      models: providerConfig.models,
    }));

    if (options.json !== false) {
      console.log(
        JSON.stringify(
          {
            defaults: config.defaults,
            providers: modelsInfo,
          },
          null,
          2
        )
      );
    } else {
      console.log('Available Models by Provider:\n');

      for (const providerInfo of modelsInfo) {
        console.log(`${providerInfo.provider} (${providerInfo.type}):`);
        for (const model of providerInfo.models) {
          console.log(`  - ${model}`);
        }
        console.log();
      }

      console.log('Defaults:');
      if (config.defaults.text) console.log(`  text: ${config.defaults.text}`);
      if (config.defaults.image) console.log(`  image: ${config.defaults.image}`);
      if (config.defaults.video) console.log(`  video: ${config.defaults.video}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ error: message }, null, 2));
    process.exit(1);
  }
}
