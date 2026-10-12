<script setup lang="ts">
import { computed, ref } from "vue";
import {
    ArrowRightOutlined,
    DatabaseOutlined,
    GiftOutlined,
    ReloadOutlined,
    SafetyCertificateOutlined,
    SettingOutlined,
    ThunderboltOutlined,
    UserOutlined
} from "@ant-design/icons-vue";
import type { AdminOverviewResponse, Inventory } from "../api";
import { getInventoryCategories, getTopInventoryItems } from "../inventoryOverview";

const props = defineProps<{
    displayName: string;
    inventory?: Inventory;
    connected: boolean;
    isAdmin: boolean;
    globalStats?: AdminOverviewResponse;
    canGrant: boolean;
    loading: boolean;
    error: string;
    updatedAt?: Date;
    currencies: { key: string; label: string; name: string; icon: string; color: string }[];
}>();
const emit = defineEmits<{ refresh: []; navigate: [view: string] }>();
const selectedCategory = ref<string>();
const groups = computed(() => getInventoryCategories(props.inventory));
const total = computed(() => groups.value.reduce((sum, item) => sum + item.count, 0));
const activeGroup = computed(() => groups.value.find(item => item.key === selectedCategory.value));
const topItems = computed(() => getTopInventoryItems(props.inventory));
const circumference = 2 * Math.PI * 86;
const segments = computed(() => {
    let offset = 0;
    return groups.value.filter(item => item.count > 0).map(item => {
        const length = total.value ? item.count / total.value * circumference : 0;
        const segment = { ...item, length, offset };
        offset += length;
        return segment;
    });
});
const timestamp = computed(() => props.updatedAt?.toLocaleTimeString("zh-CN", { hour12: false }) ?? "尚未同步");
const number = (value: number): string => value.toLocaleString("zh-CN");
const balance = (key: string): string => {
    const value = props.inventory?.[key];
    return typeof value === "number" && Number.isFinite(value) ? number(value) : props.inventory ? "0" : "—";
};
const percentage = (count: number): string => total.value ? `${(count / total.value * 100).toFixed(1)}%` : "0%";
const selectCategory = (key: string): void => {
    selectedCategory.value = selectedCategory.value === key ? undefined : key;
};
</script>

<template>
    <section class="overview-page" aria-label="账户概览">
        <header class="overview-heading">
            <div>
                <div class="overview-kicker"><span></span>{{ isAdmin ? '管理员工作空间' : '你的工作空间' }}</div>
                <h1>{{ isAdmin ? '全服概览' : '账户概览' }}<span class="heading-period">.</span></h1>
                <p v-if="isAdmin">汇总全部玩家的账户、资产、库存与 Mod 数据，掌握服务器整体状态。</p>
                <p v-else>欢迎回来，<strong>{{ displayName }}</strong>。在这里掌握你的账户资产与库存。</p>
            </div>
            <div class="overview-refresh">
                <span class="snapshot-time">{{ updatedAt ? `最近同步 ${timestamp}` : '等待首次同步' }}</span>
                <a-button type="primary" size="large" :loading="loading" @click="emit('refresh')"><ReloadOutlined />刷新数据</a-button>
            </div>
        </header>
        <a-alert v-if="error" :message="error" type="error" show-icon class="overview-error" />

        <div v-if="isAdmin && globalStats" class="global-stat-grid" aria-label="全服统计">
            <article><span>玩家账户</span><strong>{{ number(globalStats.players.total) }}</strong><small>{{ number(globalStats.players.active) }} 个账户近 30 天登录</small></article>
            <article><span>已有库存</span><strong>{{ number(globalStats.players.withInventory) }}</strong><small>已建立库存数据的账户</small></article>
            <article><span>库存物品数量</span><strong>{{ number(globalStats.stats.inventoryQuantity) }}</strong><small>{{ number(globalStats.stats.uniqueItemTypes) }} 种物品类型</small></article>
            <article><span>全服 Mod 实例</span><strong>{{ number(globalStats.stats.totalModInstances) }}</strong><small>{{ number(globalStats.stats.uniqueModTypes) }} 种已持有 Mod</small></article>
        </div>

        <div class="balance-grid" :aria-label="isAdmin ? '全服货币总量' : '账户余额'">
            <article v-for="(currency, index) in currencies" :key="currency.key" class="balance-card" :class="{ 'balance-featured': index === 0 }">
                <div class="balance-heading"><span class="balance-label">{{ currency.label }}</span><span class="balance-symbol" :style="{ color: currency.color, background: `${currency.color}12` }">{{ currency.icon }}</span></div>
                <strong class="balance-number">{{ balance(currency.key) }}</strong>
                <div class="balance-footer"><span>{{ currency.name }}</span><span>{{ isAdmin ? '全服总量' : '账户余额' }}</span></div>
            </article>
        </div>

        <div class="overview-charts">
            <article class="overview-panel ranking-panel">
                <div class="overview-panel-heading"><div><h2>物品持有排行</h2><p>{{ isAdmin ? '全部玩家材料与资源中，持有数量最多的 5 种物品' : '材料与资源中，持有数量最多的 5 种物品' }}</p></div><span class="chart-chip">TOP 5</span></div>
                <a-skeleton v-if="!inventory && loading" active :paragraph="{ rows: 5 }" />
                <div v-else-if="topItems.length" class="ranking-chart" role="list" aria-label="物品持有数量排行">
                    <div v-for="(item, index) in topItems" :key="item.type" class="ranking-item" role="listitem">
                        <div class="ranking-label"><span class="ranking-index">{{ String(index + 1).padStart(2, '0') }}</span><a-tooltip :title="item.type"><span class="ranking-name" tabindex="0">{{ item.label }}</span></a-tooltip><strong>{{ number(item.count) }}<span> 个</span></strong></div>
                        <div class="ranking-track" role="meter" :aria-label="item.label" :aria-valuenow="item.count" :aria-valuemin="0" :aria-valuemax="topItems[0]!.count"><div :style="{ width: `${item.count / topItems[0]!.count * 100}%`, opacity: 1 - index * .1 }"></div></div>
                    </div>
                </div>
                <a-empty v-else :description="inventory ? '暂无材料与资源' : '库存数据尚未加载'" class="overview-empty" />
                <div class="chart-footnote"><span>依据当前库存数量排序</span><a-button type="link" @click="emit('navigate', 'inventory')">查看库存<ArrowRightOutlined /></a-button></div>
            </article>

            <article class="overview-panel distribution-panel">
                <div class="overview-panel-heading"><div><h2>库存构成</h2><p>{{ isAdmin ? '按全部玩家持有数量统计库存分布' : '按物品条目统计，了解你的收藏分布' }}</p></div><DatabaseOutlined class="panel-heading-icon" /></div>
                <a-skeleton v-if="!inventory && loading" active :paragraph="{ rows: 5 }" />
                <template v-else-if="total">
                    <div class="distribution-body">
                        <div class="donut-wrap">
                            <svg class="inventory-donut" viewBox="0 0 220 220" role="img" :aria-label="`库存构成，共 ${total} 条物品记录`">
                                <circle cx="110" cy="110" r="86" fill="none" stroke="#edf1ee" stroke-width="23" />
                                <circle v-for="segment in segments" :key="segment.key" cx="110" cy="110" r="86" fill="none" :stroke="segment.color" stroke-width="23" :stroke-dasharray="`${Math.max(0, segment.length - (segments.length > 1 ? 3 : 0))} ${circumference}`" :stroke-dashoffset="-segment.offset" transform="rotate(-90 110 110)" :opacity="selectedCategory && selectedCategory !== segment.key ? .25 : 1">
                                    <title>{{ segment.label }}：{{ number(segment.count) }} 条（{{ percentage(segment.count) }}）</title>
                                </circle>
                            </svg>
                            <div class="donut-center" aria-live="polite"><strong>{{ number(activeGroup?.count ?? total) }}</strong><span>{{ activeGroup?.label ?? '物品条目' }}</span></div>
                        </div>
                        <div class="distribution-legend" aria-label="库存分类，点击查看数量">
                            <button v-for="group in groups" :key="group.key" type="button" :aria-pressed="selectedCategory === group.key" :class="{ selected: selectedCategory === group.key }" @click="selectCategory(group.key)">
                                <span class="legend-dot" :style="{ background: group.color }"></span><span class="legend-name">{{ group.label }}</span><strong>{{ number(group.count) }}</strong><span class="legend-percent">{{ percentage(group.count) }}</span>
                            </button>
                        </div>
                    </div>
                </template>
                <a-empty v-else :description="inventory ? '暂无可统计的库存物品' : '库存数据尚未加载'" class="overview-empty" />
                <div class="chart-footnote"><span>外观装饰单独归类，其他物品包括蓝图与消耗品</span><span>{{ groups.filter(group => group.count > 0).length }} 个分类</span></div>
            </article>
        </div>

        <div class="overview-bottom">
            <article class="overview-panel shortcuts-panel">
                <div class="overview-panel-heading"><div><h2>从这里开始</h2><p>常用操作，一步直达</p></div><ThunderboltOutlined class="panel-heading-icon" /></div>
                <div class="overview-shortcuts">
                    <button type="button" @click="emit('navigate', 'inventory')"><span class="shortcut-icon"><DatabaseOutlined /></span><span><strong>{{ isAdmin ? '浏览全服库存' : '浏览库存' }}</strong><small>搜索与查看物品</small></span><ArrowRightOutlined /></button>
                    <button v-if="!isAdmin" type="button" :disabled="!canGrant" @click="emit('navigate', 'grants')"><span class="shortcut-icon amber"><GiftOutlined /></span><span><strong>发放中心</strong><small>{{ canGrant ? '添加货币与物品' : '暂无发放权限' }}</small></span><ArrowRightOutlined /></button>
                    <button v-else type="button" @click="emit('navigate', 'accounts')"><span class="shortcut-icon amber"><UserOutlined /></span><span><strong>管理玩家账户</strong><small>选择目标账户进行库存和 Mod 操作</small></span><ArrowRightOutlined /></button>
                    <button v-if="isAdmin" type="button" @click="emit('navigate', 'admin')"><span class="shortcut-icon blue"><SettingOutlined /></span><span><strong>管理后台</strong><small>倍率与世界配置</small></span><ArrowRightOutlined /></button>
                </div>
            </article>
            <article class="overview-panel session-panel">
                <div class="session-title"><SafetyCertificateOutlined /><h2>{{ isAdmin ? '管理员视角' : '当前会话' }}</h2><span :class="{ disconnected: !connected }"><i></i>{{ connected ? '已连接' : '重连中' }}</span></div>
                <dl><div><dt>{{ isAdmin ? '统计范围' : '账户身份' }}</dt><dd>{{ isAdmin ? '全部玩家' : '普通账户' }}</dd></div><div><dt>{{ isAdmin ? '数据来源' : '库存同步' }}</dt><dd>{{ loading ? '正在更新' : error ? '同步失败' : isAdmin ? '全服聚合' : updatedAt ? '已同步' : '等待同步' }}</dd></div><div><dt>更新于</dt><dd>{{ timestamp }}</dd></div></dl>
            </article>
        </div>
    </section>
</template>

<style scoped>
.overview-page { --ink: #223e32; --secondary: #65786e; --line: #e3ebe5; font-size: 15px; }
.overview-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 28px; margin-bottom: 28px; }
.overview-kicker { display: flex; align-items: center; gap: 9px; color: #537969; font-size: 14px; font-weight: 600; }
.overview-kicker span { width: 7px; height: 7px; border-radius: 50%; background: #6fae92; }
.overview-heading h1 { margin: 9px 0 10px; color: var(--ink); font-size: clamp(32px, 3vw, 42px); font-weight: 650; line-height: 1.2; letter-spacing: -.03em; }
.heading-period { color: #4a9a7d; }
.overview-heading p { margin: 0; color: var(--secondary); font-size: 16px; line-height: 1.65; }
.overview-heading p strong { color: #365747; font-weight: 600; overflow-wrap: anywhere; }
.overview-refresh { display: flex; flex: 0 0 auto; align-items: center; gap: 18px; padding-bottom: 3px; }
.snapshot-time { color: #788c80; font-size: 14px; font-variant-numeric: tabular-nums; }
.overview-refresh :deep(.ant-btn) { height: 44px; padding: 0 19px; font-size: 15px; box-shadow: 0 4px 10px #237b6614; }
.overview-error { margin-bottom: 20px; }
.global-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
.global-stat-grid article { min-width: 0; padding: 17px 19px; border: 1px solid #dce7df; border-radius: 12px; background: #fff; }
.global-stat-grid span, .global-stat-grid small { display: block; color: #708679; font-size: 13px; }
.global-stat-grid strong { display: block; margin: 7px 0 5px; color: #244b37; font-size: 26px; font-weight: 650; line-height: 1.2; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.global-stat-grid small { color: #92a197; font-size: 12px; overflow-wrap: anywhere; }
.balance-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; margin-bottom: 24px; }
.balance-card { min-width: 0; padding: 22px 24px 20px; border: 1px solid var(--line); border-radius: 16px; background: #fff; box-shadow: 0 4px 14px #284c3505; }
.balance-card.balance-featured { border-color: #c6dfd1; background: linear-gradient(110deg, #e3f0e7, #f1f7ed); }
.balance-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.balance-label { color: #4a6958; font-size: 16px; font-weight: 600; }
.balance-symbol { display: grid; width: 36px; height: 36px; flex: 0 0 auto; place-items: center; border-radius: 11px; font-size: 12px; font-weight: 750; }
.balance-number { display: block; margin: 12px 0 16px; color: var(--ink); font-size: clamp(26px, 2.5vw, 36px); font-weight: 650; line-height: 1.2; letter-spacing: -.03em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.balance-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #789083; font-size: 13px; }
.overview-charts { display: grid; grid-template-columns: minmax(0, 1.13fr) minmax(0, 1fr); gap: 22px; margin-bottom: 22px; }
.overview-charts > article { display: flex; flex-direction: column; }
.overview-panel { min-width: 0; padding: 26px; border: 1px solid var(--line); border-radius: 16px; background: #fff; box-shadow: 0 4px 14px #284c3505; }
.overview-panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 25px; }
.overview-panel h2 { margin: 0; color: var(--ink); font-size: 21px; font-weight: 650; line-height: 1.35; letter-spacing: -.025em; }
.overview-panel-heading p { margin: 7px 0 0; color: var(--secondary); font-size: 14px; line-height: 1.65; }
.chart-chip { flex: 0 0 auto; margin-top: 2px; padding: 5px 9px; border-radius: 7px; color: #5c826f; background: #edf5ef; font-size: 12px; font-weight: 650; }
.panel-heading-icon { margin-top: 5px; color: #8aab98; font-size: 21px; }
.ranking-chart { display: grid; flex: 1; align-content: space-between; gap: 19px; padding: 0 0 7px; }
.ranking-label { display: flex; min-width: 0; align-items: center; gap: 11px; margin-bottom: 9px; font-size: 15px; }
.ranking-index { color: #839b8d; font-size: 13px; font-variant-numeric: tabular-nums; }
.ranking-name { min-width: 0; flex: 1; overflow: hidden; color: #456151; text-overflow: ellipsis; white-space: nowrap; }
.ranking-label strong { flex: 0 0 auto; color: #344e40; font-size: 15px; font-weight: 650; font-variant-numeric: tabular-nums; }
.ranking-label strong span { color: #8a9c90; font-size: 13px; font-weight: 400; }
.ranking-track { height: 11px; margin-left: 27px; overflow: hidden; border-radius: 4px; background: #f0f5f1; }
.ranking-track > div { height: 100%; border-radius: 4px; background: #3b8c70; transition: width .3s ease; }
.chart-footnote { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; min-height: 39px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #edf1ee; color: #748b7c; font-size: 13px; line-height: 1.5; }
.chart-footnote :deep(.ant-btn) { height: auto; padding: 0; font-size: 14px; }
.distribution-body { display: flex; flex: 1; min-height: 279px; align-items: center; justify-content: center; gap: 12px; }
.donut-wrap { position: relative; width: 45%; max-width: 240px; flex: 0 0 auto; }
.inventory-donut { display: block; width: 100%; height: auto; }
.inventory-donut circle { transition: opacity .2s ease; }
.donut-center { position: absolute; inset: 28%; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 5px; text-align: center; pointer-events: none; }
.donut-center strong { color: var(--ink); font-size: clamp(22px, 2.3vw, 34px); font-weight: 650; line-height: 1.2; font-variant-numeric: tabular-nums; }
.donut-center span { color: #718778; font-size: 13px; }
.distribution-legend { display: grid; min-width: 0; flex: 1; gap: 9px; }
.distribution-legend button { display: flex; min-width: 0; align-items: center; gap: 9px; padding: 7px 5px; border: 0; border-radius: 7px; color: #5b7162; background: transparent; font-size: 14px; cursor: pointer; text-align: left; }
.distribution-legend button:hover, .distribution-legend button.selected { background: #edf5ef; }
.distribution-legend button:focus-visible, .overview-shortcuts button:focus-visible { outline: 2px solid #237b66; outline-offset: 3px; }
.legend-dot { width: 9px; height: 9px; flex: 0 0 auto; border-radius: 3px; }
.legend-name { flex: 1; white-space: nowrap; }
.distribution-legend strong { color: #3a5545; font-weight: 650; font-variant-numeric: tabular-nums; }
.legend-percent { width: 45px; color: #819687; font-size: 12px; text-align: right; font-variant-numeric: tabular-nums; }
.overview-empty { display: flex; min-height: 279px; align-items: center; justify-content: center; flex-direction: column; }
.overview-empty :deep(.ant-empty-description) { font-size: 15px; color: #718778; }
.overview-bottom { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(280px, 1fr); gap: 22px; }
.overview-shortcuts { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); }
.overview-shortcuts button { display: flex; min-width: 0; min-height: 96px; align-items: center; gap: 12px; padding: 14px; border: 1px solid #e1ebe4; border-radius: 12px; background: #fbfdfb; cursor: pointer; text-align: left; transition: border-color .2s ease, background .2s ease; }
.overview-shortcuts button:hover { border-color: #9ac5ad; background: #f0f7f1; }
.overview-shortcuts button:disabled { opacity: .55; cursor: not-allowed; }
.shortcut-icon { display: grid; width: 36px; height: 36px; flex: 0 0 auto; place-items: center; border-radius: 10px; color: #387b60; background: #e7f1ea; font-size: 18px; }
.shortcut-icon.amber { color: #a78136; background: #f5edde; }
.shortcut-icon.blue { color: #587f9c; background: #e8f0f6; }
.overview-shortcuts button > span:nth-child(2) { min-width: 0; flex: 1; }
.overview-shortcuts strong { display: block; color: #385945; font-size: 15px; font-weight: 600; }
.overview-shortcuts small { display: block; margin-top: 7px; color: #7b9181; font-size: 13px; line-height: 1.5; }
.overview-shortcuts button > .anticon:last-child { display: none; }
.session-panel { color: #c6ded0; background: #163d31; border-color: #163d31; }
.session-title { display: flex; align-items: center; gap: 9px; }
.session-title > .anticon { color: #a4cfb6; font-size: 21px; }
.session-title h2 { flex: 1; color: #eff8f0; }
.session-title > span:last-child { display: flex; align-items: center; gap: 6px; color: #b6e0c1; font-size: 13px; }
.session-title i { width: 6px; height: 6px; border-radius: 50%; background: #97d9ad; }
.session-title .disconnected { color: #eaca8e !important; }
.session-title .disconnected i { background: #eaca8e; }
.session-panel dl { display: grid; gap: 12px; margin: 20px 0 0; }
.session-panel dl > div { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
.session-panel dt { color: #94b5a0; }
.session-panel dd { margin: 0; color: #e1eee3; font-variant-numeric: tabular-nums; }
@media (max-width: 1250px) {
    .overview-refresh { align-items: flex-end; flex-direction: column-reverse; gap: 9px; }
    .overview-charts { grid-template-columns: 1fr 1fr; }
    .distribution-body { flex-direction: column; gap: 9px; }
    .donut-wrap { width: 190px; }
    .distribution-legend { width: 100%; grid-template-columns: 1fr 1fr; gap: 4px 8px; }
    .legend-percent { display: none; }
    .ranking-chart { flex: 1; align-content: space-evenly; }
    .overview-bottom { grid-template-columns: 1.5fr 1fr; }
}
@media (max-width: 820px) {
    .global-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .overview-heading { align-items: flex-start; }
    .balance-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .overview-charts, .overview-bottom { grid-template-columns: 1fr; }
    .distribution-body { flex-direction: row; }
    .distribution-legend { grid-template-columns: 1fr; }
    .legend-percent { display: block; }
    .overview-shortcuts { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .overview-shortcuts button { align-items: flex-start; flex-direction: column; }
}
@media (max-width: 600px) {
    .global-stat-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
    .global-stat-grid article { padding: 14px; }
    .global-stat-grid strong { font-size: 22px; }
    .overview-heading { flex-direction: column; gap: 20px; }
    .overview-heading h1 { font-size: 34px; }
    .overview-refresh { width: 100%; flex-direction: row-reverse; align-items: center; justify-content: space-between; }
    .overview-panel { padding: 22px; }
    .balance-card { padding: 18px; }
    .balance-number { font-size: 28px; }
    .balance-footer { align-items: flex-start; flex-direction: column; gap: 4px; }
    .distribution-body { flex-direction: column; }
    .donut-wrap { width: 220px; }
    .distribution-legend { width: 100%; }
    .overview-shortcuts { grid-template-columns: 1fr; }
    .overview-shortcuts button { min-height: 80px; flex-direction: row; align-items: center; }
    .overview-shortcuts button > .anticon:last-child { display: block; color: #779d85; }
    .chart-footnote { font-size: 13px; }
}
@media (prefers-reduced-motion: reduce) {
    .ranking-track > div, .inventory-donut circle { transition: none; }
}
</style>
