import { GoogleAuth } from 'google-auth-library';
import { BaseProvider } from './base.js';
import { TextRequest, TextResponse, ImageRequest, ImageResponse, ProviderConfig } from '../types.js';
import path from 'path';
import fs from 'fs';

interface AccessTokenCache {
  token: string;
  expiresAt: number;
}

export class VertexAIProvider extends BaseProvider {
  name = 'vertex-ai';
  private config: ProviderConfig;
  private models: string[];
  private googleAuth: GoogleAuth | null = null;
  private tokenCache: AccessTokenCache | null = null;

  constructor(config: ProviderConfig) {
    super();
    this.config = config;
    this.models = config.models || [];
  }

  /**
   * Get a valid access token, using cached token if available and not expired
   */
  private async getAccessToken(): Promise<string> {
    // Check if cached token is still valid (with 5-minute buffer)
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
      return this.tokenCache.token;
    }

    // Initialize GoogleAuth if needed
    if (!this.googleAuth) {
      if (!this.config.service_account) {
        throw new Error(
          'Vertex AI provider requires service_account credentials in config ' +
          '(service_account.client_email and service_account.private_key)'
        );
      }

      this.googleAuth = new GoogleAuth({
        credentials: {
          client_email: this.config.service_account.client_email,
          private_key: this.config.service_account.private_key,
        },
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
    }

    // Get authorized client and fetch token
    const client = await this.googleAuth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
    const expiry_date = (client as any).credentials?.expiry_date;

    if (!token) {
      throw new Error('Failed to obtain access token from Google Auth');
    }

    // Cache the token
    this.tokenCache = {
      token,
      expiresAt: expiry_date || Date.now() + 60 * 60 * 1000,
    };

    return token;
  }

  /**
   * Get project ID from config
   */
  private getProjectId(): string {
    if (!this.config.project) {
      throw new Error('Vertex AI provider requires "project" field in config');
    }
    return this.config.project;
  }

  /**
   * Get the location for API calls
   */
  private getLocation(): string {
    return this.config.location || 'us-central1';
  }

  async generateText(req: TextRequest): Promise<TextResponse> {
    try {
      const projectId = this.getProjectId();
      const location = this.getLocation();
      const accessToken = await this.getAccessToken();

      // Build parts array
      const parts: any[] = [{ text: req.prompt }];

      // Append file data as inlineData parts
      if (req.files) {
        for (const file of req.files) {
          parts.push({
            inlineData: { mimeType: file.mimeType, data: file.data },
          });
        }
      }

      // Build request body
      const requestBody: any = {
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        generationConfig: {
          temperature: req.temperature ?? 0.7,
          maxOutputTokens: req.maxTokens ?? 2048,
        },
      };

      // Add system instruction if provided
      if (req.systemPrompt) {
        requestBody.systemInstruction = {
          parts: [{ text: req.systemPrompt }],
        };
      }

      // Call Vertex AI API
      const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${req.model}:generateContent`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Vertex AI API error (${response.status}): ${errorBody}`);
      }

      const result = await response.json() as any;

      // Extract text and usage from response
      if (!result.candidates || result.candidates.length === 0) {
        throw new Error('No candidates in Vertex AI response');
      }

      const candidate = result.candidates[0];
      if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        throw new Error('No text content in Vertex AI response');
      }

      const text = candidate.content.parts[0].text;

      const usage = result.usageMetadata
        ? {
            inputTokens: result.usageMetadata.promptTokenCount || 0,
            outputTokens: result.usageMetadata.candidatesTokenCount || 0,
          }
        : undefined;

      return {
        model: req.model,
        text,
        usage,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Vertex AI text generation failed: ${message}`);
    }
  }

  async generateImage(req: ImageRequest): Promise<ImageResponse> {
    try {
      // Check if this is a Nano Banana model or Imagen model
      const isNanoBanana = req.model.includes('image');
      const isImagen = req.model.startsWith('imagen');

      if (isImagen) {
        return this.generateImageImagen(req);
      } else if (isNanoBanana) {
        return this.generateImageNanoBanana(req);
      } else {
        throw new Error(
          `Unsupported model for image generation: ${req.model}. ` +
          `Use models with 'image' in the name (Nano Banana) or starting with 'imagen' (Imagen).`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Vertex AI image generation failed: ${message}`);
    }
  }

  /**
   * Generate image using Nano Banana models (gemini-3-pro-image-preview, etc.)
   */
  private async generateImageNanoBanana(req: ImageRequest): Promise<ImageResponse> {
    const projectId = this.getProjectId();
    const location = this.getLocation();
    const accessToken = await this.getAccessToken();

    // Build request body with responseModalities for image generation
    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: req.prompt }],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    };

    // Call Vertex AI API
    const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${req.model}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Vertex AI API error (${response.status}): ${errorBody}`);
    }

    const result = await response.json() as any;

    // Extract image from response
    if (!result.candidates || result.candidates.length === 0) {
      throw new Error('No candidates in Vertex AI response');
    }

    const candidate = result.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      throw new Error('No content in Vertex AI response');
    }

    // Find the part with inlineData (the image)
    let imagePart: any = null;
    for (const part of candidate.content.parts) {
      if (part.inlineData && part.inlineData.data) {
        imagePart = part;
        break;
      }
    }

    if (!imagePart) {
      throw new Error('No image data in Vertex AI response');
    }

    const { mimeType, data: base64Data } = imagePart.inlineData;

    // Decode base64 and write to file
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const outputPath = req.outputPath || path.join(process.cwd(), `image-${Date.now()}.png`);

    fs.writeFileSync(outputPath, imageBuffer);

    // Get file size
    const stats = fs.statSync(outputPath);

    return {
      model: req.model,
      filePath: outputPath,
      mimeType,
      sizeBytes: stats.size,
    };
  }

  /**
   * Generate image using Imagen models (older style)
   */
  private async generateImageImagen(req: ImageRequest): Promise<ImageResponse> {
    const projectId = this.getProjectId();
    const location = this.getLocation();
    const accessToken = await this.getAccessToken();

    // Build request body for Imagen API
    const requestBody = {
      instances: [{ prompt: req.prompt }],
      parameters: { sampleCount: 1 },
    };

    // Call Vertex AI API using predict endpoint for Imagen
    const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${req.model}:predict`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Vertex AI API error (${response.status}): ${errorBody}`);
    }

    const result = await response.json() as any;

    // Extract image from response
    if (!result.predictions || result.predictions.length === 0) {
      throw new Error('No predictions in Vertex AI response');
    }

    const prediction = result.predictions[0];
    if (!prediction.bytesBase64Encoded) {
      throw new Error('No image data in Vertex AI response');
    }

    // Decode base64 and write to file
    const imageBuffer = Buffer.from(prediction.bytesBase64Encoded, 'base64');
    const outputPath = req.outputPath || path.join(process.cwd(), `image-${Date.now()}.png`);

    fs.writeFileSync(outputPath, imageBuffer);

    // Get file size
    const stats = fs.statSync(outputPath);

    return {
      model: req.model,
      filePath: outputPath,
      mimeType: 'image/png',
      sizeBytes: stats.size,
    };
  }

  listModels(): string[] {
    return this.models;
  }
}
