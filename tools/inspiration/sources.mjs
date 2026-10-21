/**
 * 信源注册表（参考 AIHOT 的 sources 配置结构）
 *
 * 信源 = 一份声明式配置，采集器按 type 分派：
 *   rss       RSS / Atom，产出 {title,url,desc,date,src}
 *   web_list  列表页按正则抽链接（无 DOM 依赖），pattern 捕获组：1=链接 2=标题
 *   bilibili  B站 UP 主最新投稿（wbi 签名直连官方接口）
 *
 * 通用字段：name / platform / type / maxItems / priority / timeoutMs / allPass
 *   allPass = true 表示账号或查询本身已限定主题，不再走赛道关键词过滤
 *   priority 仅用于同分同日期时的排序权重（越大越靠前）
 *
 * 新增信源只需在这里加一条配置，再挂到对应赛道的 sources 数组。
 */

export const DEFAULTS = {
  timeoutMs: 20000,
  maxItems: 30,
  concurrency: 6
};

const GNEWS = 'https://news.google.com/rss/search?q={q}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans';

export const SOURCES = {
  /* ---------- 科技 / 综合资讯 ---------- */
  ithome: {
    name: 'IT之家', platform: 'IT之家', type: 'rss',
    url: 'https://www.ithome.com/rss/', maxItems: 60, priority: 3.0, timeoutMs: 20000
  },
  qbitai: {
    name: '量子位', platform: '量子位', type: 'rss',
    url: 'https://www.qbitai.com/feed', maxItems: 30, priority: 3.0, timeoutMs: 20000
  },
  leiphone: {
    name: '雷锋网', platform: '雷锋网', type: 'rss',
    url: 'https://www.leiphone.com/feed', maxItems: 30, priority: 2.8, timeoutMs: 25000
  },
  gnews_ai: {
    name: 'AI发布会', platform: '媒体报道', type: 'rss', allPass: true,
    urlTemplate: GNEWS, query: 'AI 发布会 OR 大模型 发布',
    maxItems: 12, priority: 3.2
  },
  gnews_agent: {
    name: 'AI智能体', platform: '媒体报道', type: 'rss', allPass: true,
    urlTemplate: GNEWS, query: '"AI Agent" OR 个人智能体 OR 智能助手',
    maxItems: 15, priority: 3.3
  },
  infoq: {
    name: 'InfoQ中文', platform: 'InfoQ', type: 'rss',
    url: 'https://www.infoq.cn/feed', maxItems: 30, priority: 3.1, timeoutMs: 20000
  },
  ifanr: {
    name: '爱范儿', platform: '爱范儿', type: 'rss',
    url: 'https://www.ifanr.com/feed', maxItems: 30, priority: 3.0, timeoutMs: 20000
  },
  geekpark: {
    name: '极客公园', platform: '极客公园', type: 'rss',
    url: 'https://www.geekpark.net/rss', maxItems: 30, priority: 2.9, timeoutMs: 20000
  },

  /* ---------- 中新网 ---------- */
  chinanews_scroll: {
    name: '中新网·滚动', platform: '中新网', type: 'rss',
    url: 'https://www.chinanews.com.cn/rss/scroll-news.xml', maxItems: 40, priority: 2.6
  },
  chinanews_finance: {
    name: '中新网·财经', platform: '中新网', type: 'rss',
    url: 'https://www.chinanews.com.cn/rss/finance.xml', maxItems: 40, priority: 3.0
  },
  chinanews_home: {
    name: '中新网·首页', platform: '中新网', type: 'web_list',
    url: 'https://www.chinanews.com.cn/', base: 'https://www.chinanews.com.cn/',
    pattern: String.raw`href="(\/[a-z]+\/\d{4}\/\d{2}-\d{2}\/\d+\.shtml)"[^>]*>([\s\S]{4,90}?)<\/a>`,
    maxItems: 40, priority: 2.6, timeoutMs: 25000
  },
  chinanews_world: {
    name: '中新网·国际', platform: '中新网', type: 'rss',
    url: 'https://www.chinanews.com.cn/rss/world.xml', maxItems: 30, priority: 3.3
  },

  /* ---------- 政治 / 官方媒体 ---------- */
  gov_cn: {
    name: '中国政府网', platform: '中国政府网', type: 'web_list',
    url: 'https://www.gov.cn/', base: 'https://www.gov.cn/',
    pattern: String.raw`href="(https?:\/\/www\.gov\.cn\/(?:yaowen\/liebiao|zhengce\/[a-z]+\/[a-z]+)\/20\d{4}\/content_\d+\.htm)"[^>]*>([\s\S]{4,90}?)<\/a>`,
    maxItems: 30, priority: 3.2, timeoutMs: 25000
  },
  people_home: {
    name: '人民网·首页', platform: '人民网', type: 'web_list',
    url: 'https://www.people.com.cn/', base: 'https://www.people.com.cn/',
    pattern: String.raw`href="(https?:\/\/(?:politics|world|finance|military|scitech|it)\.people\.com\.cn\/n\d+\/\d{4}\/\d{4}\/c\d+-\d+\.html)"[^>]*>([\s\S]{4,90}?)<\/a>`,
    maxItems: 30, priority: 2.2, timeoutMs: 25000
  },
  people_world: {
    name: '人民网·国际', platform: '人民网', type: 'web_list',
    url: 'https://world.people.com.cn/', base: 'https://world.people.com.cn/',
    pattern: String.raw`href="((?:https?:\/\/world\.people\.com\.cn)?\/n\d+\/\d{4}\/\d{4}\/c\d+-\d+\.html)"[^>]*>([\s\S]{4,90}?)<\/a>`,
    maxItems: 30, priority: 3.1, timeoutMs: 25000
  },
  /* 境外中文媒体：本地网络不可达，仅线上 Actions 生效（国际热点的主要来源） */
  bbc_zh: {
    name: 'BBC中文', platform: 'BBC中文', type: 'rss', allPass: true,
    url: 'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml', maxItems: 20, priority: 3.5, timeoutMs: 25000
  },
  rfi_cn: {
    name: '法广', platform: '法广', type: 'rss', allPass: true,
    url: 'https://www.rfi.fr/cn/rss', maxItems: 20, priority: 3.5, timeoutMs: 25000
  },
  dw_zh: {
    name: '德国之声', platform: '德国之声', type: 'rss', allPass: true,
    url: 'https://rss.dw.com/rdf/rss-chi-all', maxItems: 20, priority: 3.4, timeoutMs: 25000
  },
  /* 央视新闻/军事文章页只内联 1–3 条（其余靠 JS 渲染），改用新闻联播栏目页：每日 18 条且带日期 */
  cctv_xwlb: {
    name: '央视·新闻联播', platform: '央视新闻', type: 'web_list', allPass: true,
    url: 'https://tv.cctv.com/lm/xwlb/', base: 'https://tv.cctv.com/',
    pattern: String.raw`href="(https?:\/\/tv\.cctv\.com\/\d{4}\/\d{2}\/\d{2}\/VIDE[A-Za-z0-9]+\.shtml)"[^>]*>([\s\S]{4,160}?)<\/a>`,
    stripPrefix: String.raw`^(?:完整版)?(?:\[视频\]|【视频】)?`,
    maxItems: 30, priority: 3.6, timeoutMs: 25000
  },

  /* ---------- 军事 ---------- */
  junwang_81: {
    name: '中国军网', platform: '中国军网', type: 'web_list',
    url: 'https://www.81.cn/', base: 'https://www.81.cn/',
    pattern: String.raw`href="(https?:\/\/www\.81\.cn\/yw_\d+\/\d+\.html)"[^>]*>([\s\S]{6,90}?)<\/a>`,
    maxItems: 25, priority: 3.2, timeoutMs: 25000
  },
  ifeng_mil: {
    name: '凤凰军事', platform: '凤凰军事', type: 'web_list',
    url: 'https://mil.ifeng.com/', base: 'https://mil.ifeng.com/',
    pattern: String.raw`href="(https?:\/\/mil\.ifeng\.com\/c\/[A-Za-z0-9]+)"[^>]*>([\s\S]{6,90}?)<\/a>`,
    maxItems: 25, priority: 2.4, timeoutMs: 25000
  },

  /* ---------- 储能 ---------- */
  bjx_storage: {
    name: '北极星储能网', platform: '北极星储能网', type: 'web_list',
    url: 'https://chuneng.bjx.com.cn/', base: 'https://news.bjx.com.cn/',
    pattern: String.raw`href="((?:https?:\/\/news\.bjx\.com\.cn)?\/html\/\d{8}\/\d+\.shtml)"[^>]*>([\s\S]{4,90}?)<\/a>`,
    maxItems: 30, priority: 3.5, timeoutMs: 25000
  },

  /* ---------- 储能头部企业资讯（Google News RSS，查询本身已限定公司名） ---------- */
  gnews_huawei: {
    name: '企业资讯·华为数字能源', platform: '媒体报道', type: 'rss', allPass: true,
    urlTemplate: GNEWS, query: '"华为数字能源"', maxItems: 12, priority: 3.4
  },
  gnews_sungrow: {
    name: '企业资讯·阳光电源', platform: '媒体报道', type: 'rss', allPass: true,
    urlTemplate: GNEWS, query: '"阳光电源"', maxItems: 12, priority: 3.4
  },
  gnews_catl: {
    name: '企业资讯·宁德时代', platform: '媒体报道', type: 'rss', allPass: true,
    urlTemplate: GNEWS, query: '"宁德时代"', maxItems: 12, priority: 3.4
  },
  gnews_guoxuan: {
    name: '企业资讯·国轩高科', platform: '媒体报道', type: 'rss', allPass: true,
    urlTemplate: GNEWS, query: '"国轩高科"', maxItems: 12, priority: 3.4
  },
  gnews_eve: {
    name: '企业资讯·亿纬锂能', platform: '媒体报道', type: 'rss', allPass: true,
    urlTemplate: GNEWS, query: '"亿纬锂能"', maxItems: 12, priority: 3.4
  },
  gnews_hicen: {
    name: '企业资讯·海辰储能', platform: '媒体报道', type: 'rss', allPass: true,
    urlTemplate: GNEWS, query: '"海辰储能"', maxItems: 12, priority: 3.4
  },

  /* ---------- B站 UP 主 / 央视官方号（uid 留空则运行时按名字精确解析） ---------- */
  bili_xiaolin: {
    name: 'B站·小Lin说', platform: 'B站', type: 'bilibili',
    uid: '520819684', allPass: true, maxItems: 15, priority: 3.6
  },
  bili_tuzi: {
    name: 'B站·兔子念金', platform: 'B站', type: 'bilibili',
    uid: '1335565146', allPass: true, maxItems: 15, priority: 3.6
  },
  bili_jingjing: {
    name: 'B站·晶晶博士CASS', platform: 'B站', type: 'bilibili',
    uid: '180549227', allPass: true, maxItems: 15, priority: 3.6
  },
  bili_laoshi: {
    name: 'B站·老石谈芯', platform: 'B站', type: 'bilibili',
    uid: '', resolveName: '老石谈芯', allPass: true, maxItems: 15, priority: 3.6
  },
  bili_cctv_news: {
    name: 'B站·央视新闻', platform: 'B站', type: 'bilibili',
    uid: '456664753', maxItems: 15, priority: 3.6
  },
  bili_cctv_mil: {
    name: 'B站·央视军事', platform: 'B站', type: 'bilibili',
    uid: '46470268', allPass: true, maxItems: 15, priority: 3.6
  }
};

/* ---------- 赛道：关键词 + 信源清单（同一条目只归一个赛道） ---------- */
export const KEY = {
  tech: ['科技', 'AI', '人工智能', '人工智慧', '大模型', '模型', '智能体', 'Agent', 'Agentic', '算法', '演算法', '算力', '芯片', '晶片', '半导体', '光刻', 'GPU',
    'CPU', '处理器', '机器人', '人形机器人', '量子', '操作系统', '开源', '开源模型', '软件', '硬件', '数据中心', '伺服器', '云计算',
    '5G', '6G', '自动驾驶', '智能驾驶', '手机', '电脑', '笔记本', '苹果', '华为', '英伟达', '微软', '谷歌',
    '字节', '腾讯', '阿里', 'DeepSeek', 'OpenAI', 'Anthropic', 'Claude', 'ChatGPT', 'GPT', 'Gemini', 'Copilot', 'Llama', 'Meta',
    '豆包', '元宝', 'Kimi', '通义', 'MiniMax', '智谱', '文心', '混元', '多模态', '生成模型', '图像生成', '端侧', '推理',
    '智能', '数字化', '空间站', '航天', '卫星', '火箭', '北斗', '元宇宙', 'AR', 'VR'],
  finance: ['金融', '财经', '银行', '股市', '股票', '证券', '基金', '保险', '债券', '利率', '汇率', '人民币',
    '财政', '税收', 'GDP', '经济', '央行', '货币政策', 'A股', '港股', '美股', '上市', '融资', 'IPO', '投资',
    '贷款', '信贷', '存款', '外贸', '出口', '进口', '物价', 'CPI', 'PPI', '房地产', '楼市', '消费', '外汇',
    '信托', '并购', '重组', '市值', '券商', '期货', '黄金', '数字货币', '跨境', '自贸', '关税', '制造业',
    '招商', '营商', '产业', '企业', '市场', '订单', '营收', '利润'],
  politics: ['习近平', '李强', '赵乐际', '王沪宁', '丁薛祥', '国务院', '中共中央', '全国人大', '全国政协',
    '外交部', '政策', '会议', '讲话', '考察', '访问', '会见', '调研', '主持', '部署', '审议', '表决', '党建',
    '中央', '国家主席', '总理', '外长', '王毅', '部长', '省委', '市委', '改革', '规划', '十五五', '五年规划',
    '政府工作报告', '反腐', '审查调查', '纪委', '监察', '巡视', '干部', '任命', '免职', '常委', '书记', '座谈',
    '论坛', '峰会', '国际合作', '一带一路', '外交', '条约', '协定',
    '新闻联播', '主播说联播', '朝闻天下', '早间新闻', '晚间新闻', '时政',
    /* 国际政治议题（境外中文媒体与中新网国际的主要产出） */
    '游行', '抗议', '示威', '罢工', '骚乱', '暴动', '宵禁', '大选', '选举', '议会', '国会', '首相', '总统',
    '执政', '在野', '反对党', '民调', '欧盟', '制裁', '移民', '白宫', '联合国', '国际社会',
    '法国', '德国', '英国', '美国', '日本', '韩国', '意大利', '乌克兰', '中东', '加沙'],
  military: ['军事', '国防', '军队', '部队', '军演', '演习', '导弹', '战机', '航母', '军舰', '海军',
    '空军', '陆军', '火箭军', '士兵', '军官', '战区', '武器', '装备', '无人机', '防空', '雷达', '坦克', '潜艇',
    '战争', '冲突', '停火', '军费', '国防部', '阅兵', '维和', '作战', '军事基地', '安全构想', '军力', '兵役',
    '征兵', '边境', '袭击', '空袭', '停战', '和谈', '联军', '北约', '军事行动'],
  storage: ['储能', '电池', '锂电', '钠电', '固态电池', '电解液', '正极', '负极', '隔膜', 'PCS', 'BMS',
    '构网型', '虚拟电厂', '光伏', '风电', '氢能', '电网', '电力', '新能源', '充电', '碳达峰', '碳中和', '双碳',
    '能源', '容量电价', '峰谷价差', '独立储能', '共享储能', '工商储', '大储', '户储', '微电网', '特高压', '绿电',
    '零碳', '绿色转型', '能源转型', '新型电力系统', '新型储能', '充换电', '动力电池', '锂电池',
    '宁德时代', '宁德', '国轩高科', '国轩', '亿纬锂能', '亿纬', '海辰储能', '海辰', '阳光电源', '华为数字能源']
};

/** 视频源排在最前，保证「以视频为主」 */
export const TRACKS = [
  {
    name: '科技', keywords: KEY.tech, maxVideos: 3,
    sources: ['bili_laoshi', 'gnews_agent', 'gnews_ai', 'infoq', 'ifanr', 'geekpark', 'ithome', 'qbitai', 'leiphone', 'chinanews_scroll', 'chinanews_home']
  },
  {
    name: '财经', keywords: KEY.finance,
    sources: ['bili_xiaolin', 'bili_tuzi', 'bili_jingjing', 'chinanews_finance', 'chinanews_scroll', 'chinanews_home']
  },
  {
    name: '政治', keywords: KEY.politics, maxVideos: 3,
    sources: ['bili_cctv_news', 'bbc_zh', 'rfi_cn', 'dw_zh', 'chinanews_world', 'cctv_xwlb', 'gov_cn', 'people_world', 'chinanews_scroll', 'chinanews_home', 'people_home']
  },
  {
    name: '军事', keywords: KEY.military, maxVideos: 5,
    sources: ['bili_cctv_mil', 'junwang_81', 'chinanews_scroll', 'chinanews_home', 'ifeng_mil']
  },
  {
    name: '储能', keywords: KEY.storage,
    sources: ['gnews_huawei', 'gnews_sungrow', 'gnews_catl', 'gnews_guoxuan', 'gnews_eve', 'gnews_hicen', 'bjx_storage', 'chinanews_scroll', 'chinanews_home']
  }
];
