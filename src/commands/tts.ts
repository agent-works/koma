import fs from 'fs';
import path from 'path';
import { TTSRequest } from '../types.js';
import { loadConfig, resolveProviders } from '../config.js';
import { callWithFailover } from '../failover.js';

// ── Voice catalog types ─────────────────────────────────────────────

export interface VoiceInfo {
  voiceId: string;
  name: string;
  language: string;
  emotions?: string;
  supportsMix?: boolean;
}

export interface VoiceCategory {
  title: string;
  voices: VoiceInfo[];
}

// ── Doubao TTS voice catalog (170+ voices) ─────────────────────────
// Source: docs/volcengine-tts-full-reference.md

export const DOUBAO_TTS_VOICES: VoiceCategory[] = [
  {
    title: '多情感音色（中文） — 支持 --emotion',
    voices: [
      { voiceId: 'zh_male_lengkugege_emo_v2_mars_bigtts', name: '冷酷哥哥', language: '中文', emotions: '生气、冷漠、恐惧、开心、厌恶、中性、悲伤、沮丧' },
      { voiceId: 'zh_female_tianxinxiaomei_emo_v2_mars_bigtts', name: '甜心小美', language: '中文', emotions: '悲伤、恐惧、厌恶、中性' },
      { voiceId: 'zh_female_gaolengyujie_emo_v2_mars_bigtts', name: '高冷御姐', language: '中文', emotions: '开心、悲伤、生气、惊讶、恐惧、厌恶、激动、冷漠、中性' },
      { voiceId: 'zh_male_aojiaobazong_emo_v2_mars_bigtts', name: '傲娇霸总', language: '中文', emotions: '中性、开心、愤怒、厌恶' },
      { voiceId: 'zh_male_guangzhoudege_emo_mars_bigtts', name: '广州德哥', language: '中文', emotions: '生气、恐惧、中性', supportsMix: true },
      { voiceId: 'zh_male_jingqiangkanye_emo_mars_bigtts', name: '京腔侃爷', language: '中文', emotions: '开心、生气、惊讶、厌恶、中性', supportsMix: true },
      { voiceId: 'zh_female_linjuayi_emo_v2_mars_bigtts', name: '邻居阿姨', language: '中文', emotions: '中性、愤怒、冷漠、沮丧、惊讶' },
      { voiceId: 'zh_male_yourougongzi_emo_v2_mars_bigtts', name: '优柔公子', language: '中文', emotions: '开心、生气、恐惧、厌恶、激动、中性、沮丧' },
      { voiceId: 'zh_male_ruyayichen_emo_v2_mars_bigtts', name: '儒雅男友', language: '中文', emotions: '开心、悲伤、生气、恐惧、激动、冷漠、中性' },
      { voiceId: 'zh_male_junlangnanyou_emo_v2_mars_bigtts', name: '俊朗男友', language: '中文', emotions: '开心、悲伤、生气、惊讶、恐惧、中性' },
      { voiceId: 'zh_male_beijingxiaoye_emo_v2_mars_bigtts', name: '北京小爷', language: '中文', emotions: '生气、惊讶、恐惧、激动、冷漠、中性' },
      { voiceId: 'zh_female_roumeinvyou_emo_v2_mars_bigtts', name: '柔美女友', language: '中文', emotions: '开心、悲伤、生气、惊讶、恐惧、厌恶、激动、冷漠、中性' },
      { voiceId: 'zh_male_yangguangqingnian_emo_v2_mars_bigtts', name: '阳光青年', language: '中文', emotions: '开心、悲伤、生气、恐惧、激动、冷漠、中性' },
      { voiceId: 'zh_female_meilinvyou_emo_v2_mars_bigtts', name: '魅力女友', language: '中文', emotions: '悲伤、恐惧、中性' },
      { voiceId: 'zh_female_shuangkuaisisi_emo_v2_mars_bigtts', name: '爽快思思', language: '中文', emotions: '开心、悲伤、生气、惊讶、激动、冷漠、中性' },
      { voiceId: 'zh_male_shenyeboke_emo_v2_mars_bigtts', name: '深夜播客', language: '中文', emotions: '惊讶、悲伤、中性、厌恶、开心、恐惧、兴奋、沮丧、冷漠、生气' },
    ],
  },
  {
    title: '多情感音色（英文） — 支持 --emotion',
    voices: [
      { voiceId: 'en_female_candice_emo_v2_mars_bigtts', name: 'Candice', language: 'English', emotions: '深情、愤怒、ASMR、对话/闲聊、兴奋、愉悦、中性、温暖' },
      { voiceId: 'en_female_skye_emo_v2_mars_bigtts', name: 'Serena', language: 'English', emotions: '深情、愤怒、ASMR、对话/闲聊、兴奋、愉悦、中性、悲伤、温暖' },
      { voiceId: 'en_male_glen_emo_v2_mars_bigtts', name: 'Glen', language: 'English', emotions: '深情、愤怒、ASMR、对话/闲聊、兴奋、愉悦、中性、悲伤、温暖' },
      { voiceId: 'en_male_sylus_emo_v2_mars_bigtts', name: 'Sylus', language: 'English', emotions: '深情、愤怒、ASMR、权威、对话/闲聊、兴奋、愉悦、中性、悲伤、温暖' },
      { voiceId: 'en_male_corey_emo_v2_mars_bigtts', name: 'Corey', language: 'English', emotions: '愤怒、ASMR、权威、对话/闲聊、深情、兴奋、愉悦、中性、悲伤、温暖' },
      { voiceId: 'en_female_nadia_tips_emo_v2_mars_bigtts', name: 'Nadia', language: 'English', emotions: '深情、愤怒、ASMR、对话/闲聊、兴奋、愉悦、中性、悲伤、温暖' },
    ],
  },
  {
    title: '通用场景音色',
    voices: [
      { voiceId: 'ICL_zh_female_wenrounvshen_239eff5e8ffa_tob', name: '温柔女神', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_vv_mars_bigtts', name: 'Vivi', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_qinqienvsheng_moon_bigtts', name: '亲切女声', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_male_shenmi_v1_tob', name: '机灵小伙', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_wuxi_tob', name: '元气甜妹', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_wenyinvsheng_v1_tob', name: '知心姐姐', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_qingyiyuxuan_mars_bigtts', name: '阳光阿辰', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_xudong_conversation_wvae_bigtts', name: '快乐小东', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_male_lengkugege_v1_tob', name: '冷酷哥哥', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_feicui_v1_tob', name: '纯澈女生', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_yuxin_v1_tob', name: '初恋女友', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_xnx_tob', name: '贴心闺蜜', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_yry_tob', name: '温柔白月光', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_male_BV705_streaming_cs_tob', name: '炀炀', language: '中文', supportsMix: true },
      { voiceId: 'en_male_jason_conversation_wvae_bigtts', name: '开朗学长', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_sophie_conversation_wvae_bigtts', name: '魅力苏菲', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_yilin_tob', name: '贴心妹妹', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_tianmeitaozi_mars_bigtts', name: '甜美桃子', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_qingxinnvsheng_mars_bigtts', name: '清新女声', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_zhixingnvsheng_mars_bigtts', name: '知性女声', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_qingshuangnanda_mars_bigtts', name: '清爽男大', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_linjianvhai_moon_bigtts', name: '邻家女孩', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_yuanboxiaoshu_moon_bigtts', name: '渊博小叔', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_yangguangqingnian_moon_bigtts', name: '阳光青年', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_tianmeixiaoyuan_moon_bigtts', name: '甜美小源', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_qingchezizi_moon_bigtts', name: '清澈梓梓', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_jieshuoxiaoming_moon_bigtts', name: '解说小明', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_kailangjiejie_moon_bigtts', name: '开朗姐姐', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_linjiananhai_moon_bigtts', name: '邻家男孩', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_tianmeiyueyue_moon_bigtts', name: '甜美悦悦', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_xinlingjitang_moon_bigtts', name: '心灵鸡汤', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_wenrouxiaoge_mars_bigtts', name: '温柔小哥', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_cancan_mars_bigtts', name: '灿灿/Shiny', language: '中文、美式英语', supportsMix: true },
      { voiceId: 'zh_female_shuangkuaisisi_moon_bigtts', name: '爽快思思/Skye', language: '中文、美式英语', supportsMix: true },
      { voiceId: 'zh_male_wennuanahu_moon_bigtts', name: '温暖阿虎/Alvin', language: '中文、美式英语', supportsMix: true },
      { voiceId: 'zh_male_shaonianzixin_moon_bigtts', name: '少年梓辛/Brayan', language: '中文、美式英语', supportsMix: true },
    ],
  },
  {
    title: 'IP 仿音音色',
    voices: [
      { voiceId: 'zh_male_hupunan_mars_bigtts', name: '沪普男', language: '仅中文', supportsMix: true },
      { voiceId: 'zh_male_lubanqihao_mars_bigtts', name: '鲁班七号', language: '仅中文', supportsMix: true },
      { voiceId: 'zh_female_yangmi_mars_bigtts', name: '林潇', language: '仅中文', supportsMix: true },
      { voiceId: 'zh_female_linzhiling_mars_bigtts', name: '玲玲姐姐', language: '仅中文', supportsMix: true },
      { voiceId: 'zh_female_jiyejizi2_mars_bigtts', name: '春日部姐姐', language: '仅中文', supportsMix: true },
      { voiceId: 'zh_male_tangseng_mars_bigtts', name: '唐僧', language: '仅中文', supportsMix: true },
      { voiceId: 'zh_male_zhuangzhou_mars_bigtts', name: '庄周', language: '仅中文', supportsMix: true },
      { voiceId: 'zh_male_zhubajie_mars_bigtts', name: '猪八戒', language: '仅中文', supportsMix: true },
      { voiceId: 'zh_female_ganmaodianyin_mars_bigtts', name: '感冒电音姐姐', language: '仅中文', supportsMix: true },
      { voiceId: 'zh_female_naying_mars_bigtts', name: '直率英子', language: '仅中文', supportsMix: true },
      { voiceId: 'zh_female_leidian_mars_bigtts', name: '女雷神', language: '仅中文', supportsMix: true },
    ],
  },
  {
    title: '趣味口音音色',
    voices: [
      { voiceId: 'zh_female_yueyunv_mars_bigtts', name: '粤语小溏', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_yuzhouzixuan_moon_bigtts', name: '豫州子轩', language: '中文-河南口音', supportsMix: true },
      { voiceId: 'zh_female_daimengchuanmei_moon_bigtts', name: '呆萌川妹', language: '中文-四川口音', supportsMix: true },
      { voiceId: 'zh_male_guangxiyuanzhou_moon_bigtts', name: '广西远舟', language: '中文-广西口音', supportsMix: true },
      { voiceId: 'zh_male_zhoujielun_emo_v2_mars_bigtts', name: '双节棍小哥', language: '中文-台湾口音' },
      { voiceId: 'zh_female_wanwanxiaohe_moon_bigtts', name: '湾湾小何', language: '中文-台湾口音', supportsMix: true },
      { voiceId: 'zh_female_wanqudashu_moon_bigtts', name: '湾区大叔', language: '中文-广东口音', supportsMix: true },
      { voiceId: 'zh_male_guozhoudege_moon_bigtts', name: '广州德哥', language: '中文-广东口音', supportsMix: true },
      { voiceId: 'zh_male_haoyuxiaoge_moon_bigtts', name: '浩宇小哥', language: '中文-青岛口音', supportsMix: true },
      { voiceId: 'zh_male_beijingxiaoye_moon_bigtts', name: '北京小爷', language: '中文-北京口音', supportsMix: true },
      { voiceId: 'zh_male_jingqiangkanye_moon_bigtts', name: '京腔侃爷/Harmony', language: '中文-北京口音、美式英语', supportsMix: true },
      { voiceId: 'zh_female_meituojieer_moon_bigtts', name: '妹坨洁儿', language: '中文-长沙口音', supportsMix: true },
    ],
  },
  {
    title: '客服场景音色',
    voices: [
      { voiceId: 'ICL_zh_female_lixingyuanzi_cs_tob', name: '理性圆子', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_qingtiantaotao_cs_tob', name: '清甜桃桃', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_qingxixiaoxue_cs_tob', name: '清晰小雪', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_qingtianmeimei_cs_tob', name: '清甜莓莓', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_kailangtingting_cs_tob', name: '开朗婷婷', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_male_qingxinmumu_cs_tob', name: '清新沐沐', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_male_shuanglangxiaoyang_cs_tob', name: '爽朗小阳', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_male_qingxinbobo_cs_tob', name: '清新波波', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_wenwanshanshan_cs_tob', name: '温婉珊珊', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_tianmeixiaoyu_cs_tob', name: '甜美小雨', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_reqingaina_cs_tob', name: '热情艾娜', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_tianmeixiaoju_cs_tob', name: '甜美小橘', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_male_chenwenmingzai_cs_tob', name: '沉稳明仔', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_male_qinqiexiaozhuo_cs_tob', name: '亲切小卓', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_kefunvsheng_mars_bigtts', name: '暖阳女声', language: '仅中文', supportsMix: true },
    ],
  },
  {
    title: '多语种音色',
    voices: [
      { voiceId: 'en_female_lauren_moon_bigtts', name: 'Lauren', language: '美式英语', supportsMix: true },
      { voiceId: 'en_male_bruce_moon_bigtts', name: 'Bruce', language: '美式英语', supportsMix: true },
      { voiceId: 'en_male_michael_moon_bigtts', name: 'Michael', language: '美式英语', supportsMix: true },
      { voiceId: 'zh_male_M100_conversation_wvae_bigtts', name: 'Lucas', language: '美式英语', supportsMix: true },
      { voiceId: 'zh_female_sophie_conversation_wvae_bigtts', name: 'Sophie', language: '美式英语', supportsMix: true },
      { voiceId: 'en_female_dacey_conversation_wvae_bigtts', name: 'Daisy', language: '美式英语', supportsMix: true },
      { voiceId: 'en_male_charlie_conversation_wvae_bigtts', name: 'Owen', language: '美式英语', supportsMix: true },
      { voiceId: 'en_female_sarah_new_conversation_wvae_bigtts', name: 'Luna', language: '美式英语', supportsMix: true },
      { voiceId: 'en_male_adam_mars_bigtts', name: 'Adam', language: '美式英语', supportsMix: true },
      { voiceId: 'en_female_amanda_mars_bigtts', name: 'Amanda', language: '美式英语', supportsMix: true },
      { voiceId: 'en_male_jackson_mars_bigtts', name: 'Jackson', language: '美式英语', supportsMix: true },
      { voiceId: 'en_female_emily_mars_bigtts', name: 'Emily', language: '英式英语', supportsMix: true },
      { voiceId: 'en_male_smith_mars_bigtts', name: 'Smith', language: '英式英语', supportsMix: true },
      { voiceId: 'en_female_anna_mars_bigtts', name: 'Anna', language: '英式英语', supportsMix: true },
      { voiceId: 'en_male_dave_moon_bigtts', name: 'Dave', language: '英式英语', supportsMix: true },
      { voiceId: 'en_female_sarah_mars_bigtts', name: 'Sarah', language: '澳洲英语', supportsMix: true },
      { voiceId: 'en_male_dryw_mars_bigtts', name: 'Dryw', language: '澳洲英语', supportsMix: true },
    ],
  },
  {
    title: '视频配音音色',
    voices: [
      { voiceId: 'zh_female_maomao_conversation_wvae_bigtts', name: '文静毛毛', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_qiuling_v1_tob', name: '倾心少女', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_male_buyan_v1_tob', name: '醇厚低音', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_male_BV144_paoxiaoge_v1_tob', name: '咆哮小哥', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_heainainai_tob', name: '和蔼奶奶', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_female_linjuayi_tob', name: '邻居阿姨', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_wenrouxiaoya_moon_bigtts', name: '温柔小雅', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_tiancaitongsheng_mars_bigtts', name: '天才童声', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_sunwukong_mars_bigtts', name: '猴哥', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_xionger_mars_bigtts', name: '熊二', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_peiqi_mars_bigtts', name: '佩奇猪', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_wuzetian_mars_bigtts', name: '武则天', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_gujie_mars_bigtts', name: '顾姐', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_yingtaowanzi_mars_bigtts', name: '樱桃丸子', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_chunhui_mars_bigtts', name: '广告解说', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_shaoergushi_mars_bigtts', name: '少儿故事', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_silang_mars_bigtts', name: '四郎', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_qiaopinvsheng_mars_bigtts', name: '俏皮女声', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_lanxiaoyang_mars_bigtts', name: '懒音绵宝', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_dongmanhaimian_mars_bigtts', name: '亮嗓萌仔', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_jieshuonansheng_mars_bigtts', name: '磁性解说男声/Morgan', language: '中文、美式英语', supportsMix: true },
      { voiceId: 'zh_female_jitangmeimei_mars_bigtts', name: '鸡汤妹妹/Hope', language: '中文、美式英语', supportsMix: true },
      { voiceId: 'zh_female_tiexinnvsheng_mars_bigtts', name: '贴心女声/Candy', language: '中文、美式英语', supportsMix: true },
      { voiceId: 'zh_female_mengyatou_mars_bigtts', name: '萌丫头/Cutey', language: '中文、美式英语', supportsMix: true },
    ],
  },
  {
    title: '有声阅读音色',
    voices: [
      { voiceId: 'ICL_zh_male_neiliancaijun_e991be511569_tob', name: '内敛才俊', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_male_yangyang_v1_tob', name: '温暖少年', language: '中文', supportsMix: true },
      { voiceId: 'ICL_zh_male_flc_v1_tob', name: '儒雅公子', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_changtianyi_mars_bigtts', name: '悬疑解说', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_ruyaqingnian_mars_bigtts', name: '儒雅青年', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_baqiqingshu_mars_bigtts', name: '霸气青叔', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_qingcang_mars_bigtts', name: '擎苍', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_yangguangqingnian_mars_bigtts', name: '活力小哥', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_gufengshaoyu_mars_bigtts', name: '古风少御', language: '中文', supportsMix: true },
      { voiceId: 'zh_female_wenroushunv_mars_bigtts', name: '温柔淑女', language: '中文', supportsMix: true },
      { voiceId: 'zh_male_fanjuanqingnian_mars_bigtts', name: '反卷青年', language: '中文', supportsMix: true },
    ],
  },
];

const MODEL_VOICES: Record<string, VoiceCategory[]> = {
  'doubao-tts': DOUBAO_TTS_VOICES,
};

export function getVoiceCatalog(model: string): VoiceCategory[] | null {
  return MODEL_VOICES[model] || null;
}

// ── Help builder ─────────────────────────────────────────────────────

export function buildTTSHelp(model?: string): string {
  const header = `
Usage: koma tts [options] <text>

Generate speech audio from text using a TTS model.

Input:
  <text>                     Text to synthesize (positional, max 1024 UTF-8 bytes)
  --input <file>             Read text from file

Output:
  -o, --output <file>        Output file (default: tts-<timestamp>.mp3)

Voice:
  -m, --model <name>         TTS model (default: doubao-tts)
  --voice <id>               Voice ID (see list below)

Tuning:
  --speed <n>                Speech rate 0.2-3.0 (default 1.0)
  --volume <n>               Volume 0.1-3.0 (default 1.0)
  --pitch <n>                Pitch 0.1-3.0 (default 1.0)
  --emotion <name>           Emotion (only supported by *_emo_* voices)

Audio format:
  --format <fmt>             mp3 (default), wav, pcm, ogg_opus
  --sample-rate <hz>         8000, 16000, 24000 (default 24000)

Examples:

  # Minimal — specify voice
  koma tts "你好世界" --voice zh_female_shuangkuaisisi_moon_bigtts -o hello.mp3

  # Adjust speed and pitch with emotion
  koma tts "欢迎光临" --voice zh_male_aojiaobazong_emo_v2_mars_bigtts --speed 1.2 --pitch 1.1 --emotion 开心

  # English voice
  koma tts "Welcome to Koma." --voice en_female_sarah_new_conversation_wvae_bigtts -o welcome.mp3

  # Read text from file
  koma tts --input script.txt --voice zh_female_shuangkuaisisi_moon_bigtts -o audio.mp3

  # List voices for a specific model
  koma tts --help -m doubao-tts
`.trim();

  const catalog = model ? getVoiceCatalog(model) : getVoiceCatalog('doubao-tts');

  if (model && !catalog) {
    return `${header}

No voice catalog available for model "${model}".
Run "koma models" to see all configured models.`;
  }

  if (!catalog) {
    return header;
  }

  const modelLabel = model || 'doubao-tts';
  const sections: string[] = [`\nVoices for ${modelLabel}:\n`];

  for (const cat of catalog) {
    sections.push(`━━ ${cat.title} ━━`);
    for (const v of cat.voices) {
      const extra = v.emotions ? `  情感: ${v.emotions}` : '';
      sections.push(`  ${v.voiceId}`);
      sections.push(`    ${v.name} — ${v.language}${extra}`);
    }
    sections.push('');
  }

  const totalVoices = catalog.reduce((sum, c) => sum + c.voices.length, 0);
  sections.push(`(${totalVoices} voices total across ${catalog.length} categories)`);

  return header + '\n' + sections.join('\n');
}

// ── Command options ─────────────────────────────────────────────────

export interface TTSCommandOptions {
  model?: string;
  voice?: string;
  speed?: number;
  volume?: number;
  pitch?: number;
  emotion?: string;
  format?: 'mp3' | 'wav' | 'pcm' | 'ogg_opus';
  sampleRate?: number;
  input?: string;
  output?: string;
  json?: boolean;
}

// ── Command handler ─────────────────────────────────────────────────

export async function handleTTSCommand(
  text: string | undefined,
  options: TTSCommandOptions
): Promise<void> {
  try {
    const config = loadConfig();

    const model = options.model || config.defaults.tts;
    if (!model) {
      throw new Error('No model specified and no default tts model configured');
    }

    let finalText: string;
    if (options.input) {
      finalText = fs.readFileSync(options.input, 'utf-8').trim();
    } else if (text) {
      finalText = text;
    } else {
      throw new Error('No text provided (use positional argument or --input flag)');
    }

    const outputPath =
      options.output || path.join(process.cwd(), `tts-${Date.now()}.${options.format || 'mp3'}`);

    const providers = resolveProviders(model);

    const request: TTSRequest = {
      model,
      text: finalText,
      voice: options.voice,
      speed: options.speed,
      volume: options.volume,
      pitch: options.pitch,
      emotion: options.emotion,
      format: options.format,
      sampleRate: options.sampleRate,
      outputPath,
    };

    const response = await callWithFailover(providers, (provider, providerName) => {
      if (!provider.generateTTS) {
        throw new Error(`Provider "${providerName}" does not support TTS.`);
      }
      return provider.generateTTS(request);
    });

    if (options.json !== false) {
      console.log(JSON.stringify(response, null, 2));
    } else {
      console.log(`Audio saved to: ${response.filePath}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ error: message }, null, 2));
    process.exit(1);
  }
}
