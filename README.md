# koma

统一的 AI 模型 CLI 工具，为 agent 研究和开发提供多模态模型调用基础设施。

一套命令调用不同 provider 的文本、图像、视频生成模型，让 agent 通过 CLI 便捷地使用各种能力。配置一次，到处使用。

## 安装

```bash
npm install -g koma-ai
```

## 快速开始

```bash
# 复制配置模板并填入你的密钥
cp $(npm root -g)/koma-ai/koma.yaml.example ./koma.yaml
# 编辑 koma.yaml，填写 provider 配置

# 使用
koma text "用三句话介绍人工智能"
koma image "一只橘猫戴着礼帽坐在窗台上，水彩画风格" -o cat.png
koma seedance "一只橘猫在屋顶上奔跑，镜头缓缓拉远" -o cat.mp4
koma models
```

## 命令

| 命令 | 说明 |
|------|------|
| `koma text [prompt]` | 文本生成（chat completion） |
| `koma image [prompt]` | 图像生成，保存到文件 |
| `koma seedance [prompt]` | 视频生成（Seedance 1.5 Pro / 2.0），运行 `koma seedance --help` 查看完整参数 |
| `koma models` | 列出所有可用模型（JSON） |

### 常用选项

```
-m, --model <name>     指定模型（覆盖默认值）
--system <text>        系统提示词
--temperature <n>      采样温度 (0.0–2.0)
--max-tokens <n>       最大输出 token 数
--input <file>         从文件读取 prompt
-o, --output <file>    输出到文件
--json                 JSON 输出（默认开启）
```

### Seedance 视频生成

`koma seedance` 是专门的 Seedance 视频生成命令，支持文生视频、首帧/尾帧驱动、音频生成、draft 预览等。运行 `koma seedance --help` 查看完整参数和丰富示例。

```bash
# 文生视频
koma seedance "一只橘猫在屋顶上奔跑" -o cat.mp4

# 首帧驱动
koma seedance "女孩微笑着转身" --first-frame portrait.jpg --ratio 9:16

# 首尾帧 + 音频
koma seedance "角色穿过花园" --first-frame start.jpg --last-frame end.jpg --audio

# 2.0 模型
koma seedance -m 2.0 "赛博朋克城市夜景" --duration 15 --audio
```

### 示例

```bash
# 指定模型和系统提示词
koma text -m gemini-2.5-pro --system "你是一个分镜设计师" "把这段描述拆成5个分镜"

# 从文件输入，结果保存到文件
koma text --input chapter.txt --system "分析这个章节的主要人物" -o analysis.txt

# 指定模型生成图像
koma image -m gemini-3.1-flash-image-preview "a cyberpunk cityscape" -o city.png

# 文生视频（默认 Seedance 1.5 Pro）
koma seedance "一只橘猫在屋顶上奔跑，镜头缓缓拉远" -o cat.mp4

# 图生视频（首帧驱动）
koma seedance "女孩微笑着转身" --first-frame photo.jpg -o out.mp4

# 视频生成带选项
koma seedance "赛博朋克城市夜景" --ratio 16:9 --duration 10 --audio --no-watermark
```

## 配置

通过 `koma.yaml` 配置 provider 和默认模型。查找顺序：

1. 当前工作目录 `./koma.yaml`
2. koma 安装目录 `<pkg>/koma.yaml`
3. 用户目录 `~/.koma/koma.yaml`

```yaml
defaults:
  text: gemini-2.5-pro
  image: gemini-2.5-flash-image
  video: seedance-1.5-pro

providers:
  vertex-ai:
    type: vertex-ai
    project: your-gcp-project-id
    location: us-central1
    service_account:
      client_email: your-sa@your-project.iam.gserviceaccount.com
      private_key: "-----BEGIN PRIVATE KEY-----\n<your-key>\n-----END PRIVATE KEY-----\n"
    models:
      - gemini-2.5-pro
      - gemini-2.5-flash-image

  volcengine-ark:
    type: volcengine-ark
    key: your-api-key-here
    models:
      - seedance-2.0
      - seedance-1.5-pro
```

所有配置内容自包含在 `koma.yaml` 中，不依赖外部文件或环境变量。

Volcengine Ark API Key 在[方舟控制台](https://console.volcengine.com/ark/region:ark+cn-beijing/apikey)获取。

## 输出格式

所有命令默认输出 JSON 到 stdout，错误输出到 stderr。设计上便于脚本和 agent 消费。

```jsonc
// text
{"model": "...", "text": "...", "usage": {"inputTokens": 0, "outputTokens": 0}}

// image
{"model": "...", "filePath": "...", "mimeType": "...", "sizeBytes": 0}

// video
{"model": "...", "taskId": "...", "status": "succeeded", "filePath": "..."}

// error (stderr)
{"error": "message"}
```

## 架构

```
src/
  cli.ts              # 入口，命令注册
  config.ts           # 配置加载，模型→provider 解析
  types.ts            # 类型定义
  commands/
    text.ts           # text 子命令
    image.ts          # image 子命令
    seedance.ts       # seedance 子命令（视频生成）
    models.ts         # models 子命令
  providers/
    base.ts           # Provider 抽象基类
    vertex-ai.ts      # Vertex AI 实现（文本 & 图像）
    volcengine-ark.ts # 火山方舟实现（Seedance 视频 & 文本）
    openai-compatible.ts # OpenAI 兼容实现（文本 & 图像）
    index.ts          # Provider 工厂
```

### Provider 扩展

类型系统预留了 `openai`、`anthropic`、`openai-compatible` provider，当前实现了 `vertex-ai` 和 `volcengine-ark`。添加新 provider 需要：

1. 在 `src/providers/` 下新建实现，继承 `BaseProvider`
2. 在 `src/providers/index.ts` 的工厂函数中注册
3. 在 `koma.yaml` 中配置

## 设计理念

koma 的目标是成为 agent 的模型工具层——agent 不需要关心 provider 差异和认证细节，只需通过统一的 CLI 调用所需能力：

- `koma text` — 推理、规划、分析
- `koma image` — 视觉内容生成
- `koma seedance` — Seedance 视频生成（专属命令，完整参数支持）
