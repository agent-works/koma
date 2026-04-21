import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DOUBAO_TTS_VOICES, getVoiceCatalog, buildTTSHelp } from '../src/commands/tts.js';
import { VolcengineTTSProvider } from '../src/providers/volcengine-tts.js';

describe('voice catalog', () => {
  it('contains doubao-tts voices organized in categories', () => {
    assert.ok(DOUBAO_TTS_VOICES.length > 0, 'should have categories');
    const totalVoices = DOUBAO_TTS_VOICES.reduce((sum, c) => sum + c.voices.length, 0);
    assert.ok(totalVoices >= 140, 'should have at least 140 voices');
  });

  it('every voice has voiceId, name, language', () => {
    for (const cat of DOUBAO_TTS_VOICES) {
      for (const v of cat.voices) {
        assert.ok(v.voiceId, `category ${cat.title}: voice missing voiceId`);
        assert.ok(v.name, `voice ${v.voiceId}: missing name`);
        assert.ok(v.language, `voice ${v.voiceId}: missing language`);
      }
    }
  });

  it('getVoiceCatalog returns voices for doubao-tts', () => {
    const cats = getVoiceCatalog('doubao-tts');
    assert.ok(cats);
    assert.ok(cats.length > 0);
  });

  it('getVoiceCatalog returns null for unknown model', () => {
    const cats = getVoiceCatalog('unknown-model');
    assert.equal(cats, null);
  });

  it('buildTTSHelp includes voices when model is doubao-tts', () => {
    const help = buildTTSHelp('doubao-tts');
    assert.ok(help.includes('zh_female_shuangkuaisisi_moon_bigtts'));
    assert.ok(help.includes('傲娇霸总'));
  });

  it('buildTTSHelp shows placeholder when model is unknown', () => {
    const help = buildTTSHelp('unknown-model');
    assert.ok(help.includes('No voice catalog available'));
  });

  it('buildTTSHelp without -m shows general help', () => {
    const help = buildTTSHelp();
    assert.ok(help.includes('Usage: koma tts'));
  });
});

describe('VolcengineTTSProvider.buildRequestBody', () => {
  const config: any = {
    type: 'volcengine-tts',
    appid: 'test-appid',
    key: 'test-token',
    cluster: 'volcano_tts',
    models: ['doubao-tts'],
  };

  it('maps speed/volume/pitch to *_ratio fields', () => {
    const provider = new VolcengineTTSProvider(config);
    const body = provider.buildRequestBody(
      {
        model: 'doubao-tts',
        text: '你好',
        voice: 'zh_female_shuangkuaisisi_moon_bigtts',
        speed: 1.2,
        volume: 0.9,
        pitch: 1.1,
      },
      'mp3'
    );

    assert.equal(body.audio.voice_type, 'zh_female_shuangkuaisisi_moon_bigtts');
    assert.equal(body.audio.speed_ratio, 1.2);
    assert.equal(body.audio.volume_ratio, 0.9);
    assert.equal(body.audio.pitch_ratio, 1.1);
  });

  it('sets app block with appid, token, cluster', () => {
    const provider = new VolcengineTTSProvider(config);
    const body = provider.buildRequestBody(
      { model: 'doubao-tts', text: '你好', voice: 'some_voice' },
      'mp3'
    );
    assert.equal(body.app.appid, 'test-appid');
    assert.equal(body.app.token, 'test-token');
    assert.equal(body.app.cluster, 'volcano_tts');
  });

  it('sets request.operation to query and text_type to plain', () => {
    const provider = new VolcengineTTSProvider(config);
    const body = provider.buildRequestBody(
      { model: 'doubao-tts', text: 'test', voice: 'v' },
      'mp3'
    );
    assert.equal(body.request.operation, 'query');
    assert.equal(body.request.text_type, 'plain');
    assert.equal(body.request.text, 'test');
  });

  it('uses 24000 as default sample rate', () => {
    const provider = new VolcengineTTSProvider(config);
    const body = provider.buildRequestBody(
      { model: 'doubao-tts', text: 'test', voice: 'v' },
      'mp3'
    );
    assert.equal(body.audio.rate, 24000);
  });

  it('respects custom sample rate', () => {
    const provider = new VolcengineTTSProvider(config);
    const body = provider.buildRequestBody(
      { model: 'doubao-tts', text: 'test', voice: 'v', sampleRate: 16000 },
      'mp3'
    );
    assert.equal(body.audio.rate, 16000);
  });

  it('includes emotion when provided', () => {
    const provider = new VolcengineTTSProvider(config);
    const body = provider.buildRequestBody(
      { model: 'doubao-tts', text: 'test', voice: 'v', emotion: '开心' },
      'mp3'
    );
    assert.equal(body.audio.emotion, '开心');
  });

  it('omits speed/volume/pitch when not provided', () => {
    const provider = new VolcengineTTSProvider(config);
    const body = provider.buildRequestBody(
      { model: 'doubao-tts', text: 'test', voice: 'v' },
      'mp3'
    );
    assert.equal(body.audio.speed_ratio, undefined);
    assert.equal(body.audio.volume_ratio, undefined);
    assert.equal(body.audio.pitch_ratio, undefined);
  });

  it('throws without appid', () => {
    assert.throws(
      () => new VolcengineTTSProvider({ ...config, appid: undefined }),
      /requires "appid"/
    );
  });

  it('throws without key', () => {
    assert.throws(
      () => new VolcengineTTSProvider({ ...config, key: undefined }),
      /requires "key"/
    );
  });
});
