import { Provider, TextRequest, TextResponse, ImageRequest, ImageResponse, VideoRequest, VideoResponse } from '../types.js';

export abstract class BaseProvider implements Provider {
  abstract name: string;

  abstract generateText(req: TextRequest): Promise<TextResponse>;
  abstract generateImage(req: ImageRequest): Promise<ImageResponse>;
  generateVideo?(req: VideoRequest): Promise<VideoResponse>;
  abstract listModels(): string[];
}
