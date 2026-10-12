export type AccountCheatValue = boolean | number;

export type AccountCheatDefinition = {
    key: string;
    label: string;
    description: string;
    category: string;
    type: "boolean" | "number";
    defaultValue: AccountCheatValue;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    warning?: string;
};

const boolean = (
    key: string,
    label: string,
    description: string,
    category: string,
    options: Pick<AccountCheatDefinition, "warning"> = {}
): AccountCheatDefinition => ({
    key,
    label,
    description,
    category,
    type: "boolean",
    defaultValue: false,
    ...options
});

const number = (
    key: string,
    label: string,
    description: string,
    category: string,
    defaultValue: number,
    min: number,
    max: number,
    suffix?: string
): AccountCheatDefinition => ({
    key,
    label,
    description,
    category,
    type: "number",
    defaultValue,
    min,
    max,
    step: 1,
    suffix
});

export const accountCheatDefinitions: AccountCheatDefinition[] = [
    boolean("skipAllDialogue", "跳过所有对话", "跳过任务与系统对话流程。", "体验"),
    boolean("skipAllPopups", "跳过所有弹窗", "隐藏大部分任务和奖励提示弹窗。", "体验"),
    boolean("instantFinishRivenChallenge", "立即完成裂罅挑战", "裂罅挑战判定为立即完成。", "体验"),
    boolean("disableDailyTribute", "禁用每日献礼", "停用每日献礼流程。", "体验"),
    boolean("incrementDailyTributeBy50", "每日献礼递增 50", "每次领取每日献礼时额外增加 50 天进度。", "体验"),

    boolean("dontSubtractPurchaseCreditCost", "购买不消耗现金", "商店购买不会扣除现金。", "资源与经济"),
    boolean("dontSubtractPurchasePlatinumCost", "购买不消耗白金", "商店购买不会扣除白金。", "资源与经济"),
    boolean("dontSubtractRushPlatinumCost", "加速不消耗白金", "加速制作不会扣除白金。", "资源与经济"),
    boolean("dontSubtractPurchaseItemCost", "购买不消耗物品", "购买配方或商品不会扣除物品。", "资源与经济"),
    boolean("dontSubtractPurchaseStandingCost", "购买不消耗声望", "声望商店购买不会扣除声望。", "资源与经济"),
    boolean("dontSubtractKuvaForRivens", "裂罅洗练不消耗 Kuva", "裂罅洗练不会扣除 Kuva。", "资源与经济"),
    boolean("dontSubtractVoidTraces", "不消耗虚空光体", "强化遗物不会扣除虚空光体。", "资源与经济"),
    boolean("dontSubtractConsumables", "不消耗消耗品", "任务和活动中的消耗品不会减少。", "资源与经济"),
    boolean("dontSubtractKeys", "不消耗钥匙", "使用钥匙进入内容不会扣除钥匙。", "资源与经济"),
    boolean("infiniteCredits", "无限现金", "现金余额不会因消费减少。", "资源与经济"),
    boolean("infinitePlatinum", "无限白金", "白金余额不会因消费减少。", "资源与经济"),
    boolean("infiniteEndo", "无限内融核心", "内融核心余额不会因消费减少。", "资源与经济"),
    boolean("infiniteDirac", "无限 Dirac", "Dirac 余额不会因消费减少。", "资源与经济"),
    boolean("infiniteRegalAya", "无限御品阿耶", "御品阿耶余额不会因消费减少。", "资源与经济"),
    boolean("infiniteRevives", "无限复活", "任务中不消耗复活次数。", "资源与经济"),
    boolean("infiniteTrades", "无限交易次数", "不受每日交易次数限制。", "资源与经济"),
    boolean("infiniteGifts", "无限赠送次数", "不受赠送次数限制。", "资源与经济"),

    boolean("finishInvasionsInOneMission", "一场任务完成入侵", "入侵进度在一场任务后完成。", "任务与限制"),
    boolean("alertsRepeatable", "警报可重复完成", "清理已完成记录，使警报可以再次领取。", "任务与限制", { warning: "开启时会清理账户中的警报完成记录。" }),
    boolean("syndicateMissionsRepeatable", "集团任务可重复完成", "集团任务不受已完成记录限制。", "任务与限制", { warning: "开启时会清理账户中的集团任务完成记录。" }),
    boolean("noDailyStandingLimits", "取消每日声望上限", "不受每日集团声望上限限制。", "任务与限制"),
    boolean("noDailyFocusLimit", "取消每日专精上限", "不受每日专精获取上限限制。", "任务与限制"),
    boolean("noArgonCrystalDecay", "取消氩结晶衰变", "氩结晶不会随时间衰变。", "任务与限制"),
    boolean("noVendorPurchaseLimits", "取消商人购买限制", "不受商人每日购买次数限制。", "任务与限制", { warning: "开启时会清理账户中的商人购买记录。" }),
    boolean("noNodeEntryFees", "取消节点入场费", "进入节点不消耗入场资源。", "任务与限制"),
    boolean("noDeathMarks", "移除死亡标记", "不会获得或保留死亡标记。", "任务与限制", { warning: "开启时会清理死亡标记和相关追杀状态。" }),
    boolean("noKimCooldowns", "取消 KIM 冷却", "取消 KIM 对话和礼物冷却。", "任务与限制", { warning: "开启时会清理账户中的 KIM 冷却时间。" }),
    boolean("noBlessingCooldown", "取消祝福冷却", "祝福技能可以立即再次使用。", "任务与限制"),

    boolean("missionsCanGiveAllRelics", "任务可掉落所有遗物", "任务奖励池可以包含所有遗物。", "遗物与奖励"),
    boolean("exceptionalRelicsAlwaysGiveBronzeReward", "精致遗物固定铜奖励", "精致遗物始终给出铜级奖励。", "遗物与奖励"),
    boolean("flawlessRelicsAlwaysGiveSilverReward", "无暇遗物固定银奖励", "无暇遗物始终给出银级奖励。", "遗物与奖励"),
    boolean("radiantRelicsAlwaysGiveGoldReward", "光辉遗物固定金奖励", "光辉遗物始终给出金级奖励。", "遗物与奖励"),
    boolean("claimingBlueprintRefundsIngredients", "领取蓝图返还材料", "领取蓝图时返还制作所需材料。", "遗物与奖励"),
    boolean("instantResourceExtractorDrones", "资源采集器立即完成", "资源采集器部署后立即完成采集。", "遗物与奖励"),
    boolean("noResourceExtractorDronesDamage", "资源采集器不受损", "资源采集器不会受到损坏。", "遗物与奖励"),

    boolean("noNemesis", "禁用 Nemesis", "清除并阻止账户生成 Nemesis。", "Nemesis", { warning: "开启时会清理现有 Nemesis、遗弃奖励和税收记录。" }),
    number("nemesisHenchmenKillsMultiplierGrineer", "Grineer 士兵击杀倍率", "Nemesis Grineer 士兵击杀进度倍率。", "Nemesis", 1, 0, 65535, "x"),
    number("nemesisHenchmenKillsMultiplierCorpus", "Corpus 士兵击杀倍率", "Nemesis Corpus 士兵击杀进度倍率。", "Nemesis", 1, 0, 65535, "x"),
    number("nemesisAntivirusGainMultiplier", "Antivirus 获取倍率", "Nemesis Antivirus 获取倍率。", "Nemesis", 1, 0, 65535, "x"),
    number("nemesisHintProgressMultiplierGrineer", "Grineer 线索倍率", "Nemesis Grineer 线索进度倍率。", "Nemesis", 1, 0, 65535, "x"),
    number("nemesisHintProgressMultiplierCorpus", "Corpus 线索倍率", "Nemesis Corpus 线索进度倍率。", "Nemesis", 1, 0, 65535, "x"),
    number("nemesisTaxRateReductionPercent", "Nemesis 税率减免", "Nemesis 税率减少的百分比。", "Nemesis", 0, 0, 100, "%"),
    number("nemesisExtraWeapon", "Nemesis 额外武器", "Nemesis 额外武器配置值。", "Nemesis", 0, 0, 65535),

    number("spoofMasteryRank", "伪装精通段位", "对需要精通段位的检查使用指定值，-1 表示关闭。", "高级", -1, -1, 65535),
    number("dailyTributeRewardMultiplier", "每日献礼奖励倍率", "每日献礼奖励数量倍率。", "高级", 1, 1, 1000000, "x"),
    number("relicRewardItemCountMultiplier", "遗物奖励数量倍率", "遗物奖励物品数量倍率。", "高级", 1, 1, 1000000, "x"),
    number("teralystCapturePlatinumBonus", "Teralyst 捕获白金奖励", "捕获 Teralyst 时额外获得的白金。", "高级", 0, 0, 1000000),
    number("gantulystCapturePlatinumBonus", "Gantulyst 捕获白金奖励", "捕获 Gantulyst 时额外获得的白金。", "高级", 0, 0, 1000000),
    number("hydrolystCapturePlatinumBonus", "Hydrolyst 捕获白金奖励", "捕获 Hydrolyst 时额外获得的白金。", "高级", 0, 0, 1000000),
    number("nightwaveStandingMultiplier", "午夜电波声望倍率", "午夜电波声望获取倍率。", "高级", 1, 1, 1000000, "x"),
    boolean("tradesDontTouchInventory", "交易不修改库存", "交易接口只返回结果，不改变库存。", "高级", { warning: "仅适用于 API 调试和机器人开发。" })
];

export const ACCOUNT_CHEAT_KEYS = accountCheatDefinitions.map(definition => `accountCheats.${definition.key}`);

export const accountCheatCategories = [...new Set(accountCheatDefinitions.map(definition => definition.category))];
