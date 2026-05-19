#!/usr/bin/env python3
"""
MWLAB 品牌英文名批量赋值
规则: 中文名 → 去地点/修饰/后缀 → 核心词 → 缩写映射 → 生成英文名
"""

import sqlite3
import re
import csv
import sys
import os
from collections import Counter, defaultdict

DB_PATH = "mwlab.db"
DRY_RUN_CSV = "exports/name_en_dry_run.csv"

# ═══════════════════════════════════════════════════
# 词库
# ═══════════════════════════════════════════════════

# 地点/地区词（覆盖城市、省份、区域）
LOCATION_WORDS = {
    "北京", "上海", "广州", "深圳", "杭州", "成都", "重庆", "武汉", "南京",
    "西安", "郑州", "长沙", "天津", "青岛", "大连", "宁波", "厦门", "济南",
    "沈阳", "东莞", "佛山", "中山", "珠海", "合肥", "贵阳", "昆明", "南宁",
    "海口", "福州", "温州", "义乌", "苏州", "无锡", "常州", "南通", "徐州",
    "唐山", "石家庄", "太原", "呼和浩特", "乌鲁木齐", "拉萨", "银川", "兰州",
    "西宁", "长春", "哈尔滨", "南昌", "东光", "江门", "临沂", "烟台",
    "东北", "华南", "华东", "华北", "西南", "西北", "华中",
    "河北", "河南", "山东", "山西", "陕西", "甘肃", "青海", "四川",
    "贵州", "云南", "湖南", "湖北", "江西", "安徽", "江苏", "浙江",
    "福建", "广东", "广西", "海南", "西藏", "宁夏", "内蒙古", "新疆",
    "青海", "北部", "中部", "西部", "南部", "东部", "北方", "南方",
    "大湾区", "长三角", "京津冀", "渤海湾", "莫干山", "海名",
    "香港", "澳门", "台湾",
    "新疆", "内蒙古", "宁夏", "广西", "西藏",
    "嘉兴", "台州", "金华", "绍兴", "湖州", "丽水", "衢州", "舟山",
    "泉州", "漳州", "莆田", "三明", "龙岩", "宁德", "南平",
    "镇江", "扬州", "泰州", "盐城", "淮安", "连云港", "宿迁",
    "威海", "日照", "淄博", "枣庄", "东营", "潍坊", "济宁", "泰安", "聊城", "德州", "滨州", "菏泽",
    "洛阳", "开封", "新乡", "安阳", "许昌", "平顶山", "焦作", "鹤壁", "濮阳", "漯河", "三门峡", "商丘", "周口", "驻马店", "信阳", "南阳",
    "芜湖", "马鞍山", "铜陵", "安庆", "黄山", "滁州", "阜阳", "宿州", "六安", "亳州", "池州", "宣城",
    "九江", "景德镇", "萍乡", "新余", "鹰潭", "赣州", "吉安", "宜春", "抚州", "上饶",
    "株洲", "湘潭", "衡阳", "邵阳", "岳阳", "常德", "张家界", "益阳", "郴州", "永州", "怀化", "娄底",
    "绵阳", "自贡", "攀枝花", "泸州", "德阳", "广元", "遂宁", "内江", "乐山", "南充", "眉山", "宜宾", "广安", "达州", "雅安", "巴中", "资阳",
    "柳州", "桂林", "梧州", "北海", "防城港", "钦州", "贵港", "玉林", "百色", "贺州", "河池", "来宾", "崇左",
    "遵义", "六盘水", "安顺", "毕节", "铜仁",
    "曲靖", "玉溪", "保山", "昭通", "丽江", "普洱", "临沧",
    "三亚", "儋州",
}

# 修饰词
MODIFIER_WORDS = {
    "国际", "中国", "全国", "全球", "亚洲", "世界", "丝路",
}

# 后缀词
SUFFIX_WORDS = {
    "展览会", "博览会", "展", "大会", "论坛", "峰会", "交易会",
    "洽谈会", "采购会", "展销会", "推介会", "产业大会",
}

# 展会类型后缀（紧跟在核心词后面）
EXPO_SUFFIX_PATTERN = re.compile(
    r'(展览会|博览会|展|大会|论坛|峰会|交易会|洽谈会|采购会|展销会|推介会|产业大会|'
    r'暨.*?(?:展览会|博览会|展|大会)|'
    r'供应链博览会|供应链展览会|产业博览会|技术展览会|设备展览会)$'
)

# 行业 l2 → 主缩写
L2_ABBREV = {
    "工业装备": "IND",
    "食品饮料": "FOOD",
    "汽车工业": "AUTO",
    "包装印刷": "PACK",
    "餐饮服务": "CATER",
    "家纺家居": "HOME",
    "茶叶咖啡": "TEA",
    "医疗器械": "MED",
    "宠物用品": "PET",
    "机械制造": "MACH",
    "贸易": "TRADE",
    "建筑材料": "BUILD",
    "复合材料": "COMP",
    "服装服饰": "GAR",
    "建筑技术": "BTECH",
    "数字经济": "DIGI",
    "健康产业": "HEALTH",
    "塑料工业": "PLAS",
    "美容美发": "BEAUTY",
    "酒类饮料": "WINE",
    "生活消费": "CONSUME",
    "环保技术": "ENVIRO",
    "安防设备": "SEC",
    "礼品工艺品": "GIFT",
    "电力电工": "ELEC",
    "珠宝首饰": "JEWEL",
    "水处理技术": "WATER",
    "旅游观光": "TOUR",
    "机床工具": "MTOOL",
    "文化产业": "CULT",
    "应急装备": "EMER",
    "制冷暖通": "HVAC",
    "新能源汽车": "EV",
    "科技": "TECH",
    "能源": "ENERGY",
    "矿业技术": "MINE",
    "清洁设备": "CLEAN",
    "农业": "AGRI",
    "房车露营": "RV",
    "户外用品": "OUTDOOR",
    "教育装备": "EDU",
    "校服园服": "UNIF",
    "塑料橡胶": "PLAS",
    "纺织服装": "TEX",
    "物流": "LOG",
    "消防": "FIRE",
    "照明": "LIGHT",
    "广告": "AD",
    "体育": "SPORT",
    "动漫": "ANIME",
    "渔业水产": "FISH",
    "孕婴童": "BABY",
    "玩具模型": "TOY",
    "成人用品": "ADULT",
    "轴承技术": "BEAR",
    "表面处理": "SURFACE",
    "交通技术": "TRANS",
    "光伏太阳能": "SOLAR",
    "砂石技术": "STONE",
    "水利工程": "HYDRO",
    "农业生产": "AGRI",
    "个人护理": "PCARE",
    "品牌授权": "LICENSE",
    "家电": "APPL",
    "工程装备": "CENG",
    "防爆设备": "EXPLO",
    "金属加工": "METAL",
    "台球": "BILL",
    "军事防务": "DEF",
    "农产品": "AGRI",
    "婚庆服务": "WED",
    "直播电商": "LIVE",
    "高尔夫": "GOLF",
    "3D打印": "3DP",
    "中医药": "TCM",
    "中华老字号": "LEGACY",
    "乐器": "MUSIC",
    "乳业奶业": "DAIRY",
    "云计算": "CLOUD",
    "五金制品": "HARDW",
    "文具": "STAT",
    "办公用品": "OFFICE",
    "泳池": "POOL",
    "桑拿": "SAUNA",
    "温泉": "SPA",
    "酒店": "HOTEL",
    "餐饮": "CATER",
    "酒店用品": "HOTEL",
    "厨房设备": "KITCH",
    "石材": "MARBLE",
    "陶瓷": "CERAM",
    "玻璃": "GLASS",
    "木工机械": "WOOD",
    "门窗": "DOOR",
    "幕墙": "FACADE",
    "紧固件": "FAST",
    "弹簧": "SPRING",
    "铸造": "CAST",
    "锻压": "FORGE",
    "热处理": "HEATT",
    "工业自动化": "AUTO",
    "仪器仪表": "INSTR",
    "科学仪器": "SCIIN",
    "实验室": "LAB",
    "检测": "TEST",
    "计量": "METRO",
    "印刷": "PRINT",
    "包装": "PACK",
    "标签": "LABEL",
    "食品加工": "FOODP",
    "食品机械": "FOODM",
    "饮料": "BEV",
    "酒类": "WINE",
    "茶叶": "TEA",
    "咖啡": "COFFEE",
    "烘培": "BAKE",
    "糖酒": "SUGAR",
    "调味品": "SPICE",
    "农产品": "AGRI",
    "粮油": "GRAIN",
    "果蔬": "FRUIT",
    "肉类": "MEAT",
    "水产": "AQUA",
    "渔业": "FISH",
    "畜牧": "LVSTK",
    "饲料": "FEED",
    "兽药": "VET",
    "农药": "PEST",
    "化肥": "FERT",
    "种业": "SEED",
    "园林": "GARDEN",
    "花卉": "FLOWER",
    "园艺": "HORTI",
    "电动工具": "PTOOL",
    "焊接": "WELD",
    "激光": "LASER",
    "线缆": "CABLE",
    "电子元器件": "ECOMPS",
    "半导体": "SEMI",
    "集成电路": "IC",
    "光电子": "OPTRO",
    "传感器": "SENSOR",
    "显示": "DISP",
    "触控": "TOUCH",
    "无人机": "UAV",
    "卫星": "SAT",
    "测绘": "SURVEY",
    "地理信息": "GIS",
    "环保": "ENVIRO",
    "固废": "WASTE",
    "大气": "AIR",
    "土壤": "SOIL",
    "噪声": "NOISE",
    "环卫": "SANIT",
    "清洁": "CLEAN",
    "洗涤": "WASH",
    "新能源": "ENERGY",
    "风电": "WIND",
    "光伏": "SOLAR",
    "储能": "STORE",
    "氢能": "HYDROG",
    "充电桩": "CHARGE",
    "电池": "BATT",
    "核能": "NUC",
    "生物质": "BIOEN",
    "海洋": "OCEAN",
    "船舶": "SHIP",
    "港口": "PORT",
    "海事": "MARIT",
    "轨道交通": "RAIL",
    "隧道": "TUNNEL",
    "桥梁": "BRIDGE",
    "工程机械": "CEMACH",
    "建筑机械": "BUILDM",
    "矿山机械": "MINEM",
    "煤炭": "COAL",
    "石油": "OIL",
    "天然气": "GAS",
    "石化": "PETRO",
    "精细化工": "FINCHE",
    "涂料": "PAINT",
    "胶粘剂": "ADHES",
    "密封": "SEAL",
    "过滤": "FILTER",
    "分离": "SEPAR",
    "膜": "MEMBR",
    "管材": "PIPE",
    "型材": "PROFIL",
    "板材": "BOARD",
    "钢铁": "STEEL",
    "不锈钢": "STAIN",
    "铝": "ALUM",
    "铜": "COPPER",
    "镁": "MAGN",
    "钛": "TITAN",
    "稀土": "RAREE",
    "粉末冶金": "POWDER",
    "磁性材料": "MAGNET",
    "碳纤维": "CARBON",
    "芳纶": "ARAMID",
    "高分子": "POLYM",
    "纳米": "NANO",
    "石墨烯": "GRAPH",
    "生物材料": "BIOMAT",
    "功能材料": "FUNCMT",
    "新能源材料": "ENMAT",
    "电子信息材料": "EMAT",
    "军工配套": "MILSUP",
    "民融合": "CIVMIL",
    "应急救援": "RESCUE",
    "防汛": "FLOOD",
    "地震": "QUAKE",
    "安全生产": "SPROD",
    "劳动保护": "LABPRO",
    "职业健康": "OCHEALTH",
    "公共安全": "PUBSE",
    "网络安全": "CYBER",
    "信息安全": "INFOSEC",
    "智慧警务": "SMPOL",
    "智能交通": "ITS",
    "停车": "PARK",
    "充电设施": "EVCHAR",
    "智能建筑": "SMBLD",
    "智能家居": "SMHOME",
    "智慧社区": "SMCOM",
    "智慧物业": "SMPROP",
    "数字经济": "DIGEC",
    "电子商务": "ECOM",
    "跨境电商": "CBEC",
    "新零售": "NRET",
    "数字营销": "DIGIM",
    "区块链": "BLOCK",
    "元宇宙": "META",
    "ARVR": "XR",
    "工业互联网": "IIOT",
    "工业设计": "INDES",
    "创意": "CREAT",
    "创新": "INNOV",
    "创业": "START",
    "孵化": "INCUB",
    "众创": "COWRK",
    "共享": "SHARE",
    "服务贸易": "SERTRD",
    "技术交易": "TECHTR",
    "产权": "IP",
    "专利": "PATENT",
    "商标": "BRAND",
    "地理标志": "GI",
    "碳中和": "CARBON",
    "碳交易": "CTRADE",
    "节能": "ESAVE",
    "减排": "EMRED",
    "资源再生": "RECYC",
    "循环经济": "CIREC",
    "军民融合": "CIVMIL",
    "军工": "MILTEC",
    "国防": "DEF",
    "武器装备": "WEAPON",
    "雷达": "RADAR",
    "通信": "COMM",
    "指挥": "CMDCON",
    "控制": "CTRL",
    "仿真": "SIMUL",
    "虚拟现实": "VR",
    "增强现实": "AR",
    "混合现实": "MR",
    "全息": "HOLO",
    "机器人": "ROBOT",
    "服务机器人": "SERVRO",
    "特种机器人": "SPROB",
    "无人机系统": "UAS",
    "无人系统": "UNMAN",
    "自动驾驶": "ADRIVE",
    "智能网联": "ICV",
    "车联网": "V2X",
    "高精度": "HDPRE",
    "定位导航": "POSNAV",
    "遥感": "RSENS",
    "遥测": "TELEM",
    "遥控": "REMOT",
    "司法": "JUDIC",
    "公证": "NOTARY",
    "仲裁": "ARBIT",
    "调解": "MEDIAT",
    "法律科技": "LEGTEC",
    "人力资源": "HR",
    "劳务": "LABOR",
    "招聘": "RECRUIT",
    "猎头": "HEAD",
    "社保": "SOCINS",
    "薪酬": "COMPEN",
    "福利": "BENEF",
    "保险": "INS",
    "再保险": "REINS",
    "银行": "BANK",
    "证券": "SECUR",
    "基金": "FUND",
    "期货": "FUTURE",
    "信托": "TRUST",
    "租赁": "LEASE",
    "保理": "FACTO",
    "担保": "GUAR",
    "典当": "PAWN",
    "拍卖": "AUC",
    "评级": "RATING",
    "征信": "CREDIT",
    # === 高频未映射补充 ===
    "储能技术": "STORE",
    "人工智能": "AI",
    "连锁加盟": "FRANCH",
    "陶瓷技术": "CERAM",
    "休闲娱乐": "LEISURE",
    "化工": "CHEM",
    "口腔牙科": "DENT",
    "家具": "FURN",
    "泵阀管件": "PUMP",
    "海事技术": "MARIT",
    "灯光音响": "AUDIO",
    "电动车": "EBIKE",
    "电子": "ELEC",
    "畜牧养殖": "LVSTK",
    "冶金技术": "METAL",
    "制药": "PHARMA",
    "动漫游戏": "ANIME",
    "消防设备": "FIRE",
    "科技创新": "TECH",
    "航空技术": "AERO",
    "花卉园艺": "HORTI",
    "康复养老": "ELDER",
    "烘焙焙烤": "BAKE",
    "煤炭技术": "COAL",
    "生物技术": "BIOTEC",
    "糖酒会": "SUGAR",
    "零售": "RETAIL",
    "新能源充电": "EVCHAR",
    "时尚产业": "FASHION",
    "电池技术": "BATT",
    "软件信息": "SOFT",
    "体育用品": "SPORT",
    "光学眼镜": "OPTIC",
    "房地产": "REAL",
    "景观园林": "GARDEN",
    "机器人技术": "ROBOT",
    "竹业": "BAMBOO",
    "管材管件": "PIPE",
    "铸造锻造": "CAST",
    "玩具": "TOY",
    "光电技术": "OPTRO",
    "医疗": "MED",
    "厨卫设施": "KITCH",
    "广告标识": "AD",
    "文具办公": "STAT",
    "检测技术": "TEST",
    "汽车配件": "AUTO",
    "热泵技术": "HEATP",
    "物联网": "IOT",
    "电机技术": "MOTOR",
    "警用装备": "POLICE",
    "造纸工业": "PAPER",
    "钓鱼渔具": "FISH",
    "鞋业": "SHOE",
    "风能": "WIND",
}

# 子关键词 → 副缩写
SUB_ABBREV = {
    "工具": "TOOL",    "制造": "MFG",     "包装": "PACK",
    "机械": "MACH",    "装备": "EQUIP",   "技术": "TECH",
    "材料": "MATL",    "设备": "EQUIP",   "用品": "SUPPLY",
    "工业": "IND",     "产业": "IND",     "食品": "FOOD",
    "饮料": "BEV",     "服装": "GAR",     "纺织": "TEX",
    "医疗": "MED",     "健康": "HEALTH",  "美容": "BEAUTY",
    "建筑": "BUILD",   "建材": "BMAT",    "家居": "HOME",
    "汽车": "AUTO",    "新能源": "EV",    "零部件": "PARTS",
    "电子": "ELEC",    "电器": "APPL",    "电力": "POWER",
    "环保": "ENVIRO",  "水处理": "WT",    "清洁": "CLEAN",
    "安全": "SAFE",    "防护": "PROT",    "消防": "FIRE",
    "农业": "AGRI",    "畜牧": "LVSTK",   "种植": "CROP",
    "物流": "LOG",     "运输": "TRANS",   "仓储": "WH",
    "教育": "EDU",     "学校": "SCH",     "培训": "TRAIN",
    "广告": "AD",      "标识": "SIGN",    "印刷": "PRINT",
    "礼品": "GIFT",    "工艺": "CRAFT",   "珠宝": "JEWEL",
    "宠物": "PET",     "户外": "OUTDOOR", "体育": "SPORT",
    "酒店": "HOTEL",   "餐饮": "FOOD",    "旅游": "TOUR",
    "矿业": "MINE",    "能源": "ENERGY",  "化工": "CHEM",
    "金属": "METAL",   "加工": "PROC",    "塑料": "PLAS",
    "橡胶": "RUBB",    "制冷": "COOL",    "暖通": "HEAT",
    "空调": "AC",      "供暖": "HEAT",    "供热": "HEAT",
    "锅炉": "BOIL",    "泵阀": "PUMP",    "管道": "PIPE",
    "阀门": "VALVE",   "轴承": "BEAR",    "弹簧": "SPRING",
    "铸造": "CAST",    "焊接": "WELD",    "切割": "CUT",
    "激光": "LASER",   "机器人": "ROBOT",  "自动化": "AUTO",
    "智能": "SMART",   "数字": "DIGI",    "网络": "NET",
    "软件": "SOFT",    "大数据": "BIGD",   "云计算": "CLOUD",
    "物联网": "IOT",   "传感器": "SENS",  "无人机": "UAV",
    "医疗器械": "MED",  "制药": "PHARMA",  "药品": "DRUG",
    "中药": "TCM",     "保健品": "SUPP",   "康复": "REHAB",
    "养老": "ELDER",   "辅具": "AID",
    "家居": "HOME",    "家具": "FURN",    "家纺": "HTEX",
    "卫浴": "BATH",    "厨房": "KITCH",   "灯具": "LAMP",
    "锁具": "LOCK",    "门窗": "DOOR",    "地板": "FLOOR",
    "墙纸": "WALL",    "涂料": "PAINT",   "石材": "MARBLE",
    "陶瓷": "CERAM",   "玻璃": "GLASS",
    "食品": "FOOD",    "饮料": "BEV",     "酒": "WINE",
    "茶": "TEA",       "咖啡": "COFFEE",  "烘焙": "BAKE",
    "冰淇淋": "ICECRM", "餐饮": "CATER",   "食材": "INGRED",
    "调味品": "SPICE",  "乳业": "DAIRY",   "肉业": "MEAT",
    "水产": "AQUA",    "渔业": "FISH",    "海鲜": "SEAFOOD",
    "水果": "FRUIT",   "蔬菜": "VEG",
    "汽车": "AUTO",    "商用车": "CV",     "乘用车": "PV",
    "改装": "TUNING",  "后市场": "AFTMKT", "维修": "REPAIR",
    "轮胎": "TIRE",    "润滑油": "LUBE",
    "服装": "GAR",     "鞋": "SHOE",      "帽": "HAT",
    "箱包": "BAG",     "皮具": "LEATH",   "配饰": "ACC",
    "珠宝": "JEWEL",   "首饰": "JEWEL",   "手表": "WATCH",
    "眼镜": "GLASSES",
    "运动": "SPORT",   "健身": "FIT",     "骑行": "BIKE",
    "登山": "CLIMB",   "露营": "CAMP",    "钓鱼": "FISH",
    "玩具": "TOY",     "模型": "MODEL",   "潮玩": "ARTTOY",
    "游戏": "GAME",    "动漫": "ANIME",   "电竞": "ESPORT",
    "宠物": "PET",     "水族": "AQUA",    "花卉": "FLOWER",
    "园林": "GARDEN",  "景观": "LANDSC",
    "乐器": "MUSIC",   "音响": "AUDIO",   "灯光": "LIGHT",
    "舞台": "STAGE",
    "电影": "FILM",    "电视": "TV",      "广播": "BROAD",
    "出版": "PUB",     "图书": "BOOK",
    "环保": "ENVIRO",  "节能": "ESAVE",   "减排": "EMIS",
    "固废": "SOLIDW",  "废气": "WASTE",   "污水": "SEWAGE",
    "净水": "PUREW",   "膜": "MEMBR",
    "新能源": "EV",    "光伏": "PV",      "风能": "WIND",
    "储能": "STORE",   "氢能": "HYDROG",  "核能": "NUC",
    "电池": "BATT",    "充电": "CHARGE",
    "航空": "AERO",    "航天": "SPACE",   "船舶": "MARINE",
    "轨道交通": "RAIL",
    "矿业": "MINE",    "煤炭": "COAL",    "石油": "OIL",
    "天然气": "GAS",   "石化": "PETRO",
    "钢铁": "STEEL",   "有色": "NONFER",
    "安防": "SEC",     "监控": "CCTV",    "门禁": "ACCESS",
    "消防": "FIRE",    "应急": "EMER",    "救援": "RESCUE",
    "防爆": "EXPLO",
    "医疗器械": "MED",  "诊断": "DIAG",    "影像": "IMAGE",
    "手术": "SURG",    "牙科": "DENT",    "眼科": "OPTH",
    "兽医": "VET",     "实验室": "LAB",
    "教育": "EDU",     "教具": "TEACH",   "实训": "TRAIN",
    "在线教育": "ONLEDU",
    "金融": "FIN",     "银行": "BANK",    "保险": "INSUR",
    "投资": "INV",     "理财": "WEALTH",
    "房地产": "REAL",   "物业": "PROP",    "商业地产": "CRE",
    "法律": "LAW",     "知识产权": "IP",
    "电商": "ECOM",    "跨境": "CBEC",    "直播": "LIVE",
    "零售": "RETAIL",  "连锁": "CHAIN",   "加盟": "FRAN",
    "特许经营": "FRAN",
    "婚庆": "WED",     "婚纱": "BRIDAL",  "摄影": "PHOTO",
    "酒": "WINE",      "啤酒": "BEER",    "烈酒": "SPIRIT",
    "酵素": "ENZYME",
    "门": "DOOR",      "窗": "WINDOW",   "幕墙": "FACADE",
    "防水": "WATERP",  "保温": "INSUL",
    "交通": "TRANS",   "道路": "ROAD",    "桥梁": "BRIDGE",
    "隧道": "TUNNEL",
    "水利": "HYDRO",   "灌溉": "IRRIG",
    "种业": "SEED",    "化肥": "FERT",    "农药": "PEST",
    "农机": "AGMACH",
    "畜牧": "LVSTK",   "养殖": "BREED",   "饲料": "FEED",
    "兽医": "VET",
    "标签": "LABEL",   "防伪": "ANTICF",
    "包装": "PACK",    "容器": "CONTNR",
    "校服": "UNIF",    "园服": "UNIF",    "制服": "UNIFORM",
    "职业装": "UNIFORM",
    "五金": "HARDW",   "锁具": "LOCK",
    "泵": "PUMP",      "管": "PIPE",      "风机": "FAN",
    "压缩机": "COMPR",
    "农业": "AGRI",    "果业": "FRUIT",   "种业": "SEED",
    "奶业": "DAIRY",   "养殖业": "BREED", "渔业": "FISH",
    "茶产业": "TEA",   "酒业": "WINE",    "乳业": "DAIRY",
    "肉业": "MEAT",
    "美酒": "WINE",    "名酒": "WINE",    "白酒": "BAIJIU",
    "红酒": "REDWINE",
}

# 拼音首字母生成 (兜底)
def pinyin_abbrev(chinese: str, max_chars: int = 4) -> str:
    """用最简拼音首字母：取常见字拼音首字母"""
    PINYIN_MAP = {
        "安": "A", "保": "B", "产": "C", "材": "C", "车": "C", "成": "C",
        "出": "C", "厨": "C", "传": "C", "窗": "C", "瓷": "C", "存": "C",
        "大": "D", "电": "D", "灯": "D", "地": "D", "钓": "D", "东": "D",
        "儿": "E", "二": "E",
        "阀": "F", "防": "F", "房": "F", "纺": "F", "服": "F", "辅": "F",
        "改": "G", "钢": "G", "工": "G", "管": "G", "光": "G", "广": "G",
        "果": "G",
        "海": "H", "航": "H", "合": "H", "化": "H", "环": "H", "婚": "H",
        "机": "J", "技": "J", "加": "J", "家": "J", "建": "J", "健": "J",
        "交": "J", "教": "J", "金": "J", "酒": "J", "军": "J",
        "康": "K", "科": "K", "空": "K", "矿": "K",
        "劳": "L", "冷": "L", "礼": "L", "零": "L", "旅": "L", "绿": "L",
        "轮": "L",
        "贸": "M", "美": "M", "门": "M", "模": "M", "木": "M", "牧": "M",
        "奶": "N", "能": "N", "农": "N", "暖": "N",
        "配": "P", "皮": "P", "品": "P",
        "汽": "Q", "器": "Q", "清": "Q", "球": "Q",
        "热": "R", "人": "R", "日": "R", "肉": "R", "润": "R",
        "砂": "S", "商": "S", "设": "S", "石": "S", "食": "S", "手": "S",
        "数": "S", "水": "S", "塑": "S",
        "台": "T", "陶": "T", "体": "T", "天": "T", "铁": "T", "通": "T",
        "玩": "W", "卫": "W", "文": "W", "无": "W", "物": "W",
        "休": "X", "畜": "X", "消": "X", "新": "X",
        "压": "Y", "医": "Y", "仪": "Y", "印": "Y", "用": "Y", "游": "Y",
        "渔": "Y", "园": "Y", "运": "Y",
        "展": "Z", "照": "Z", "制": "Z", "智": "Z", "珠": "Z", "装": "Z",
        "资": "Z", "自": "Z", "种": "Z", "轴": "Z",
    }
    result = []
    for ch in chinese:
        if ch in PINYIN_MAP:
            result.append(PINYIN_MAP[ch])
            if len(result) >= max_chars:
                break
    if not result:
        return "EXPO"  # 完全无法映射时
    return "".join(result)


def strip_location(name: str) -> str:
    """去掉地名前缀和中间的地名"""
    result = name
    # 按长度降序排列，先匹配长的
    for loc in sorted(LOCATION_WORDS, key=len, reverse=True):
        # 去掉括号内的地名: "上海(国际)" → "(国际)"
        result = re.sub(rf'[（(]\s*{re.escape(loc)}\s*[）)]', '', result)
    # 循环剥离前缀地名（地名可能连续出现: 河北石家庄）
    changed = True
    while changed:
        changed = False
        for loc in sorted(LOCATION_WORDS, key=len, reverse=True):
            # 地名开头
            if result.startswith(loc):
                remaining = result[len(loc):]
                # 如果后面跟着分隔符，也吃掉分隔符
                if remaining and remaining[0] in '·、\-—/（）()/\s':
                    result = remaining.lstrip('·、\-—/（）()/\s')
                else:
                    result = remaining
                changed = True
                break  # 重新扫描
    # 清理头部多余标点
    result = re.sub(r'^[·、\-—/（）()\s]+', '', result)
    result = re.sub(r'[·、\-—/（）()\s]+$', '', result)
    return result


def strip_modifiers(name: str) -> str:
    """去掉修饰词和杂质"""
    result = name
    for mod in sorted(MODIFIER_WORDS, key=len, reverse=True):
        result = result.replace(mod, '')
    # 去掉 "第X届/XX届/第XX届" 模式
    result = re.sub(r'第[\u4e00-\u9fff\d]+届', '', result)
    # 去掉 "春季/夏季/秋季/冬季/春夏/秋冬" 
    result = re.sub(r'[春夏秋冬]{1,2}季', '', result)
    # 去掉年份
    result = re.sub(r'\d{4}年?', '', result)
    result = re.sub(r'\d{2}届', '', result)
    # 去掉残留的英文大写缩写和数字开头
    result = re.sub(r'\b[A-Z]{2,6}\b', '', result)
    result = re.sub(r'\b\d+[A-Za-z]*\b', '', result)
    # 清理
    result = re.sub(r'\s+', ' ', result).strip()
    result = re.sub(r'^[·、\-—/]+', '', result)
    result = re.sub(r'[·、\-—/]+$', '', result)
    # 去掉括号残留
    result = re.sub(r'[（(][^）)]*[）)]', '', result)
    return result.strip()


def strip_expo_suffix(name: str) -> str:
    """去掉展会类型后缀"""
    result = re.sub(EXPO_SUFFIX_PATTERN, '', name)
    # 去掉末尾的 "展" 如果前面有内容
    result = re.sub(r'展$', '', result)
    # 清理
    result = re.sub(r'\s+', ' ', result).strip()
    result = re.sub(r'[·、\-—/]+$', '', result)
    return result


def split_keywords(text: str) -> list[str]:
    """把核心词拆成关键词列表，按优先级排列"""
    # 常见的复合词（优先匹配长的）
    COMPOUNDS = [
        "医疗器械", "新能源汽车", "智能制造", "数字经济", "物联网",
        "光伏太阳能", "水处理", "应急装备", "清洁能源", "冷链物流",
        "宠物用品", "户外用品", "房车露营", "美容美发", "珠宝首饰",
        "礼品工艺", "服装服饰", "食品饮料", "建筑材料", "金属加工",
        "表面处理", "包装印刷", "纺织服装", "塑料橡胶", "制冷暖通",
        "酒类饮料", "茶叶咖啡", "餐饮服务", "家纺家居", "机械制造",
        "工业装备", "渔业水产", "孕婴童", "玩具模型", "成人用品",
        "轴承技术", "交通技术", "砂石技术", "水利工程", "农业生产",
        "个人护理", "品牌授权", "电力电工", "工程装备", "防爆设备",
        "军事防务", "婚庆服务", "直播电商", "动漫游戏", "校服园服",
        "教育装备", "健康产业", "环保技术", "安防设备", "机床工具",
        "文化产业", "矿业技术", "清洁设备", "高尔夫", "复合新材料",
        "矿业", "农牧机械", "工业自动化", "数据中心", "云计算",
        "五金机电", "五金工具", "紧固件", "智能家居", "智能交通",
        "交通工程", "数字交通", "智慧交通", "人工智能", "智能产业",
        "智能安防", "智能科技", "智慧城市", "智慧零售", 
        "3D打印", "增材制造", "复合材料", "新能源", "储能技术",
        "生物医药", "中医药", "健康管理", "康复医疗", "银发产业",
        "假发", "发制品", "洗护用品", "日化产品", "成人卫生",
        "生殖健康", "养老用品", "护理用品", "美妆",
        "微缩模型", "潮流手办", "游戏游艺", "电玩",
        "牛羊产业", "乳业", "畜牧业", "奶业", "肉业",
        "农牧业", "种业", "化肥", "农药", "种子",
        "供热", "供暖", "空调", "热泵", "采暖",
        "锅炉", "泵阀", "管道", "阀门", 
        "门窗幕墙", "幕墙", "防水", "保温", "涂料",
        "木工机械", "家具生产", "板材",
        "农机", "植保", "园林", "花卉", "园艺",
        "酒店用品", "厨房设备", "餐具",
        "老字号", "中华老字号", "非遗",
        "网红品牌", "电商选品", "跨境电商", "外贸工厂",
    ]
    
    remaining = text
    found = []
    for comp in sorted(COMPOUNDS, key=len, reverse=True):
        if comp in remaining:
            found.append(comp)
            remaining = remaining.replace(comp, '|', 1)  # 标记已匹配
    
    # 剩余部分拆词
    remaining = remaining.replace('|', '')
    if remaining.strip():
        chars = remaining.strip()
        i = 0
        while i < len(chars):
            if i + 1 < len(chars):
                word = chars[i:i+2]
                # 跳过无意义单字和标点
                if word not in {'暨', '及', '与', '和', '展', '会', '节', '周', '业'}:
                    found.append(word)
                i += 2
            else:
                i += 1
    
    # 过滤无意义的兜底词
    MEANINGLESS = {"产业", "行业", "国际", "中国", "全国", "世界", "技术", "展览", "会世", "亚智", "博会", "采购", "洽谈", "合作", "投资", "贸易"}
    found = [f for f in found if f not in MEANINGLESS]
    
    return found


def extract_core(name: str) -> str:
    """从展会名提取核心行业词"""
    # 先处理括号内容
    result = re.sub(r'[（(][^）)]*[）)]', '', name)
    # 先去掉后缀（里面可能含地名）
    result = strip_expo_suffix(result)
    # 再去英文/数字（它们可能挡在地名前）
    result = re.sub(r'[A-Z]{2,6}', '', result)
    result = re.sub(r'\d+[A-Za-z]*', '', result)
    # 再去修饰词
    for mod in sorted(MODIFIER_WORDS, key=len, reverse=True):
        result = result.replace(mod, '')
    # 去第X届、季节
    result = re.sub(r'第[\u4e00-\u9fff\d]+届', '', result)
    result = re.sub(r'[春夏秋冬]{1,2}季', '', result)
    # 去年份
    result = re.sub(r'\d{4}年?', '', result)
    # 再去地点（连续剥离）
    result = strip_location(result)
    # 清理
    result = re.sub(r'\s+', ' ', result).strip()
    result = re.sub(r'[·、\-—/&]+', ' ', result)
    result = re.sub(r'\s+', ' ', result).strip()
    return result


def generate_name_en(name_cn: str, industry_l2: str) -> str:
    """主函数：生成英文名"""
    core = extract_core(name_cn)
    
    if not core or len(core) <= 1:
        # 核心词太短或空，直接用 l2 缩写兜底
        base = L2_ABBREV.get(industry_l2)
        if not base:
            base = "SHOW"
        return f"{base} EXPO"
    
    keywords = split_keywords(core)
    
    # 主缩写：从 l2 映射表取，未命中则用第一个关键词的拼音
    primary = L2_ABBREV.get(industry_l2)
    if not primary:
        if keywords:
            primary = pinyin_abbrev(keywords[0], 4)
        else:
            primary = pinyin_abbrev(core, 4)
    
    # 如果主缩写是 "EXPO"（兜底失败），用 l2 或 SHOW
    if primary == "EXPO":
        primary = L2_ABBREV.get(industry_l2, "SHOW")
    
    # 如果核心词提取后为空或只有无意义词
    if not keywords:
        return f"{primary} EXPO"
    
    # 如果只有一个关键词或不需副缩写，直接返回
    if len(keywords) <= 1:
        return f"{primary} EXPO"
    
    # 尝试从第 2 个关键词取副缩写
    secondary = None
    for kw in keywords[1:]:
        if kw in SUB_ABBREV:
            secondary = SUB_ABBREV[kw]
            break
        secondary = pinyin_abbrev(kw, 3)
        if secondary != "EXPO":
            break
    
    if secondary and secondary != primary and secondary != "EXPO":
        return f"{primary} {secondary} EXPO"
    else:
        return f"{primary} EXPO"


# ═══════════════════════════════════════════════════
# 主流程
# ═══════════════════════════════════════════════════

def dry_run():
    """预览模式：生成 CSV 不写入数据库"""
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    cur = db.cursor()
    
    cur.execute("""
        SELECT brand_id, name_cn, industry_l2 
        FROM exhibition_brand 
        WHERE name_en IS NULL OR name_en = ''
        ORDER BY industry_l2, name_cn
    """)
    rows = cur.fetchall()
    
    os.makedirs(os.path.dirname(DRY_RUN_CSV), exist_ok=True)
    
    results = []
    seen_names = Counter()
    
    # 第一遍：生成所有候选名
    for row in rows:
        name_cn = row["name_cn"]
        l2 = row["industry_l2"]
        core = extract_core(name_cn)
        proposed = generate_name_en(name_cn, l2)
        seen_names[proposed] += 1
        results.append({
            "brand_id": row["brand_id"],
            "name_cn": name_cn,
            "industry_l2": l2 or "",
            "core_word": core,
            "proposed": proposed,
        })
    
    # 第二遍：对重复的追加区分号
    name_counter = Counter()
    for r in results:
        proposed = r["proposed"]
        if seen_names[proposed] > 1:
            name_counter[proposed] += 1
            r["proposed"] = f"{proposed} {name_counter[proposed]}"
        r["final"] = r["proposed"]
    
    # 写入 CSV
    with open(DRY_RUN_CSV, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["brand_id", "name_cn", "industry_l2", "core_word", "final_name_en"])
        writer.writeheader()
        for r in results:
            writer.writerow({
                "brand_id": r["brand_id"],
                "name_cn": r["name_cn"],
                "industry_l2": r["industry_l2"],
                "core_word": r["core_word"],
                "final_name_en": r["final"],
            })
    
    # 打印摘要
    dupes = sum(1 for v in seen_names.values() if v > 1)
    print(f"Dry run 完成:")
    print(f"  总品牌: {len(results)}")
    print(f"  生成英文名: {len(results)}")
    print(f"  有同名冲突: {dupes} 个名，涉及 {sum(v for v in seen_names.values() if v > 1)} 条")
    print(f"  CSV 导出: {DRY_RUN_CSV}")
    
    # 打印 40 条样本
    print(f"\n--- 前 40 条预览 ---")
    for r in results[:40]:
        print(f"  [{r['industry_l2']}] {r['name_cn']}")
        print(f"    核心: '{r['core_word']}' → {r['final']}")
    
    # 按 L2 统计
    l2_stats = Counter()
    for r in results:
        l2_stats[r["industry_l2"]] += 1
    print(f"\n--- 按行业分布 ---")
    for l2, cnt in l2_stats.most_common(30):
        print(f"  {l2}: {cnt}")
    
    # 同名冲突详情
    if dupes > 0:
        print(f"\n--- 同名冲突 (top 20) ---")
        conflict_names = [(n, c) for n, c in seen_names.most_common() if c > 1]
        for name, cnt in conflict_names[:20]:
            print(f"  {name}: {cnt}次")
    
    db.close()
    return results, seen_names


def apply(results):
    """批量写入数据库"""
    db = sqlite3.connect(DB_PATH)
    cur = db.cursor()
    
    # 开始事务
    cur.execute("BEGIN")
    updated = 0
    for r in results:
        cur.execute(
            "UPDATE exhibition_brand SET name_en = ? WHERE brand_id = ? AND (name_en IS NULL OR name_en = '')",
            (r["final"], r["brand_id"])
        )
        updated += cur.rowcount
    
    cur.execute("COMMIT")
    print(f"写入完成: {updated} 条品牌已更新")
    
    # 验证
    cur.execute("SELECT COUNT(*) FROM exhibition_brand WHERE name_en IS NULL OR name_en = ''")
    remaining = cur.fetchone()[0]
    print(f"残留空英文名: {remaining}")
    
    cur.execute("""
        SELECT name_en, COUNT(*) as cnt 
        FROM exhibition_brand 
        GROUP BY name_en 
        HAVING cnt > 1 
        ORDER BY cnt DESC 
        LIMIT 10
    """)
    dupes = cur.fetchall()
    if dupes:
        print(f"仍有重复: {len(dupes)} 组")
        for name, cnt in dupes:
            print(f"  {name}: {cnt}")
    
    db.close()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--apply":
        # 先 dry run 获取结果，再写入
        results, _ = dry_run()
        confirm = input("\n确认写入? [y/N]: ")
        if confirm.lower() == "y":
            apply(results)
        else:
            print("已取消")
    else:
        dry_run()
