# Volcengine — 豆包语音合成（TTS）API

> 来源：火山引擎"豆包大模型语音合成"文档 + 项目实测验证
> 整理日期：2026-04-17

---

## 概览

火山引擎 TTS 是**独立产品线**，和 Ark（方舟）不是同一套：

- Ark：LLM、图像、视频 → `https://ark.cn-beijing.volces.com/api/v3`
- **TTS**：语音合成 → `https://openspeech.bytedance.com/api/v1/tts`

两者凭证互不通用。需要在火山控制台的"语音技术"产品下单独开通。

---

## 接入信息

| 项 | 值 |
|------|-----|
| Endpoint | `https://openspeech.bytedance.com/api/v1/tts` |
| Method | `POST` |
| 认证 | `Authorization: Bearer;<access_token>` **（注意分号，不是空格）** |
| Content-Type | `application/json` |

凭证组成：
- `appid` — 应用 ID（数字字符串）
- `access_token` — 访问令牌（32 位字符串）
- `cluster` — 集群标识（决定音色权限）

---

## 集群（Cluster）

| Cluster | 含义 |
|---------|------|
| `volcano_tts` | **预置音色**（bigtts 系列，325+ 音色，即开即用） |
| `volcano_icl` | **声音复刻**（需要先上传音频样本训练自己的 speaker_id） |
| `volcano_icl_concurr` | 声音复刻并发版 |

大多数场景用 `volcano_tts` 即可。

---

## 请求体结构

```json
{
  "app": {
    "appid": "7799339640",
    "token": "<access_token>",
    "cluster": "volcano_tts"
  },
  "user": {
    "uid": "any-string"
  },
  "audio": {
    "voice_type": "zh_male_aojiaobazong_moon_bigtts",
    "encoding": "mp3",
    "rate": 24000,
    "speed_ratio": 1.0,
    "volume_ratio": 1.0,
    "pitch_ratio": 1.0
  },
  "request": {
    "reqid": "<UUID>",
    "text": "要合成的文本",
    "text_type": "plain",
    "operation": "query"
  }
}
```

### 字段说明

**app 块**（鉴权）
- `appid`、`token`、`cluster` — 三者都必填

**user 块**
- `uid` — 任意字符串即可（内部用于去重或日志），agent 场景可固定一个

**audio 块**（音频参数）
- `voice_type` — 音色 ID（见下文）
- `encoding` — `mp3` / `wav` / `pcm` / `ogg_opus`
- `rate` — 采样率，`8000` / `16000` / `24000`（默认 24000）
- `speed_ratio` — 语速 0.2 ~ 3.0（默认 1.0）
- `volume_ratio` — 音量 0.1 ~ 3.0（默认 1.0）
- `pitch_ratio` — 音调 0.1 ~ 3.0（默认 1.0）
- `emotion` — 情感（可选，部分音色支持）

**request 块**
- `reqid` — 本次请求的唯一 ID，建议用 UUID
- `text` — 文本，最长 1024 字节（UTF-8）
- `text_type` — `plain`（纯文本）或 `ssml`（SSML 标记）
- `operation` — 固定为 `query`（非流式）

---

## 响应格式

### 成功

```json
{
  "reqid": "<UUID>",
  "code": 3000,
  "message": "Success",
  "sequence": -1,
  "data": "<base64-encoded-audio-bytes>",
  "addition": { "duration": "...", "first_pkg": "..." }
}
```

`data` 字段是 **base64 编码的音频二进制**，需要 `base64.b64decode()` 得到文件字节再写入文件。

### 失败

```json
{
  "reqid": "<UUID>",
  "code": 3001,
  "message": "<错误描述>"
}
```

常见错误码：

| code | 含义 | 处理 |
|------|------|------|
| 3001 | 资源未授权 / 参数错误 | 检查 cluster、voice_type、appid 是否匹配 |
| 3050 | speaker_id 未训练 | 仅声音复刻场景 |
| 45000292 | 并发超限 | 等待或升级套餐 |

---

## 音色 ID 规范

预置音色的命名约定：`<lang>_<gender>_<name>_<series>_bigtts`

| 部分 | 示例值 |
|------|--------|
| lang | `zh`（中文）、`en`（英文）、`ja`（日语）等 |
| gender | `male`、`female` |
| name | 音色昵称，如 `aojiaobazong`、`xiaoxiao`、`sarah` |
| series | `moon`、`mars`、`conversation_wvae` 等产品系列 |

完整音色列表：[官方文档 6561/1257544](https://www.volcengine.com/docs/6561/1257544)

### 实测可用音色（已验证）

**中文**：
- `zh_male_aojiaobazong_moon_bigtts` — 傲娇霸总男声
- `zh_female_shuangkuaisisi_moon_bigtts` — 爽快思思女声
- `zh_female_xiaoxiao_bigtts` — 标准女声（部分 cluster）

**英文**：
- `en_female_sarah_new_conversation_wvae_bigtts` — 美式女声（对话风）
- `en_male_charlie_conversation_wvae_bigtts` — 美式男声（对话风）
- `en_female_emily_mars_bigtts` — 英式女声
- `en_male_dave_moon_bigtts` — 英式男声

---

## curl 示例（完整可运行）

```bash
curl -X POST https://openspeech.bytedance.com/api/v1/tts \
  -H "Authorization: Bearer;<access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "app": {
      "appid": "<appid>",
      "token": "<access_token>",
      "cluster": "volcano_tts"
    },
    "user": { "uid": "test" },
    "audio": {
      "voice_type": "zh_male_aojiaobazong_moon_bigtts",
      "encoding": "mp3",
      "rate": 24000,
      "speed_ratio": 1.0
    },
    "request": {
      "reqid": "'$(uuidgen)'",
      "text": "你好，这是一段测试语音。",
      "operation": "query"
    }
  }' | python3 -c "
import sys, json, base64
d = json.load(sys.stdin)
if d.get('code') == 3000:
    with open('out.mp3', 'wb') as f:
        f.write(base64.b64decode(d['data']))
    print('Saved out.mp3')
else:
    print('Error:', d)
"
```

---

## 限制与注意事项

- **单次文本长度上限** 1024 字节（UTF-8），超长需在客户端分段调用后拼接
- **默认并发** 根据套餐不同，免费 / 基础套餐可能并发 = 1
- **响应时间** 一般 500ms ~ 3s，取决于文本长度
- **费用** 按字符计费（参见火山控制台）
- **流式接口** 另有 WebSocket / SSE 版本（`/api/v3/tts/unidirectional`），本文档只覆盖非流式 HTTP（`/api/v1/tts`）

---

## 与 Ark TTS 的关系

火山方舟（Ark）**不提供** TTS 端点。虽然 Ark 支持 LLM / 图像 / 视频 / Embedding，但 TTS 始终归属"语音技术"产品线。
