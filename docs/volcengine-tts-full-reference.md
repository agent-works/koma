# 火山引擎豆包语音合成API文档

> 文档整理日期：2025-11-12
>
> 数据来源：
> - API文档：https://www.volcengine.com/docs/6561/1257584
> - 音色列表：https://www.volcengine.com/docs/6561/1257544
> - 2.0能力介绍：https://www.volcengine.com/docs/6561/1871062
> - V3 API文档：https://www.volcengine.com/docs/6561/1598757

---

## 目录

1. [接口说明](#接口说明)
2. [身份认证](#身份认证)
3. [V3 API详细说明](#v3-api详细说明)（推荐，支持豆包2.0高级功能）
4. [接口地址](#接口地址)
5. [请求参数](#请求参数)
6. [响应参数](#响应参数)
7. [错误码说明](#错误码说明)
8. [豆包语音合成2.0能力介绍](#豆包语音合成20能力介绍)
9. [音色列表](#音色列表)
10. [调用示例](#调用示例)

---

## 接口说明

火山引擎豆包语音合成服务提供两种接口方式：

### Websocket接口

- **V1 单向流式**: `wss://openspeech.bytedance.com/api/v1/tts/ws_binary`
- **V3 单向流式**: `wss://openspeech.bytedance.com/api/v3/tts/unidirectional/stream` (推荐)
- **V3 双向流式**: `wss://openspeech.bytedance.com/api/v3/tts/bidirection`

### HTTP接口

- **V1 非流式**: `https://openspeech.bytedance.com/api/v1/tts`
- **V3 单向流式**: `https://openspeech.bytedance.com/api/v3/tts/unidirectional`

**重要说明**：
- 大模型音色推荐接入V3接口，时延表现更好
- V1接口不支持"豆包语音合成模型2.0"的音色

---

## 身份认证

认证方式采用 **Bearer Token**：

1. 在请求的 Header 中添加：
   ```
   Authorization: Bearer;{token}
   ```
   **注意**：Bearer 和 token 使用分号 `;` 分隔

2. 在请求的 JSON 中填入对应的 `appid`

### 获取认证信息

- AppID、Token、Cluster 等信息可在控制台获取
- 参考：[控制台使用FAQ-Q1](https://www.volcengine.com/docs/6561/1257584)

---

## V3 API详细说明

**推荐使用V3接口，支持豆包语音合成2.0的高级功能！**

### 接口功能

单向流式API为用户提供文本转语音的能力，支持：
- 多语种、多方言
- HTTP协议流式输出
- 支持豆包语音合成模型2.0的语音指令、引用上文、语音标签等高级功能
- 支持声音复刻和音色混音

### 最佳实践

1. **流式数据处理**
   - 客户端读取服务端流式返回的JSON数据，从中取出对应的音频数据
   - 音频数据返回的是base64格式，需要解析后拼接到字节数组即可组装音频进行播放

2. **连接复用**
   - 使用对应编程语言的连接复用组件，避免重复建立TCP连接
   - 火山服务端keep-alive时间为1分钟
   - Python示例：
     ```python
     session = requests.Session()
     response = session.post(url, headers=headers, json=payload, stream=True)
     ```

### 请求说明

#### 请求路径

```
https://openspeech.bytedance.com/api/v3/tts/unidirectional
```

#### Request Headers

| Header | 说明 | 是否必须 | 示例值 |
|--------|------|----------|--------|
| X-Api-App-Id | 使用火山引擎控制台获取的APP ID | 是 | 123456789 |
| X-Api-Access-Key | 使用火山引擎控制台获取的Access Token | 是 | your-access-key |
| X-Api-Resource-Id | 调用服务的资源信息ID | 是 | seed-tts-2.0 |
| X-Api-Request-Id | 标识客户端请求ID（uuid随机字符串） | 否 | 67ee89ba-7050-4c04-a3d7-ac61a63499b3 |

**X-Api-Resource-Id 可选值：**

- **豆包语音合成模型1.0**：
  - `seed-tts-1.0` 或 `volc.service_type.10029`（字符版）
  - `seed-tts-1.0-concurr` 或 `volc.service_type.10048`（并发版）

- **豆包语音合成模型2.0**（推荐）：
  - `seed-tts-2.0`（字符版）

- **声音复刻**：
  - `seed-icl-1.0`（声音复刻1.0字符版）
  - `seed-icl-1.0-concurr`（声音复刻1.0并发版）
  - `seed-icl-2.0`（声音复刻2.0字符版）

**注意**：不同的资源ID仅适用于对应模型的音色。

#### Response Headers

| Header | 说明 | 示例值 |
|--------|------|--------|
| X-Tt-Logid | 服务端返回的logid，建议获取和打印以便定位问题 | 2025041513355271DF5CF1A0AE0508E78C |

### 请求Body参数

#### 基础参数

| 字段 | 描述 | 类型 | 默认值 | 是否必须 |
|------|------|------|--------|----------|
| user.uid | 用户uid | string | - | 否 |
| namespace | 请求方法 | string | BidirectionalTTS | 否 |
| req_params.text | 输入文本 | string | - | 是 |
| req_params.ssml | SSML格式文本，优先级高于text | string | - | 否 |
| req_params.speaker | 发音人，参见音色列表 | string | - | 是 |
| req_params.model | 模型版本，推荐使用 `seed-tts-1.1` | string | - | 否 |

#### 音频参数 (req_params.audio_params)

| 字段 | 描述 | 类型 | 默认值 |
|------|------|------|--------|
| format | 音频编码格式：mp3/ogg_opus/pcm | string | mp3 |
| sample_rate | 音频采样率：8000/16000/22050/24000/32000/44100/48000 | number | 24000 |
| bit_rate | 音频比特率（仅MP3格式有效） | number | - |
| emotion | 音色情感（部分音色支持） | string | - |
| emotion_scale | 情绪值，范围[1,5] | number | 4 |
| speech_rate | 语速，范围[-50,100] | number | 0 |
| loudness_rate | 音量，范围[-50,100] | number | 0 |
| enable_timestamp | 返回字级别时间戳（仅TTS1.0支持） | bool | false |

**说明**：
- `speech_rate`: 100代表2.0倍速，-50代表0.5倍速
- `loudness_rate`: 100代表2.0倍音量，-50代表0.5倍音量

#### 高级参数 (req_params.additions)

| 字段 | 描述 | 类型 | 默认值 |
|------|------|------|--------|
| silence_duration | 句尾静音时长，范围[0,30000]ms | number | 0 |
| enable_language_detector | 自动识别语种 | bool | false |
| disable_markdown_filter | 是否开启markdown解析过滤 | bool | false |
| disable_emoji_filter | emoji是否不过滤显示 | bool | false |
| mute_cut_remain_ms | 保留的句首静音长度 | string | - |
| enable_latex_tn | 是否播报latex公式 | bool | false |
| max_length_to_filter_parenthesis | 是否过滤括号内部分，0不过滤，100过滤 | int | 100 |
| explicit_language | 明确语种 | string | - |
| context_language | 参考语种 | string | - |
| unsupported_char_ratio_thresh | 不支持语种占比阈值 | float | 0.3 |
| aigc_watermark | 是否增加音频节奏标识 | bool | false |

#### TTS 2.0 专属参数（重要）

| 字段 | 描述 | 类型 | 默认值 |
|------|------|------|--------|
| **context_texts** | 语音合成的辅助信息，用于对话式合成 | string list | null |

**context_texts 使用示例**：

仅适用于"豆包语音合成模型2.0"的音色，该字段文本不参与计费。

- 语速调整：`["你可以说慢一点吗？"]`
- 情绪/语气调整：
  - `["你可以用特别特别痛心的语气说话吗?"]`
  - `["嗯，你的语气再欢乐一点"]`
- 音量调整：`["你嗓门再小点。"]`
- 音感调整：`["你能用骄傲的语气来说话吗？"]`

**注意**：当前字符串列表只第一个值有效。

#### 缓存配置 (req_params.additions.cache_config)

| 字段 | 描述 | 类型 | 默认值 |
|------|------|------|--------|
| text_type | 需要开启缓存时传1 | int | 1 |
| use_cache | 需要开启缓存时传true | bool | true |

开启后，合成相同文本时会直接读取缓存，缓存数据保留时间1小时。

#### 音频后处理 (req_params.additions.post_process)

| 字段 | 描述 | 类型 | 默认值 |
|------|------|------|--------|
| pitch | 音调，范围[-12,12] | int | 0 |

#### AIGC元数据水印 (req_params.additions.aigc_metadata)

| 字段 | 描述 | 类型 | 默认值 |
|------|------|------|--------|
| enable | 是否启用隐式水印 | bool | false |
| content_producer | 合成服务提供者的名称或编码 | string | "" |
| produce_id | 内容制作编号 | string | "" |
| content_propagator | 内容传播服务提供者的名称或编码 | string | "" |
| propagate_id | 内容传播编号 | string | "" |

支持 mp3/wav/ogg_opus 格式。

#### 混音参数 (req_params.mix_speaker)

仅适用于"豆包语音合成模型1.0"的音色。

| 字段 | 描述 | 类型 |
|------|------|------|
| speakers | 混音音色名以及影响因子列表 | list |
| speakers[i].source_speaker | 混音源音色名 | string |
| speakers[i].mix_factor | 混音源音色名影响因子 | float |

**注意事项**：
- 最多支持3个音色混音
- 混音影响因子和必须=1
- 使用复刻音色时，需要使用查询接口获取的`icl_`开头的speakerid
- 使用Mix能力时，`req_params.speaker = custom_mix_bigtts`
- 音色风格差异较大的两个音色以0.5-0.5同等比例混合时，可能出现偶发跳变

### 请求示例

#### 单音色请求

```json
{
    "user": {
        "uid": "12345"
    },
    "req_params": {
        "text": "明朝开国皇帝朱元璋也称这本书为,万物之根",
        "speaker": "zh_female_shuangkuaisisi_moon_bigtts",
        "audio_params": {
            "format": "mp3",
            "sample_rate": 24000
        }
    }
}
```

#### 使用语音指令（TTS 2.0）

```json
{
    "user": {
        "uid": "12345"
    },
    "req_params": {
        "text": "[#用温柔的语气说]你好，很高兴见到你。",
        "speaker": "zh_female_cancan_mars_bigtts",
        "audio_params": {
            "format": "mp3",
            "sample_rate": 24000
        },
        "additions": {
            "context_texts": ["你可以用特别温柔的语气说话吗？"]
        }
    }
}
```

#### 混音请求

```json
{
    "user": {
        "uid": "12345"
    },
    "req_params": {
        "text": "明朝开国皇帝朱元璋也称这本书为万物之根",
        "speaker": "custom_mix_bigtts",
        "audio_params": {
            "format": "mp3",
            "sample_rate": 24000
        },
        "mix_speaker": {
            "speakers": [
                {
                    "source_speaker": "zh_male_bvlazysheep",
                    "mix_factor": 0.3
                },
                {
                    "source_speaker": "BV120_streaming",
                    "mix_factor": 0.3
                },
                {
                    "source_speaker": "zh_male_ahu_conversation_wvae_bigtts",
                    "mix_factor": 0.4
                }
            ]
        }
    }
}
```

### 响应说明

#### 音频响应数据

```json
{
    "code": 0,
    "message": "",
    "data": "{{BASE64_AUDIO_DATA}}"
}
```

其中`data`对应合成音频的base64编码数据。

#### 文本响应数据（含时间戳）

```json
{
    "code": 0,
    "message": "",
    "data": null,
    "sentence": {
        "text": "其他人。",
        "words": [
            {
                "confidence": 0.8531248,
                "endTime": 0.315,
                "startTime": 0.205,
                "word": "其"
            },
            {
                "confidence": 0.9710379,
                "endTime": 0.515,
                "startTime": 0.315,
                "word": "他"
            },
            {
                "confidence": 0.9189944,
                "endTime": 0.815,
                "startTime": 0.515,
                "word": "人。"
            }
        ]
    }
}
```

#### 合成结束响应

```json
{
    "code": 20000000,
    "message": "ok",
    "data": null
}
```

### V3 错误码

| Code | Message | 说明 |
|------|---------|------|
| 20000000 | ok | 音频合成结束的成功状态码 |
| 40402003 | TTSExceededTextLimit:exceed max limit | 提交文本长度超过限制 |
| 45000000 | speaker permission denied: get resource id: access denied | 音色鉴权失败，一般是speaker指定音色未授权或错误 |
| - | quota exceeded for types: concurrency | 并发限流，请求并发数超过限制 |
| 55000000 | 服务端一些error | 服务端通用错误 |

---

## 接口地址

### Websocket

```
wss://openspeech.bytedance.com/api/v3/tts/unidirectional/stream
```

### HTTP

```
https://openspeech.bytedance.com/api/v1/tts
```

---

## 请求参数

### 必需参数

| 字段 | 层级 | 类型 | 说明 |
|------|------|------|------|
| **app** | 1 | dict | 应用相关配置 |
| app.appid | 2 | string | 应用标识（需要申请） |
| app.token | 2 | string | 应用令牌（可传任意非空字符串） |
| app.cluster | 2 | string | 业务集群，固定值：`volcano_tts` |
| **user** | 1 | dict | 用户相关配置 |
| user.uid | 2 | string | 用户标识（可传任意非空字符串） |
| **audio** | 1 | dict | 音频相关配置 |
| audio.voice_type | 2 | string | 音色类型，参见音色列表 |
| **request** | 1 | dict | 请求相关配置 |
| request.reqid | 2 | string | 请求标识（需保证唯一，建议使用UUID） |
| request.text | 2 | string | 合成文本（限制1024字节，建议小于300字符） |
| request.operation | 2 | string | 操作类型：`query`（非流式）/ `submit`（流式） |

### 音频参数

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| audio.encoding | string | pcm | 音频编码格式：`wav`/`pcm`/`ogg_opus`/`mp3` |
| audio.speed_ratio | float | 1.0 | 语速，范围：[0.1, 2.0] |
| audio.rate | int | 24000 | 音频采样率：8000/16000/24000 |
| audio.bitrate | int | 160 | 比特率（单位：kb/s），仅对MP3格式有效 |
| audio.loudness_ratio | float | 1.0 | 音量调节，范围：[0.5, 2.0] |

### 高级参数

| 字段 | 类型 | 说明 |
|------|------|------|
| audio.emotion | string | 音色情感，参见音色列表中的支持情感 |
| audio.enable_emotion | bool | 是否开启音色情感 |
| audio.emotion_scale | float | 情绪值，范围：[1, 5]，默认：4 |
| audio.explicit_language | string | 明确语种：`crosslingual`/`zh-cn`/`en`/`ja`/`es-mx`/`id`/`pt-br`/`de`/`fr` |
| request.text_type | string | 文本类型，使用SSML时设为 `ssml` |
| request.model | string | 模型版本，传 `seed-tts-1.1` 可获得更好音质和延时 |
| request.with_timestamp | int | 传入1时启用时间戳 |
| request.silence_duration | float | 句尾静音时长，范围：[0, 30000]ms |

### Extra参数

通过 `request.extra_param` 传递JSON字符串：

| 参数 | 类型 | 说明 |
|------|------|------|
| disable_markdown_filter | bool | 是否开启markdown解析过滤 |
| enable_latex_tn | bool | 是否播报latex公式 |
| mute_cut_threshold | string | 静音判断阈值 |
| mute_cut_remain_ms | string | 保留的静音长度 |
| disable_emoji_filter | bool | emoji是否不过滤显示 |
| unsupported_char_ratio_thresh | float | 不支持语种占比阈值，默认：0.3 |
| aigc_watermark | bool | 是否在合成结尾增加音频节奏标识 |
| cache_config | dict | 缓存相关参数 |

---

## 响应参数

### HTTP响应

| 字段 | 类型 | 说明 |
|------|------|------|
| reqid | string | 请求ID，与传入的reqid一致 |
| code | int | 请求状态码 |
| message | string | 请求状态信息 |
| sequence | int | 音频段序号，负数表示合成完毕 |
| data | string | 返回的音频数据（base64编码） |
| addition.duration | string | 音频时长（单位：ms） |

### Response Header

| Header | 说明 | 示例 |
|--------|------|------|
| X-Tt-Logid | 服务端返回的logid，建议获取和打印以便定位问题 | 202407261553070FACFE6D19421815D605 |

---

## 错误码说明

| 错误码 | 错误描述 | 举例 | 建议行为 |
|--------|----------|------|----------|
| 3000 | 请求正确 | 正常合成 | 正常处理 |
| 3001 | 无效的请求 | operation配置错误 | 检查参数 |
| 3003 | 并发超限 | 超过在线设置的并发阈值 | 重试；使用SDK的情况下切换离线 |
| 3005 | 后端服务忙 | 后端服务器负载高 | 重试 |
| 3006 | 服务中断 | 相同reqid再次请求 | 检查参数 |
| 3010 | 文本长度超限 | 单次请求超过设置的文本长度阈值 | 检查参数 |
| 3011 | 无效文本 | 文本为空、文本与语种不匹配 | 检查参数 |
| 3030 | 处理超时 | 单次请求超过服务最长时间限制 | 重试或检查文本 |
| 3031 | 处理错误 | 后端出现异常 | 重试 |
| 3032 | 等待获取音频超时 | 后端网络异常 | 重试 |
| 3040 | 后端链路连接错误 | 后端网络异常 | 重试 |
| 3050 | 音色不存在 | 检查使用的voice_type代号 | 检查参数 |

### 常见错误说明

1. **quota exceeded for types: xxxxxxxxx_lifetime**
   - 原因：试用版用量用完
   - 解决：开通正式版

2. **quota exceeded for types: concurrency**
   - 原因：并发超过限定值
   - 解决：减少并发或增购并发

3. **Fail to feed text, reason Init Engine Instance failed**
   - 原因：voice_type 或 cluster 传递错误
   - 解决：检查参数

4. **illegal input text!**
   - 原因：传入的text无效
   - 解决：检查文本内容

5. **authenticate request: load grant: requested grant not found**
   - 原因：鉴权失败
   - 解决：检查appid和token设置

6. **extract request resource id: get resource id: access denied**
   - 原因：未拥有当前音色授权
   - 解决：在控制台购买该音色

---

## 豆包语音合成2.0能力介绍

豆包语音合成2.0提供了三大核心能力，可以让语音合成更加自然、富有情感和表现力。

### 1. 语音指令

#### 功能说明

通过语音指令可以控制：
- 整体情绪（悲伤/生气）
- 方言（四川话/北京话）
- 语气（撒娇/暧昧/吵架/夹子音）
- 语速快慢
- 音调高低

#### 使用方法

在合成文本中使用 `[#指令内容]` 格式来添加语音指令。

#### 示例

##### 吵架语气

```
[#你得跟我互怼！就是跟我用吵架的语气对话]
那你另请高明啊，你找我干嘛！我告诉你，你也不是什么好东西！
```

##### 暧昧/悄悄话

```
[#用asmr的语气来试试撩撩我]
当然可以啦，每次听到你的声音，我都觉得心里暖暖的。
```

##### 复杂情感

```
[#用试探性的犹豫、带点害羞又藏着温柔期待的语气说]
哎，能…… 能一起撑伞不？这雨突然就大了！其实…… 我盼这场雨好久了，总觉得，这样的天气，能离你近一点。
```

```
[#用低沉沙哑的语气、带着沧桑与绝望地说]
高兄，你看这烛火，要灭了…… 我这一生，像追着光跑的蛾，可光太暗，风太猛，到最后，连翅膀都烧没了。
```

##### 效果对比

**无指令：**
```
我逆转时空九十九次救你，你却次次死于同一支暗箭。谢珩，原来不是天要亡你……是你宁死也不肯为我活下去。
```

**有指令：**
```
[#用颤抖沙哑、带着崩溃与绝望的哭腔，夹杂着质问与心碎的语气说]
我逆转时空九十九次救你，你却次次死于同一支暗箭。谢珩，原来不是天要亡你……是你宁死也不肯为我活下去。
```

### 2. 引用上文

#### 功能说明

输入合成文本的上文（只引用不合成），模型会理解并承接语境的情绪进行合成。这比传统TTS只能看到response文本的效果更加自然。

#### 使用方法

在合成文本前添加引用的上文内容，使用 `[#上文内容]` 格式。

#### 示例

##### 思考停顿效果

**无引用：**
```
北京…因为我来，这是第二次，上一次是在一…八年还是什么时候来过一次但是时间很短也没有时间去，真正的去游历，所以北京对我来说…只是…还存在一种想象之中啊，嗯没有太多的，直观的体验。
```

**有引用：**
```
[#你怎么评价北京这个城市？]
北京…因为我来，这是第二次，上一次是在一…八年还是什么时候来过一次但是时间很短也没有时间去，真正的去游历，所以北京对我来说…只是…还存在一种想象之中啊，嗯没有太多的，直观的体验。
```
*模型理解问询的语境，很好的呈现出来思考和停顿的感觉*

##### 老友相见

**示例1：**
```
[#是… 是你吗？怎么看着… 好像没怎么变啊？]
你头发长了… 以前总说留不长，十年了… 你还好吗？
```
*模型理解引用上文的相逢语境，使用激动的语气*

**示例2：**
```
[#挺好的… 就是去年整理旧书，翻到你给我写的毕业留言，还想… 什么时候能再见到你。]
我也带着这个… 你看，当时在操场拍的，你笑起来眼睛都眯成缝了。
```

### 3. 语音标签（抢鲜体验）

#### 功能说明

支持在任意句子前添加细节描述增强效果，如表情/心理/肢体动作等。目前提供抢先体验，后续持续优化改进。

#### 适用音色

- 可爱女生
- 调皮公主
- 爽朗少年
- 天才同桌
- 声音复刻2.0模型复刻后的音色

#### 使用方法

使用 `【描述内容】` 格式在句子前添加标签。

#### 示例

##### 示例1：惊恐旁白
```
【旁白，语调惊恐，强调触摸到尸体般触感的恐怖】可当他的手触碰到对方的身体时，却感觉一阵冰冷僵硬，那触感不像是活人，更像是……尸体。
```

##### 示例2：儿童阴森
```
【小女孩，儿童女性，语调阴森，充满蛊惑，表现小女孩想拉林浩一起的意图】大哥哥，你为什么不理我？ 他们都在陪我，你也一起来吧。
```

##### 示例3：怒吼
```
【怒目圆睁，冲着你大声怒吼】放肆！我是龙族的女王，是这乱世的主宰，岂容你这蝼蚁来评判我！
```

---

## 音色列表

### 豆包语音合成模型2.0 音色

#### 有声阅读

| 音色名称 | voice_type | 语种 | 支持MIX |
|----------|-----------|------|---------|
| 儿童绘本 | zh_female_xueayi_saturn_bigtts | 中文 | 否 |

#### 通用场景

| 音色名称 | voice_type | 语种 | 支持MIX |
|----------|-----------|------|---------|
| vivi | zh_female_vv_uranus_bigtts | 中文、英语 | 否 |

#### 视频配音

| 音色名称 | voice_type | 语种 | 支持MIX |
|----------|-----------|------|---------|
| 大壹 | zh_male_dayi_saturn_bigtts | 中文 | 否 |
| 黑猫侦探社咪仔 | zh_female_mizai_saturn_bigtts | 中文 | 否 |
| 鸡汤女 | zh_female_jitangnv_saturn_bigtts | 中文 | 否 |
| 魅力女友 | zh_female_meilinvyou_saturn_bigtts | 中文 | 否 |
| 流畅女声 | zh_female_santongyongns_saturn_bigtts | 中文 | 否 |
| 儒雅逸辰 | zh_male_ruyayichen_saturn_bigtts | 中文 | 否 |

#### 角色扮演

| 音色名称 | voice_type | 语种 | 支持MIX |
|----------|-----------|------|---------|
| 可爱女生 | saturn_zh_female_keainvsheng_tob | 中文 | 否 |
| 调皮公主 | saturn_zh_female_tiaopigongzhu_tob | 中文 | 否 |
| 爽朗少年 | saturn_zh_male_shuanglangshaonian_tob | 中文 | 否 |
| 天才同桌 | saturn_zh_male_tiancaitongzhuo_tob | 中文 | 否 |
| 知性灿灿 | saturn_zh_female_cancan_tob | 中文 | 否 |

### 豆包语音合成模型1.0 音色

#### 多情感音色（中文）

| 音色名称 | voice_type | 支持的情感 | 支持MIX |
|----------|-----------|-----------|---------|
| 冷酷哥哥 | zh_male_lengkugege_emo_v2_mars_bigtts | 生气、冷漠、恐惧、开心、厌恶、中性、悲伤、沮丧 | 否 |
| 甜心小美 | zh_female_tianxinxiaomei_emo_v2_mars_bigtts | 悲伤、恐惧、厌恶、中性 | 否 |
| 高冷御姐 | zh_female_gaolengyujie_emo_v2_mars_bigtts | 开心、悲伤、生气、惊讶、恐惧、厌恶、激动、冷漠、中性 | 否 |
| 傲娇霸总 | zh_male_aojiaobazong_emo_v2_mars_bigtts | 中性、开心、愤怒、厌恶 | 否 |
| 广州德哥 | zh_male_guangzhoudege_emo_mars_bigtts | 生气、恐惧、中性 | 是 |
| 京腔侃爷 | zh_male_jingqiangkanye_emo_mars_bigtts | 开心、生气、惊讶、厌恶、中性 | 是 |
| 邻居阿姨 | zh_female_linjuayi_emo_v2_mars_bigtts | 中性、愤怒、冷漠、沮丧、惊讶 | 否 |
| 优柔公子 | zh_male_yourougongzi_emo_v2_mars_bigtts | 开心、生气、恐惧、厌恶、激动、中性、沮丧 | 否 |
| 儒雅男友 | zh_male_ruyayichen_emo_v2_mars_bigtts | 开心、悲伤、生气、恐惧、激动、冷漠、中性 | 否 |
| 俊朗男友 | zh_male_junlangnanyou_emo_v2_mars_bigtts | 开心、悲伤、生气、惊讶、恐惧、中性 | 否 |
| 北京小爷 | zh_male_beijingxiaoye_emo_v2_mars_bigtts | 生气、惊讶、恐惧、激动、冷漠、中性 | 否 |
| 柔美女友 | zh_female_roumeinvyou_emo_v2_mars_bigtts | 开心、悲伤、生气、惊讶、恐惧、厌恶、激动、冷漠、中性 | 否 |
| 阳光青年 | zh_male_yangguangqingnian_emo_v2_mars_bigtts | 开心、悲伤、生气、恐惧、激动、冷漠、中性 | 否 |
| 魅力女友 | zh_female_meilinvyou_emo_v2_mars_bigtts | 悲伤、恐惧、中性 | 否 |
| 爽快思思 | zh_female_shuangkuaisisi_emo_v2_mars_bigtts | 开心、悲伤、生气、惊讶、激动、冷漠、中性 | 否 |
| 深夜播客 | zh_male_shenyeboke_emo_v2_mars_bigtts | 惊讶、悲伤、中性、厌恶、开心、恐惧、兴奋、沮丧、冷漠、生气 | 否 |

#### 多情感音色（英文）

| 音色名称 | voice_type | 支持的情感 | 支持MIX |
|----------|-----------|-----------|---------|
| Candice | en_female_candice_emo_v2_mars_bigtts | 深情、愤怒、ASMR、对话/闲聊、兴奋、愉悦、中性、温暖 | 否 |
| Serena | en_female_skye_emo_v2_mars_bigtts | 深情、愤怒、ASMR、对话/闲聊、兴奋、愉悦、中性、悲伤、温暖 | 否 |
| Glen | en_male_glen_emo_v2_mars_bigtts | 深情、愤怒、ASMR、对话/闲聊、兴奋、愉悦、中性、悲伤、温暖 | 否 |
| Sylus | en_male_sylus_emo_v2_mars_bigtts | 深情、愤怒、ASMR、权威、对话/闲聊、兴奋、愉悦、中性、悲伤、温暖 | 否 |
| Corey | en_male_corey_emo_v2_mars_bigtts | 愤怒、ASMR、权威、对话/闲聊、深情、兴奋、愉悦、中性、悲伤、温暖 | 否 |
| Nadia | en_female_nadia_tips_emo_v2_mars_bigtts | 深情、愤怒、ASMR、对话/闲聊、兴奋、愉悦、中性、悲伤、温暖 | 否 |

#### 通用场景音色

| 音色名称 | voice_type | 语种 | 支持MIX |
|----------|-----------|------|---------|
| 温柔女神 | ICL_zh_female_wenrounvshen_239eff5e8ffa_tob | 中文 | 是 |
| Vivi | zh_female_vv_mars_bigtts | 中文 | 是 |
| 亲切女声 | zh_female_qinqienvsheng_moon_bigtts | 中文 | 是 |
| 机灵小伙 | ICL_zh_male_shenmi_v1_tob | 中文 | 是 |
| 元气甜妹 | ICL_zh_female_wuxi_tob | 中文 | 是 |
| 知心姐姐 | ICL_zh_female_wenyinvsheng_v1_tob | 中文 | 是 |
| 阳光阿辰 | zh_male_qingyiyuxuan_mars_bigtts | 中文 | 是 |
| 快乐小东 | zh_male_xudong_conversation_wvae_bigtts | 中文 | 是 |
| 冷酷哥哥 | ICL_zh_male_lengkugege_v1_tob | 中文 | 是 |
| 纯澈女生 | ICL_zh_female_feicui_v1_tob | 中文 | 是 |
| 初恋女友 | ICL_zh_female_yuxin_v1_tob | 中文 | 是 |
| 贴心闺蜜 | ICL_zh_female_xnx_tob | 中文 | 是 |
| 温柔白月光 | ICL_zh_female_yry_tob | 中文 | 是 |
| 炀炀 | ICL_zh_male_BV705_streaming_cs_tob | 中文 | 是 |
| 开朗学长 | en_male_jason_conversation_wvae_bigtts | 中文 | 是 |
| 魅力苏菲 | zh_female_sophie_conversation_wvae_bigtts | 中文 | 是 |
| 贴心妹妹 | ICL_zh_female_yilin_tob | 中文 | 是 |
| 甜美桃子 | zh_female_tianmeitaozi_mars_bigtts | 中文 | 是 |
| 清新女声 | zh_female_qingxinnvsheng_mars_bigtts | 中文 | 是 |
| 知性女声 | zh_female_zhixingnvsheng_mars_bigtts | 中文 | 是 |
| 清爽男大 | zh_male_qingshuangnanda_mars_bigtts | 中文 | 是 |
| 邻家女孩 | zh_female_linjianvhai_moon_bigtts | 中文 | 是 |
| 渊博小叔 | zh_male_yuanboxiaoshu_moon_bigtts | 中文 | 是 |
| 阳光青年 | zh_male_yangguangqingnian_moon_bigtts | 中文 | 是 |
| 甜美小源 | zh_female_tianmeixiaoyuan_moon_bigtts | 中文 | 是 |
| 清澈梓梓 | zh_female_qingchezizi_moon_bigtts | 中文 | 是 |
| 解说小明 | zh_male_jieshuoxiaoming_moon_bigtts | 中文 | 是 |
| 开朗姐姐 | zh_female_kailangjiejie_moon_bigtts | 中文 | 是 |
| 邻家男孩 | zh_male_linjiananhai_moon_bigtts | 中文 | 是 |
| 甜美悦悦 | zh_female_tianmeiyueyue_moon_bigtts | 中文 | 是 |
| 心灵鸡汤 | zh_female_xinlingjitang_moon_bigtts | 中文 | 是 |
| 温柔小哥 | zh_male_wenrouxiaoge_mars_bigtts | 中文 | 是 |
| 灿灿/Shiny | zh_female_cancan_mars_bigtts | 中文、美式英语 | 是 |
| 爽快思思/Skye | zh_female_shuangkuaisisi_moon_bigtts | 中文、美式英语 | 是 |
| 温暖阿虎/Alvin | zh_male_wennuanahu_moon_bigtts | 中文、美式英语 | 是 |
| 少年梓辛/Brayan | zh_male_shaonianzixin_moon_bigtts | 中文、美式英语 | 是 |

#### IP仿音音色

| 音色名称 | voice_type | 语种 | 支持MIX |
|----------|-----------|------|---------|
| 沪普男 | zh_male_hupunan_mars_bigtts | 仅中文 | 是 |
| 鲁班七号 | zh_male_lubanqihao_mars_bigtts | 仅中文 | 是 |
| 林潇 | zh_female_yangmi_mars_bigtts | 仅中文 | 是 |
| 玲玲姐姐 | zh_female_linzhiling_mars_bigtts | 仅中文 | 是 |
| 春日部姐姐 | zh_female_jiyejizi2_mars_bigtts | 仅中文 | 是 |
| 唐僧 | zh_male_tangseng_mars_bigtts | 仅中文 | 是 |
| 庄周 | zh_male_zhuangzhou_mars_bigtts | 仅中文 | 是 |
| 猪八戒 | zh_male_zhubajie_mars_bigtts | 仅中文 | 是 |
| 感冒电音姐姐 | zh_female_ganmaodianyin_mars_bigtts | 仅中文 | 是 |
| 直率英子 | zh_female_naying_mars_bigtts | 仅中文 | 是 |
| 女雷神 | zh_female_leidian_mars_bigtts | 仅中文 | 是 |

#### 趣味口音音色

| 音色名称 | voice_type | 语种/口音 | 支持MIX |
|----------|-----------|----------|---------|
| 粤语小溏 | zh_female_yueyunv_mars_bigtts | 中文 | 是 |
| 豫州子轩 | zh_male_yuzhouzixuan_moon_bigtts | 中文-河南口音 | 是 |
| 呆萌川妹 | zh_female_daimengchuanmei_moon_bigtts | 中文-四川口音 | 是 |
| 广西远舟 | zh_male_guangxiyuanzhou_moon_bigtts | 中文-广西口音 | 是 |
| 双节棍小哥 | zh_male_zhoujielun_emo_v2_mars_bigtts | 中文-台湾口音 | 否 |
| 湾湾小何 | zh_female_wanwanxiaohe_moon_bigtts | 中文-台湾口音 | 是 |
| 湾区大叔 | zh_female_wanqudashu_moon_bigtts | 中文-广东口音 | 是 |
| 广州德哥 | zh_male_guozhoudege_moon_bigtts | 中文-广东口音 | 是 |
| 浩宇小哥 | zh_male_haoyuxiaoge_moon_bigtts | 中文-青岛口音 | 是 |
| 北京小爷 | zh_male_beijingxiaoye_moon_bigtts | 中文-北京口音 | 是 |
| 京腔侃爷/Harmony | zh_male_jingqiangkanye_moon_bigtts | 中文-北京口音、美式英语 | 是 |
| 妹坨洁儿 | zh_female_meituojieer_moon_bigtts | 中文-长沙口音 | 是 |

#### 客服场景音色

| 音色名称 | voice_type | 语种 | 支持MIX |
|----------|-----------|------|---------|
| 理性圆子 | ICL_zh_female_lixingyuanzi_cs_tob | 中文 | 是 |
| 清甜桃桃 | ICL_zh_female_qingtiantaotao_cs_tob | 中文 | 是 |
| 清晰小雪 | ICL_zh_female_qingxixiaoxue_cs_tob | 中文 | 是 |
| 清甜莓莓 | ICL_zh_female_qingtianmeimei_cs_tob | 中文 | 是 |
| 开朗婷婷 | ICL_zh_female_kailangtingting_cs_tob | 中文 | 是 |
| 清新沐沐 | ICL_zh_male_qingxinmumu_cs_tob | 中文 | 是 |
| 爽朗小阳 | ICL_zh_male_shuanglangxiaoyang_cs_tob | 中文 | 是 |
| 清新波波 | ICL_zh_male_qingxinbobo_cs_tob | 中文 | 是 |
| 温婉珊珊 | ICL_zh_female_wenwanshanshan_cs_tob | 中文 | 是 |
| 甜美小雨 | ICL_zh_female_tianmeixiaoyu_cs_tob | 中文 | 是 |
| 热情艾娜 | ICL_zh_female_reqingaina_cs_tob | 中文 | 是 |
| 甜美小橘 | ICL_zh_female_tianmeixiaoju_cs_tob | 中文 | 是 |
| 沉稳明仔 | ICL_zh_male_chenwenmingzai_cs_tob | 中文 | 是 |
| 亲切小卓 | ICL_zh_male_qinqiexiaozhuo_cs_tob | 中文 | 是 |
| 暖阳女声 | zh_female_kefunvsheng_mars_bigtts | 仅中文 | 是 |

#### 多语种音色

| 音色名称 | voice_type | 语种 | 支持MIX |
|----------|-----------|------|---------|
| Lauren | en_female_lauren_moon_bigtts | 美式英语 | 是 |
| Bruce | en_male_bruce_moon_bigtts | 美式英语 | 是 |
| Michael | en_male_michael_moon_bigtts | 美式英语 | 是 |
| Lucas | zh_male_M100_conversation_wvae_bigtts | 美式英语 | 是 |
| Sophie | zh_female_sophie_conversation_wvae_bigtts | 美式英语 | 是 |
| Daisy | en_female_dacey_conversation_wvae_bigtts | 美式英语 | 是 |
| Owen | en_male_charlie_conversation_wvae_bigtts | 美式英语 | 是 |
| Luna | en_female_sarah_new_conversation_wvae_bigtts | 美式英语 | 是 |
| Adam | en_male_adam_mars_bigtts | 美式英语 | 是 |
| Amanda | en_female_amanda_mars_bigtts | 美式英语 | 是 |
| Jackson | en_male_jackson_mars_bigtts | 美式英语 | 是 |
| Emily | en_female_emily_mars_bigtts | 英式英语 | 是 |
| Daniel | zh_male_xudong_conversation_wvae_bigtts | 英式英语 | 是 |
| Smith | en_male_smith_mars_bigtts | 英式英语 | 是 |
| Anna | en_female_anna_mars_bigtts | 英式英语 | 是 |
| Dave | en_male_dave_moon_bigtts | 英式英语 | 是 |
| Sarah | en_female_sarah_mars_bigtts | 澳洲英语 | 是 |
| Dryw | en_male_dryw_mars_bigtts | 澳洲英语 | 是 |

#### 视频配音音色

| 音色名称 | voice_type | 语种 | 支持MIX |
|----------|-----------|------|---------|
| 悠悠君子 | zh_male_M100_conversation_wvae_bigtts | 中文 | 是 |
| 文静毛毛 | zh_female_maomao_conversation_wvae_bigtts | 中文 | 是 |
| 倾心少女 | ICL_zh_female_qiuling_v1_tob | 中文 | 是 |
| 醇厚低音 | ICL_zh_male_buyan_v1_tob | 中文 | 是 |
| 咆哮小哥 | ICL_zh_male_BV144_paoxiaoge_v1_tob | 中文 | 是 |
| 和蔼奶奶 | ICL_zh_female_heainainai_tob | 中文 | 是 |
| 邻居阿姨 | ICL_zh_female_linjuayi_tob | 中文 | 是 |
| 温柔小雅 | zh_female_wenrouxiaoya_moon_bigtts | 中文 | 是 |
| 天才童声 | zh_male_tiancaitongsheng_mars_bigtts | 中文 | 是 |
| 猴哥 | zh_male_sunwukong_mars_bigtts | 中文 | 是 |
| 熊二 | zh_male_xionger_mars_bigtts | 中文 | 是 |
| 佩奇猪 | zh_female_peiqi_mars_bigtts | 中文 | 是 |
| 武则天 | zh_female_wuzetian_mars_bigtts | 中文 | 是 |
| 顾姐 | zh_female_gujie_mars_bigtts | 中文 | 是 |
| 樱桃丸子 | zh_female_yingtaowanzi_mars_bigtts | 中文 | 是 |
| 广告解说 | zh_male_chunhui_mars_bigtts | 中文 | 是 |
| 少儿故事 | zh_female_shaoergushi_mars_bigtts | 中文 | 是 |
| 四郎 | zh_male_silang_mars_bigtts | 中文 | 是 |
| 俏皮女声 | zh_female_qiaopinvsheng_mars_bigtts | 中文 | 是 |
| 懒音绵宝 | zh_male_lanxiaoyang_mars_bigtts | 中文 | 是 |
| 亮嗓萌仔 | zh_male_dongmanhaimian_mars_bigtts | 中文 | 是 |
| 磁性解说男声/Morgan | zh_male_jieshuonansheng_mars_bigtts | 中文、美式英语 | 是 |
| 鸡汤妹妹/Hope | zh_female_jitangmeimei_mars_bigtts | 中文、美式英语 | 是 |
| 贴心女声/Candy | zh_female_tiexinnvsheng_mars_bigtts | 中文、美式英语 | 是 |
| 萌丫头/Cutey | zh_female_mengyatou_mars_bigtts | 中文、美式英语 | 是 |

#### 有声阅读音色

| 音色名称 | voice_type | 语种 | 支持MIX |
|----------|-----------|------|---------|
| 内敛才俊 | ICL_zh_male_neiliancaijun_e991be511569_tob | 中文 | 是 |
| 温暖少年 | ICL_zh_male_yangyang_v1_tob | 中文 | 是 |
| 儒雅公子 | ICL_zh_male_flc_v1_tob | 中文 | 是 |
| 悬疑解说 | zh_male_changtianyi_mars_bigtts | 中文 | 是 |
| 儒雅青年 | zh_male_ruyaqingnian_mars_bigtts | 中文 | 是 |
| 霸气青叔 | zh_male_baqiqingshu_mars_bigtts | 中文 | 是 |
| 擎苍 | zh_male_qingcang_mars_bigtts | 中文 | 是 |
| 活力小哥 | zh_male_yangguangqingnian_mars_bigtts | 中文 | 是 |
| 古风少御 | zh_female_gufengshaoyu_mars_bigtts | 中文 | 是 |
| 温柔淑女 | zh_female_wenroushunv_mars_bigtts | 中文 | 是 |
| 反卷青年 | zh_male_fanjuanqingnian_mars_bigtts | 中文 | 是 |

---

## 调用示例

### Python示例

```python
# 下载示例代码包：volcengine_binary_demo.tar.gz
# 解压并安装依赖
mkdir -p volcengine_binary_demo
tar xvzf volcengine_binary_demo.tar.gz -C ./volcengine_binary_demo
cd volcengine_binary_demo
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
pip3 install -e .

# 发起调用
python3 examples/volcengine/binary.py \
  --appid <appid> \
  --access_token <access_token> \
  --voice_type <voice_type> \
  --text "你好，我是火山引擎的语音合成服务。这是一个美好的旅程。"
```

### HTTP请求示例

```json
{
    "app": {
        "appid": "appid123",
        "token": "access_token",
        "cluster": "volcano_tts"
    },
    "user": {
        "uid": "uid123"
    },
    "audio": {
        "voice_type": "zh_male_M392_conversation_wvae_bigtts",
        "encoding": "mp3",
        "speed_ratio": 1.0
    },
    "request": {
        "reqid": "uuid",
        "text": "字节跳动语音合成",
        "operation": "query"
    }
}
```

### 响应示例

```json
{
    "reqid": "reqid",
    "code": 3000,
    "operation": "query",
    "message": "Success",
    "sequence": -1,
    "data": "base64 encoded binary data",
    "addition": {
        "duration": "1960"
    }
}
```

---

## 注意事项

1. **请求ID（reqid）**：每次合成时需要重新设置，且要保证唯一性（建议使用UUID）

2. **Websocket连接**：
   - 单条链接仅支持单次合成
   - 若需要多次合成，需要多次建立连接
   - operation需要设置为 `submit` 才是流式返回

3. **音频格式**：
   - wav 格式不支持流式
   - MP3格式的音频句首始终会存在100ms内的静音无法消除
   - WAV格式的音频句首静音可全部消除

4. **文本限制**：
   - 长度限制1024字节（UTF-8编码）
   - 建议小于300字符
   - 超出容易增加badcase出现概率或报错

5. **模型版本**：
   - 传 `seed-tts-1.1` 较默认版本音质有提升，延时更优
   - 在复刻场景中会放大训练音频prompt特质，需要使用高质量的训练音频

6. **时间戳**：
   - 返回的是TN后文本的时间戳
   - 大模型在对传入文本语义理解后合成音频，再针对合成音频进行TN后打轴

7. **缓存功能**：
   - 开启缓存后，合成相同文本时会直接读取缓存
   - 可明显加快相同文本的合成速率
   - 缓存数据保留时间1小时
   - 通过缓存返回的数据不会附带时间戳

8. **语种支持**：
   - 中文音色可支持中英文混合场景
   - 大模型音色语种支持中英混
   - 多语种音色需要使用 `language` 参数指定对应的语种

---

## 最佳实践

1. **推荐配置**：
   - 使用V3接口（时延更优）
   - 使用 `seed-tts-1.1` 模型（音质更好）
   - 采样率设置为24000（平衡质量和文件大小）

2. **性能优化**：
   - 控制文本长度在300字符以内
   - 合理设置并发数
   - 使用缓存功能减少重复合成

3. **错误处理**：
   - 记录并打印 X-Tt-Logid 方便定位问题
   - 根据错误码进行相应的重试策略
   - 检查鉴权信息和音色授权

4. **音质提升**：
   - 使用高质量的训练音频（复刻场景）
   - 选择合适的音色和情感
   - 调整语速、音量等参数

---

## 在线体验

官网体验中心：https://www.volcengine.com/product/tts

---

*最后更新：2025.11.12*
