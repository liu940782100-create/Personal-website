window.DATA_PROJECTS = [
  {
    "id": "p001",
    "name": "个人内容账号启动",
    "stage": "执行",
    "type": "mkt",
    "level": "M",
    "scale": "micro",
    "goal": "用三个月跑通一个知识科普账号的内容模型",
    "accept": "3 个月内单条视频自然播放稳定破 1 万，粉丝净增 5000",
    "kill": "连续 8 条视频播放低于 2000，或获客成本超预算 50%",
    "gates": [
      { "name": "策划审批", "status": "通过", "note": "一页纸策划：目标 / 预算 / 渠道 / 指标" },
      { "name": "上线前终审", "status": "待审", "note": "对外内容、价格权益、品牌风险点发布前必审" }
    ],
    "workflow": [
      { "step": "策划（一页纸）", "agent": "AI 出候选方案", "output": "目标 / 预算 / 渠道 / 指标", "status": "完成" },
      { "step": "小流量试投", "agent": "AI 盯数据看板", "output": "A/B 测试结论", "status": "完成" },
      { "step": "放量执行", "agent": "AI 周对齐", "output": "", "status": "进行中" },
      { "step": "战报复盘", "agent": "AI 生成战报", "output": "", "status": "待开始" }
    ],
    "deliverables": ["策划一页纸.md", "渠道试投数据表"],
    "updatedAt": "2026-09-03"
  },
  {
    "id": "p002",
    "name": "个人网站上线",
    "stage": "复盘",
    "type": "sw",
    "level": "S",
    "scale": "micro",
    "goal": "把个人网页部署到 raphaelliu.cn，稳定可访问",
    "accept": "raphaelliu.cn 全站 HTTPS 可访问，五个页面功能正常，中英文与昼夜主题可用",
    "kill": "年成本超 200 元且无持续访问需求",
    "gates": [
      { "name": "发布自查清单", "status": "通过", "note": "S 级：自查清单替代评审，留痕即可" }
    ],
    "workflow": [
      { "step": "MVP 页面定稿", "agent": "AI 套用视觉规范", "output": "五页静态文件", "status": "完成" },
      { "step": "部署上线", "agent": "AI 指引 EdgeOne 上传", "output": "edgeone.app 临时域名", "status": "完成" },
      { "step": "域名绑定", "agent": "AI 指引 CNAME 配置", "output": "raphaelliu.cn 生效", "status": "完成" },
      { "step": "复盘归档", "agent": "AI 写复盘四问", "output": "一页纸复盘", "status": "完成" }
    ],
    "deliverables": ["一页纸复盘.md", "部署检查清单.md"],
    "review": {
      "cases": "静态站走 EdgeOne Pages 免备案路线，30 分钟即可上线",
      "template": "沉淀「部署检查清单」模板，下次新站直接复用",
      "risks": "Google Fonts 国内不稳定，手写字体必须自托管"
    },
    "updatedAt": "2026-09-04"
  },
  {
    "id": "p003",
    "name": "工商业储能一体柜开发",
    "stage": "设计",
    "type": "hw",
    "level": "L",
    "scale": "mid",
    "goal": "开发 100kW/215kWh 工商业储能一体柜并实现批量交付",
    "accept": "通过并网认证与 3C，系统循环效率 ≥ 88%，度电成本 ≤ 0.45 元",
    "kill": "认证周期超 8 个月，或 BOM 成本超目标 25% 且无降本路径",
    "gates": [
      { "name": "G1 概念门", "status": "通过", "note": "市场需求与商业论证" },
      { "name": "G2 架构门", "status": "通过", "note": "系统架构与仿真结论" },
      { "name": "G3 设计门", "status": "待审", "note": "详细设计 + DFM 可制造性审查" },
      { "name": "G4 样机门", "status": "未到", "note": "样机实测与认证并行证据" },
      { "name": "G5 试产门", "status": "未到", "note": "小批量试产良率与二供预案" },
      { "name": "G6 发布门", "status": "未到", "note": "市场发布放行" }
    ],
    "workflow": [
      { "step": "概念与需求", "agent": "AI 市场调研", "output": "市场需求文档", "status": "完成" },
      { "step": "系统架构与仿真", "agent": "AI 仿真对标", "output": "架构方案与热仿报告", "status": "完成" },
      { "step": "详细设计与工程验证", "agent": "AI DFM 审查", "output": "", "status": "进行中" },
      { "step": "样机试制与测试", "agent": "AI 测试用例", "output": "", "status": "待开始" },
      { "step": "小批量试产", "agent": "AI 供应链扫描", "output": "", "status": "待开始" },
      { "step": "市场发布", "agent": "AI 发布物料", "output": "", "status": "待开始" }
    ],
    "deliverables": ["市场需求文档.md", "系统架构方案.md"],
    "updatedAt": "2026-09-02"
  },
  {
    "id": "p004",
    "name": "户储架构新人培养知识库",
    "stage": "执行",
    "type": "proc",
    "level": "M",
    "scale": "mid",
    "goal": "建成户储架构研发新人培养体系：L0-L5 知识手册 + Gate 考核工具，支撑新人沿双轨路径毕业到「胜任」级",
    "accept": "第一期新人按期开班（L0-L1 正文、G1 试卷、安全红线材料就绪）；首期毕业答辩时案例与风险库完成首批沉淀",
    "kill": "开班推迟超一个季度仍无 P0 交付物，或连续两批材料评审未通过且无责任人推进",
    "link": "D:\\HuaweiMoveData\\Users\\94078\\Documents\\lingxi-claw\\20261011-20-31-02-911\\户储架构新人培养知识库",
    "gates": [
      { "name": "开班门（P0 就绪）", "status": "待审", "note": "L0-L1 正文 + G1 试卷 + 安全红线 + 产品认知【涉密占位】" },
      { "name": "G2 材料门（P1 就绪）", "status": "未到", "note": "L2-L3 正文与工况案例、G2 试卷、ICD/DFMEA 模板与认证速查" },
      { "name": "G3/G4 材料门（P2 就绪）", "status": "未到", "note": "L4-L5 展开、首批脱敏案例、答辩评审资源" }
    ],
    "workflow": [
      { "step": "骨架与总纲", "agent": "AI 成稿 + 架构负责人审定", "output": "总纲 / 胜任力模型 / 双轨 Gate 标准", "status": "完成" },
      { "step": "L0-L1 正文展开", "agent": "AI 初稿 + 导师组审核", "output": "L0/L1 正文 17 篇", "status": "完成" },
      { "step": "L2 展开与 P0 开班材料", "agent": "AI 出题 + 责任人填涉密", "output": "L2 正文 7 篇 · G1 试卷 · 安全红线课件", "status": "进行中" },
      { "step": "L3 展开与 G2 材料", "agent": "AI 初稿 + 骨干轮讲反哺", "output": "L3 方法论 · G2 题库与实操任务包", "status": "待开始" },
      { "step": "L4-L5 展开与案例库种子", "agent": "AI 初稿 + 认证接口人", "output": "标准认证速查 · 首批脱敏案例 4-6 个", "status": "待开始" },
      { "step": "按期迭代运营", "agent": "AI 错题与复盘分析", "output": "复盘三资产入库 · 手册与题库修订", "status": "待开始" }
    ],
    "deliverables": ["00-总纲（培养计划 / 胜任力模型 / Gate 标准）", "01-知识手册（L0-L2 正文已展开）", "04-考核题库（笔试 / 实操 / 答辩评审）", "00-AI检索索引.md"],
    "updatedAt": "2026-10-11"
  }
];
