# koma tts — 通用 TTS 命令 with Volcengine Doubao Provider

## Goal

为 koma 增加 `koma tts` 通用语音合成命令，通过 Volcengine 豆包语音合成 API 接入第一个 TTS provider，架构支持未来扩展 OpenAI TTS、ElevenLabs 等。命令面向 agent 和人类使用，`--help` 要能列出所有可用音色。

## Positioning

遵循 koma 既有模式：

- `koma text` / `koma image` — 通用（API 已收敛到 OpenAI 格式，跨 provider）
- `koma seedance` — 专属（视频参数各家差异极大）
- **`koma tts`** — 通用（核心语义一致：text + voice → audio；provider 差异通过 model 路由封装）

Voice ID 天然与 provider 绑定（`zh_male_*_bigtts` 专属火山，`alloy` 专属 OpenAI），用户选 model 就隐式选了 provider 和 voice 命名空间。

## Command Interface

```
Usage: koma tts [options] <text>

Generate speech audio from text.

Input:
  <text>                     Text to synthesize (positional)
  --input <file>             Read text from file

Output:
  -o, --output <file>        Output file (default: tts-<timestamp>.mp3)

Voice:
  -m, --model <name>         TTS model (default: doubao-tts)
  --voice <id>               Voice ID (see `--help -m <model>` for available voices)

Tuning:
  --speed <n>                Speech rate 0.2-3.0 (default 1.0)
  --volume <n>               Volume 0.1-3.0 (default 1.0)
  --pitch <n>                Pitch 0.1-3.0 (default 1.0)
  --emotion <name>           Emotion (only supported by *_emo_* voices)

Audio format:
  --format <fmt>             mp3 (default), wav, pcm, ogg_opus
  --sample-rate <hz>         8000, 16000, 24000 (default 24000)

Examples:

  # Minimal — uses default voice from config or first in model's list
  koma tts "你好世界" -o hello.mp3

  # Specify voice
  koma tts "欢迎光临" --voice zh_male_aojiaobazong_moon_bigtts -o out.mp3

  # Adjust speed and pitch
  koma tts "快速播报" --voice zh_female_shuangkuaisisi_moon_bigtts --speed 1.3 --pitch 1.1

  # English voice
  koma tts "Hello, welcome to Koma." --voice en_female_sarah_new_conversation_wvae_bigtts -o welcome.mp3

  # Emotion (only works on multi-emotion voices)
  koma tts "这真是太棒了！" --voice zh_female_gaolengyujie_emo_v2_mars_bigtts --emotion 开心

  # Read text from file
  koma tts --input script.txt -o audio.mp3

  # List voices for a model
  koma tts --help -m doubao-tts
```

## Dynamic --help

`--help` 根据 `-m` 参数动态显示音色列表：

- **无 `-m`**：显示通用帮助 + **默认模型**（`doubao-tts`）的音色列表（按分类分组）
- **有 `-m doubao-tts`**：显示该模型的音色列表
- **有 `-m <unknown>`**：显示"该模型音色列表不可用"提示

音色按官方 9 个分类分组展示，对应 `docs/volcengine-tts-full-reference.md` 里的结构：
1. 多情感音色（中文）— 16 个
2. 多情感音色（英文）— 6 个
3. 通用场景音色 — 36 个
4. IP 仿音音色 — 11 个
5. 趣味口音音色 — 12 个
6. 客服场景音色 — 15 个
7. 多语种音色 — 18 个
8. 视频配音音色 — 30+ 个
9. 有声阅读音色 — 11 个

每条音色格式：`  <voice_id>  # <中文名，语言标注>`

## Type Definitions

```typescript
// New types in src/types.ts

export interface TTSRequest {
  model: string;
  text: string;
  voice?: string;                       // provider-specific voice ID
  speed?: number;                       // 0.2-3.0, maps to speed_ratio for Volcengine
  volume?: number;                      // 0.1-3.0, maps to volume_ratio
  pitch?: number;                       // 0.1-3.0, maps to pitch_ratio
  emotion?: string;                     // provider-optional
  format?: 'mp3' | 'wav' | 'pcm' | 'ogg_opus';
  sampleRate?: number;                  // 16000 | 24000
  outputPath?: string;
}

export interface TTSResponse {
  model: string;
  filePath: string;
  mimeType: string;                     // audio/mpeg, audio/wav, etc.
  sizeBytes: number;
  durationMs?: number;                  // from API addition.duration when available
}

// Extended Provider interface
export interface Provider {
  name: string;
  generateText(req: TextRequest): Promise<TextResponse>;
  generateImage(req: ImageRequest): Promise<ImageResponse>;
  generateVideo?(req: VideoRequest): Promise<VideoResponse>;
  generateTTS?(req: TTSRequest): Promise<TTSResponse>;    // new, optional
  listModels(): string[];
}
```

## Provider Implementation — VolcengineTTSProvider

`src/providers/volcengine-tts.ts` 实现火山豆包 TTS V1 非流式 HTTP 接口。

**Provider type**: `volcengine-tts`（新增）

**API 调用**：
- Endpoint: `POST https://openspeech.bytedance.com/api/v1/tts`
- Auth: `Authorization: Bearer;<token>`（**分号**不是空格）
- Request body（嵌套结构）：
  ```json
  {
    "app": { "appid", "token", "cluster" },
    "user": { "uid": "koma" },
    "audio": { "voice_type", "encoding", "rate", "speed_ratio", "volume_ratio", "pitch_ratio", "emotion" },
    "request": { "reqid": <UUID>, "text", "text_type": "plain", "operation": "query" }
  }
  ```
- Response: `{ code, data (base64 audio) }`
  - `code === 3000` → 成功，base64 解码 data 写入 outputPath
  - 其他 → 抛错 `Volcengine TTS error (<code>): <message>`

**字段映射**：
- `speed` → `speed_ratio`
- `volume` → `volume_ratio`
- `pitch` → `pitch_ratio`
- `format` → `encoding`
- `sampleRate` → `rate`

**ProviderConfig 扩展**：
```typescript
interface ProviderConfig {
  type: 'vertex-ai' | 'volcengine-ark' | 'openai' | 'anthropic' | 'openai-compatible' | 'volcengine-tts';
  // ... 既有字段
  appid?: string;        // volcengine-tts 用
  cluster?: string;      // volcengine-tts 用
}
```

`token` 字段直接复用已有的 `key`（ProviderConfig 已有）——语义通用"凭证令牌"。

## File Structure

| 文件 | 动作 | 说明 |
|------|------|------|
| `src/types.ts` | Modify | 加 `TTSRequest`/`TTSResponse`，`Provider` 加 `generateTTS?`，`ProviderConfig` 加 `appid`/`cluster`，`KomaConfig.defaults` 加 `tts?` |
| `src/providers/volcengine-tts.ts` | Create | 新 provider 实现 |
| `src/providers/index.ts` | Modify | 注册 `volcengine-tts` case |
| `src/commands/tts.ts` | Create | 命令 handler、MODEL_VOICES 数据、`buildTTSHelp(model?)` |
| `src/cli.ts` | Modify | 注册 `tts` 子命令，动态 help（读取 `-m` 决定列表） |
| `src/config.ts` | Modify | `getDefaultModel` 支持 `'tts'` 类型 |
| `koma.yaml` | Modify | 加 `volcengine-tts` provider 配置 |
| `koma.yaml.example` | Modify | 加对应示例 |
| `test/tts.test.ts` | Create | 参数映射 + 错误场景测试 |
| `README.md` | Modify | 命令表、示例 |

## Voice Data Structure in tts.ts

```typescript
interface VoiceInfo {
  voiceId: string;       // voice_type 值
  name: string;          // 中文/英文名
  language: string;      // 语种标注
  emotions?: string[];   // 可选：支持的情感列表
  supportsMix?: boolean; // 是否支持中英混合
}

interface VoiceCategory {
  title: string;         // 类别标题（如"多情感音色（中文）"）
  voices: VoiceInfo[];
}

// MODEL_VOICES['doubao-tts'] 是 VoiceCategory[]
const MODEL_VOICES: Record<string, VoiceCategory[]> = {
  'doubao-tts': [ /* 9 个分类 */ ],
};
```

完整音色表数据源自 `docs/volcengine-tts-full-reference.md` 的音色列表章节。

## Error Handling

- **missing `--voice` 且无默认**：报错"Please specify --voice. Run `koma tts --help -m doubao-tts` to see available voices."
- **API error code 3050** (voice_type 不存在)：直接透传 + 提示运行 `--help -m <model>`
- **API error code 3001** (资源未授权)：报错 + 建议检查 appid/cluster
- **API error code 45000292** (并发超限)：抛错（failover 层可能会尝试下一个 provider，但目前只有一个 TTS provider）
- **prompt 超 1024 bytes**：本地预检，报错建议分段

## Testing

单元测试覆盖：
- `validateTTSParams`（如果有）
- VolcengineTTSProvider 请求体构造（不真正发 HTTP，验证映射逻辑）
- 音色分类数据完整性（共 170+ 个，分 9 类）
- help text 生成（不带 -m / 带 -m doubao-tts / 带未知 -m）

冒烟测试（连真实 API）：
- 最短调用 `koma tts "你好" -o out.mp3` → 生成 MP3 文件
- 带 voice 参数 → 使用指定音色
- 错误 voice → 清晰错误信息

## Non-goals

- **流式 TTS**（WebSocket / SSE）— 暂不做，非流式 HTTP 对 agent 场景够用
- **豆包 2.0 音色** — V1 接口不支持；未来加 V3 支持时再引入 `doubao-tts-2.0` model
- **声音复刻**（ICL） — 需要先上传样本训练，workflow 不适合单次 CLI 调用
- **SSML 标记** — 当前固定 `text_type: "plain"`；未来可通过 `--ssml` flag 引入
- **独立 `koma voices` 命令** — 音色列表在 `--help` 里即可，不额外增加命令
- **跨 provider failover** — TTS 只有一个 provider 时没意义；加第二个时再引入

## Verified Requirements

基于之前测试和文档调研：
- ✅ Volcengine TTS V1 非流式接口（`/api/v1/tts`）可用
- ✅ englishroom 凭证（appid `7799339640`）有权限，实测调通
- ✅ `cluster: volcano_tts` 支持所有 1.0 音色
- ✅ 响应格式：JSON `{code: 3000, data: base64}`
- ✅ 170+ 音色数据已在 `docs/volcengine-tts-full-reference.md`
