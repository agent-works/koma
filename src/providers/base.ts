import { Provider, TextRequest, TextResponse, ImageRequest, ImageResponse } from '../types.js';

export abstract class BaseProvider implements Provider {
  abstract name: string;

  abstract generateText(req: TextRequest): Promise<TextResponse>;
  abstract generateImage(req: ImageRequest): Promise<ImageResponse>;
  abstract listModels(): string[];
}
