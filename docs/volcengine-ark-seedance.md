# Volcengine Ark — Seedance 视频生成 API

> 来源：火山方舟官方文档 + BytePlus ModelArk 文档  
> 整理日期：2026-04-15

---

## 概览

Seedance 是字节跳动的视频生成模型系列，通过火山方舟（Ark）平台的异步任务接口调用：

1. **创建任务** — `POST /contents/generations/tasks`
2. **查询任务** — `GET /contents/generations/tasks/{id}`

视频生成耗时较长（几十秒到数分钟），需要轮询任务状态直到终态。

---

## 接入信息

| 项目 | 值 |
|------|-----|
| Base URL | `https://ark.cn-beijing.volces.com/api/v3` |
| 认证方式 | `Authorization: Bearer <API_KEY>` |
| Content-Type | `application/json` |

---

## 模型 ID

| 友好名称 | 实际模型 ID | 说明 |
|----------|-------------|------|
| `seedance-1.5-pro` | `doubao-seedance-1-5-pro-251215` | 1.5 Pro 指定版本 |
| `seedance-1.5-pro-latest` | `doubao-seedance-1-5-pro` | 1.5 Pro 最新版（滚动更新） |
| `seedance-2.0` | `doubao-seedance-2-0-260128` | 2.0 指定版本 |
| `seedance-2.0-latest` | `doubao-seedance-2-0` | 2.0 最新版（滚动更新） |

---

## 1. 创建视频生成任务

```
POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks
```

### 请求体

#### 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | string | ✅ | 模型 ID，见上表 |
| `content` | array | ✅ | 输入内容数组，见下方 Content 对象 |
| `ratio` | string | ❌ | 宽高比，默认 `"16:9"` |
| `resolution` | string | ❌ | 分辨率：`"480p"` / `"720p"` / `"1080p"` / `"2k"`（2.0 支持 2k） |
| `duration` | integer | ❌ | 时长（秒），范围 2–15，默认 5 |
| `generate_audio` | boolean | ❌ | 是否生成配音/环境音，默认 `false` |
| `seed` | integer | ❌ | 随机种子，0–4294967295，用于复现结果 |
| `watermark` | boolean | ❌ | 是否添加水印，默认 `false` |
| `negative_prompt` | string | ❌ | 负向提示词，描述不想出现的内容 |
| `camera_fixed` | boolean | ❌ | 是否固定摄像机（静止镜头），默认 `false` |
| `return_last_frame` | boolean | ❌ | 是否返回最后一帧图片（用于视频续写），默认 `false` |
| `callback_url` | string | ❌ | 任务完成后的 Webhook 回调地址 |
| `service_tier` | string | ❌ | 服务档位（延迟 vs. 成本权衡） |

#### ratio 可选值

`"16:9"` `"9:16"` `"1:1"` `"4:3"` `"3:4"` `"21:9"` `"adaptive"`

#### Content 对象

`content` 是一个数组，每个元素描述一种输入：

**文本输入（text-to-video）**

```json
{ "type": "text", "text": "提示词内容" }
```

**图片输入（image-to-video，首帧控制）**

```json
{
  "type": "image_url",
  "image_url": { "url": "https://..." }
}
```

> URL 也可以是本地 base64：`"data:image/jpeg;base64,<base64_data>"`

**Seedance 2.0 多模态输入**（最多 12 个参考文件）

| 类型 | 上限 | 说明 |
|------|------|------|
| 图片（`image_url`） | 9 个 | 角色、场景、风格参考 |
| 视频（`video_url`） | 3 个，总时长 ≤ 15s | 动作、镜头运动参考 |
| 音频（`audio_url`） | 3 个，总时长 ≤ 15s，MP3 格式 | 节奏、对话、音效参考 |

### 请求示例

**纯文本生成（T2V）**

```json
{
  "model": "doubao-seedance-1-5-pro-251215",
  "content": [
    {
      "type": "text",
      "text": "一只金毛犬在海滩奔跑，海浪拍打，阳光明媚，电影感镜头"
    }
  ],
  "ratio": "16:9",
  "duration": 5,
  "generate_audio": true,
  "watermark": false
}
```

**图片转视频（I2V，首帧控制）**

```json
{
  "model": "doubao-seedance-1-5-pro-251215",
  "content": [
    { "type": "text", "text": "人物转身，镜头缓慢推进" },
    { "type": "image_url", "image_url": { "url": "https://example.com/frame.jpg" } }
  ],
  "ratio": "9:16",
  "duration": 5
}
```

### 响应（202 Accepted）

```json
{
  "id": "cgt-2026xxxx-xxxxxxxx"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 任务 ID，用于后续查询 |

---

## 2. 查询任务状态

```
GET https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{id}
```

### 任务状态

| 状态 | 含义 |
|------|------|
| `queued` | 排队中 |
| `running` | 生成中 |
| `succeeded` | 成功完成 ✅ |
| `failed` | 生成失败 ❌ |
| `expired` | 任务过期 |
| `cancelled` | 已取消 |

**终态**：`succeeded` / `failed` / `expired` / `cancelled`

### 成功响应示例

```json
{
  "id": "cgt-2026xxxx-xxxxxxxx",
  "model": "doubao-seedance-1-5-pro-251215",
  "status": "succeeded",
  "content": {
    "video_url": "https://ark-content-generation-cn-beijing.tos-cn-beijing.volces.com/...",
    "last_frame_url": "https://..."
  },
  "usage": {
    "completion_tokens": 108900,
    "total_tokens": 108900
  },
  "resolution": "720p",
  "ratio": "16:9",
  "duration": 5,
  "framespersecond": 24,
  "generate_audio": true,
  "seed": 1234567890,
  "draft": false,
  "created_at": 1744123456,
  "updated_at": 1744123789
}
```

### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 任务 ID |
| `model` | string | 使用的模型 |
| `status` | string | 任务状态 |
| `content.video_url` | string | 视频下载 URL（**24 小时内有效**） |
| `content.last_frame_url` | string | 最后一帧图片 URL（仅当 `return_last_frame: true`） |
| `usage.completion_tokens` | integer | 消耗的 token 数 |
| `usage.total_tokens` | integer | 总 token 数 |
| `resolution` | string | 输出分辨率 |
| `ratio` | string | 输出宽高比 |
| `duration` | integer | 视频时长（秒） |
| `framespersecond` | integer | 帧率（FPS） |
| `generate_audio` | boolean | 是否含音频 |
| `seed` | integer | 实际使用的随机种子 |
| `created_at` | integer | 创建时间（Unix 时间戳） |
| `updated_at` | integer | 最后更新时间（Unix 时间戳） |

### 失败响应示例

```json
{
  "id": "cgt-2026xxxx-xxxxxxxx",
  "status": "failed",
  "error": {
    "code": "ContentPolicyViolation",
    "message": "Input content violates usage policy"
  }
}
```

---

## Seedance 1.5 Pro vs 2.0 对比

| 特性 | 1.5 Pro | 2.0 |
|------|---------|-----|
| 最高分辨率 | 1080p | 2K |
| 多模态输入 | 文本 + 图片 | 文本 + 图片 + 视频 + 音频 |
| 参考图片上限 | 1–2 张 | 最多 9 张 |
| 原生音频生成 | ✅ | ✅（更完整） |
| 视频时长 | 2–15s | 2–15s |
| 首尾帧控制 | 首帧 | 首帧 + 尾帧 |

---

## 轮询建议

- **轮询间隔**：5 秒（默认），可调整
- **超时时间**：600 秒（10 分钟，视频生成最长约 3–5 分钟）
- **视频 URL 有效期**：24 小时，需及时下载
- **任务历史查询期**：7 天

---

## koma 中的对应参数

koma 的 `VideoRequest` 字段与 Ark API 的映射关系：

| koma 字段 | Ark 请求字段 | 说明 |
|-----------|-------------|------|
| `prompt` | `content[0].text` | 主提示词 |
| `referenceImageUrl` | `content[1].image_url.url` | 首帧参考图 |
| `ratio` | `ratio` | 宽高比 |
| `duration` | `duration` | 时长（秒） |
| `generateAudio` | `generate_audio` | 生成音频 |
| `seed` | `seed` | 随机种子 |
| `watermark` | `watermark` | 水印 |
| `negativePrompt` | `negative_prompt` | 负向提示词 |
| `cameraFixed` | `camera_fixed` | 固定镜头 |
| `pollIntervalMs` | —（客户端控制） | 轮询间隔 |
| `timeoutMs` | —（客户端控制） | 超时时间 |
