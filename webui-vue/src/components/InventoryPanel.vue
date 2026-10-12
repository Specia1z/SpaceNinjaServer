<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { AppstoreOutlined, ArrowRightOutlined, CopyOutlined, DatabaseOutlined, DeleteOutlined, FilterOutlined, ReloadOutlined, SearchOutlined, UnorderedListOutlined } from "@ant-design/icons-vue";
import { message, Modal } from "ant-design-vue";
import { deleteManagedAccountInventoryItem, getItemCatalog, type Inventory } from "../api";
import { inventoryCategories } from "../inventoryOverview";
import { getInventoryRows, type InventoryRow } from "../inventoryItems";
import InventoryItemIcon from "./InventoryItemIcon.vue";

const props = defineProps<{
    inventory?: Inventory;
    loading: boolean;
    error: string;
    updatedAt?: Date;
    editable?: boolean;
    globalView?: boolean;
    authz?: string;
    targetAccountId?: string;
}>();
const emit = defineEmits<{ refresh: [] }>();
const names = ref<Record<string, string>>({});
const icons = ref<Record<string, string>>({});
const catalogError = ref(false);
const category = ref("all");
const query = ref("");
const sort = ref("name");
const view = ref("list");
const page = ref(1);
const pageSize = 12;
const selectedKey = ref<string>();
const drawerOpen = ref(false);
const rows = computed(() => getInventoryRows(props.inventory, names.value, icons.value));
const categories = computed(() => inventoryCategories.map(group => ({ ...group, count: rows.value.filter(row => row.category === group.key).length })));
const totalQuantity = computed(() => rows.value.reduce((sum, row) => sum + row.count, 0));
const filtered = computed(() => {
    const search = query.value.trim().toLocaleLowerCase();
    return rows.value.filter(row => (category.value === "all" || row.category === category.value) &&
        (!search || [row.name, row.type, row.id ?? ""].some(value => value.toLocaleLowerCase().includes(search))))
        .sort((a, b) => sort.value === "quantity" ? b.count - a.count || a.name.localeCompare(b.name, "zh-CN") : a.name.localeCompare(b.name, "zh-CN", { numeric: true }) || a.key.localeCompare(b.key));
});
const pageRows = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const selected = computed(() => rows.value.find(row => row.key === selectedKey.value));
const activeTitle = computed(() => category.value === "all" ? "全部物品" : categories.value.find(group => group.key === category.value)?.label);
const number = (value: number): string => value.toLocaleString("zh-CN");
const timestamp = computed(() => props.updatedAt?.toLocaleTimeString("zh-CN", { hour12: false }) ?? "尚未同步");
const openDetails = (row: InventoryRow): void => { selectedKey.value = row.key; drawerOpen.value = true; };
const copy = async (value: string): Promise<void> => {
    try { await navigator.clipboard.writeText(value); message.success("已复制物品路径"); }
    catch { message.error("复制失败，请在详情中选中路径手动复制"); }
};
const deleteItem = (row: InventoryRow): void => {
    if (!props.editable || !props.authz || !props.targetAccountId) return;
    Modal.confirm({
        title: "删除库存物品",
        content: `确定删除 ${row.name}${row.id ? "这个实例" : `的 ${number(row.count)} 个库存`}吗？`,
        okText: "删除",
        cancelText: "取消",
        okType: "danger",
        onOk: async () => {
            try {
                await deleteManagedAccountInventoryItem(props.authz!, props.targetAccountId!, {
                    source: row.source,
                    itemType: row.type,
                    itemId: row.id,
                    itemCount: row.count
                });
                message.success(`已删除 ${row.name}`);
                emit("refresh");
            } catch (error) {
                message.error(error instanceof Error ? error.message : String(error));
                throw error;
            }
        }
    });
};
watch([query, category, sort], () => { page.value = 1; });
watch(() => filtered.value.length, length => { page.value = Math.min(page.value, Math.max(1, Math.ceil(length / pageSize))); });
watch(selected, value => { if (!value) drawerOpen.value = false; });
onMounted(async () => {
    try {
        const catalog = await getItemCatalog();
        names.value = catalog.names;
        icons.value = catalog.icons;
    }
    catch { catalogError.value = true; }
});
</script>

<template>
    <section class="inventory-page" :aria-label="globalView ? '全服库存' : '账户库存'">
        <header class="inventory-heading">
            <div><span class="inventory-kicker"><DatabaseOutlined />{{ globalView ? '全服资产库' : '你的物品收藏' }}</span><h1>{{ globalView ? '全服库存' : '库存' }}<span>.</span></h1><p>{{ globalView ? '汇总全部玩家的库存数据，按物品类型搜索和查看。' : '分类浏览、快速搜索，轻松找到每一件物品。' }}</p></div>
            <div class="inventory-refresh"><span>最近同步 {{ timestamp }}</span><a-button type="primary" size="large" :loading="loading" @click="$emit('refresh')"><ReloadOutlined />刷新库存</a-button></div>
        </header>
        <a-alert v-if="error" :message="error" type="error" show-icon class="inventory-alert" />
        <a-alert v-if="catalogError" message="物品名称暂时无法加载，当前显示类型名称；路径搜索仍可使用。" type="info" show-icon class="inventory-alert" />
        <div class="inventory-summary">
            <div><span>物品记录</span><strong>{{ inventory ? number(rows.length) : '—' }}<small> 条</small></strong></div>
            <div><span>持有数量</span><strong>{{ inventory ? number(totalQuantity) : '—' }}<small> 个</small></strong></div>
            <div><span>收藏分类</span><strong>{{ inventory ? categories.filter(group => group.count).length : '—' }}<small> 类</small></strong></div>
            <div class="summary-note"><span class="summary-icon"><AppstoreOutlined /></span><p>{{ globalView ? '全服库存，一目了然。' : '你的收藏，一目了然。' }}<small>{{ globalView ? '相同物品已按全部玩家持有数量合并。' : '装备按实例展示，材料按持有数量展示。' }}</small></p></div>
        </div>
        <nav class="inventory-categories" aria-label="库存分类">
            <button type="button" :aria-pressed="category === 'all'" :class="{ active: category === 'all' }" @click="category = 'all'"><AppstoreOutlined />全部物品<span>{{ number(rows.length) }}</span></button>
            <button v-for="group in categories" :key="group.key" type="button" :aria-pressed="category === group.key" :class="{ active: category === group.key }" @click="category = group.key"><i :style="{ background: group.color }"></i>{{ group.label }}<span>{{ number(group.count) }}</span></button>
        </nav>

        <article class="inventory-browser">
            <div class="inventory-toolbar">
                <div class="inventory-list-title"><h2>{{ activeTitle }}</h2><span>{{ number(filtered.length) }} 条记录</span></div>
                <div class="inventory-filters">
                    <a-input v-model:value="query" allow-clear class="inventory-search" placeholder="搜索名称、物品路径或 ID" aria-label="搜索库存"><template #prefix><SearchOutlined /></template></a-input>
                    <a-select v-model:value="sort" class="inventory-sort" aria-label="物品排序" :options="[{ value: 'name', label: '名称排序' }, { value: 'quantity', label: '数量从高到低' }]" />
                    <a-radio-group v-model:value="view" class="inventory-view" aria-label="库存视图"><a-radio-button value="list" aria-label="列表视图" title="列表视图"><UnorderedListOutlined /></a-radio-button><a-radio-button value="cards" aria-label="卡片视图" title="卡片视图"><AppstoreOutlined /></a-radio-button></a-radio-group>
                </div>
            </div>
            <div v-if="query.trim() || category !== 'all'" class="inventory-filter-note"><FilterOutlined /><span>{{ query.trim() ? `搜索「${query.trim()}」` : activeTitle }} · {{ number(filtered.length) }} 条结果</span><a-button type="link" @click="query = ''; category = 'all'">重置筛选</a-button></div>
            <a-skeleton v-if="loading && !inventory" active :paragraph="{ rows: 7 }" class="inventory-skeleton" />
            <div v-else-if="!filtered.length" class="inventory-empty"><a-empty :description="!inventory ? '库存尚未加载，点击刷新重试' : query || category !== 'all' ? '没有匹配的物品' : globalView ? '全服库存还是空的' : '你的库存还是空的'" /><a-button v-if="query || category !== 'all'" @click="query = ''; category = 'all'">查看全部物品</a-button></div>
            <template v-else>
                <div v-if="view === 'list'" class="inventory-table-wrap">
                     <a-table :data-source="pageRows" :pagination="false" row-key="key" table-layout="fixed" class="inventory-table" :loading="loading">
                         <a-table-column key="name" title="物品" :width="'56%'"><template #default="{ record }"><button type="button" class="inventory-item-main" @click="openDetails(record)"><InventoryItemIcon :color="record.color" :background="`${record.color}16`" :icon="record.icon" /><span class="inventory-item-text"><strong>{{ record.name }}</strong><small>{{ record.type }}</small></span></button></template></a-table-column>
                        <a-table-column key="category" title="分类"><template #default="{ record }"><span class="inventory-category-pill"><i :style="{ background: record.color }"></i>{{ record.categoryLabel }}</span></template></a-table-column>
                        <a-table-column key="count" title="数量" align="right"><template #default="{ record }"><strong class="inventory-count">{{ number(record.count) }}</strong></template></a-table-column>
                        <a-table-column key="actions" title="详情" align="right"><template #default="{ record }"><a-button type="text" class="inventory-details-button" :aria-label="`查看 ${record.name} 详情`" @click="openDetails(record)"><ArrowRightOutlined /></a-button></template></a-table-column>
                    </a-table>
                </div>
                <div class="inventory-card-grid" :class="{ 'mobile-list': view === 'list' }">
                         <article v-for="item in pageRows" :key="item.key" class="inventory-item-card" role="button" tabindex="0" @click="openDetails(item)" @keydown.enter.prevent="openDetails(item)">
                             <div class="item-card-top"><InventoryItemIcon :color="item.color" :background="`${item.color}16`" :icon="item.icon" /><span class="inventory-category-pill"><i :style="{ background: item.color }"></i>{{ item.categoryLabel }}</span><span class="item-card-actions"><a-button v-if="editable" type="text" danger aria-label="删除库存物品" title="删除库存物品" @click.stop="deleteItem(item)"><DeleteOutlined /></a-button><ArrowRightOutlined /></span></div>
                        <strong class="item-card-name">{{ item.name }}</strong><span class="item-card-path">{{ item.type }}</span>
                        <div class="item-card-footer"><span>{{ item.id ? '独立物品实例' : '持有数量' }}</span><strong>{{ number(item.count) }}<small> 个</small></strong></div>
                     </article>
                </div>
                <footer class="inventory-pagination"><span>显示 {{ number((page - 1) * pageSize + 1) }}–{{ number(Math.min(page * pageSize, filtered.length)) }} 条，共 {{ number(filtered.length) }} 条</span><a-pagination v-model:current="page" :total="filtered.length" :page-size="pageSize" :show-size-changer="false" :show-less-items="true" /></footer>
            </template>
        </article>
        <a-drawer v-model:open="drawerOpen" title="物品详情" width="min(480px, 100vw)" root-class-name="inventory-detail-drawer">
            <template v-if="selected">
                 <div class="item-detail-heading"><InventoryItemIcon :color="selected.color" :background="`${selected.color}16`" :icon="selected.icon" large /><h2>{{ selected.name }}</h2><span class="inventory-category-pill">{{ selected.categoryLabel }}</span></div>
                <dl class="item-detail-facts"><div><dt>持有数量</dt><dd>{{ number(selected.count) }}</dd></div><div v-if="selected.xp !== undefined"><dt>累计经验</dt><dd>{{ number(selected.xp) }}</dd></div><div v-if="selected.polarized !== undefined"><dt>极化次数</dt><dd>{{ number(selected.polarized) }}</dd></div><div v-if="selected.rank !== undefined"><dt>等级</dt><dd>{{ selected.rank }}</dd></div><div><dt>库存字段</dt><dd>{{ selected.source }}</dd></div></dl>
                <div class="item-detail-path"><h3>物品路径</h3><code>{{ selected.type }}</code><a-button @click="copy(selected.type)"><CopyOutlined />复制路径</a-button></div>
                <div v-if="selected.id" class="item-detail-path"><h3>实例 ID</h3><code>{{ selected.id }}</code></div>
            </template>
        </a-drawer>
    </section>
</template>

<style scoped>
.inventory-page { color: #254332; font-size: 15px; }
.inventory-heading { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-bottom: 27px; }
.inventory-kicker { display: flex; align-items: center; gap: 8px; color: #597e68; font-size: 14px; font-weight: 600; }
.inventory-heading h1 { margin: 9px 0 10px; color: #223e32; font-size: clamp(34px, 3vw, 42px); line-height: 1.2; font-weight: 650; letter-spacing: -.025em; }
.inventory-heading h1 > span { color: #539e7e; }
.inventory-heading p { margin: 0; color: #698172; font-size: 16px; line-height: 1.65; }
.inventory-refresh { display: flex; align-items: center; gap: 16px; }
.inventory-refresh > span { color: #7b9183; font-size: 14px; }
.inventory-refresh :deep(.ant-btn) { height: 44px; font-size: 15px; }
.inventory-alert { margin-bottom: 18px; }
.inventory-summary { display: grid; grid-template-columns: 1fr 1fr 1fr 1.5fr; margin-bottom: 24px; padding: 26px 30px; border: 1px solid #d6e4d9; border-radius: 16px; background: linear-gradient(100deg, #e7f1e9, #f0f6ed); }
.inventory-summary > div { min-width: 0; padding: 0 26px; border-right: 1px solid #d4e2d7; }
.inventory-summary > div:first-child { padding-left: 0; }
.inventory-summary > div > span { display: block; color: #678371; font-size: 14px; }
.inventory-summary > div > strong { display: block; margin-top: 8px; color: #274c38; font-size: 32px; line-height: 1.2; font-weight: 650; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.inventory-summary small { color: #7c9383; font-size: 14px; font-weight: 400; }
.inventory-summary > .summary-note { display: flex; align-items: center; gap: 15px; padding-right: 0; border: 0; }
.inventory-summary .summary-icon { display: grid; width: 44px; height: 44px; flex: 0 0 auto; place-items: center; color: #5c8d71; font-size: 26px; }
.summary-note p { margin: 0; color: #486a53; font-size: 16px; line-height: 1.6; }
.summary-note small { display: block; margin-top: 3px; font-size: 13px; line-height: 1.6; }
.inventory-categories { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 24px; }
.inventory-categories button { display: flex; align-items: center; gap: 9px; min-height: 44px; padding: 8px 15px; border: 1px solid #dfe8e1; border-radius: 10px; color: #597362; background: #fff; font-size: 15px; cursor: pointer; }
.inventory-categories button.active { color: #f1faf3; border-color: #237b66; background: #237b66; }
.inventory-categories button > span { min-width: 23px; padding: 1px 5px; border-radius: 5px; background: #edf4ee; color: #6b8775; font-size: 12px; }
.inventory-categories button.active > span { color: #ddf0e1; background: #ffffff20; }
.inventory-categories i, .inventory-category-pill i { width: 7px; height: 7px; flex: 0 0 auto; border-radius: 3px; }
.inventory-browser { overflow: hidden; border: 1px solid #dfe8e1; border-radius: 16px; background: #fff; box-shadow: 0 5px 20px #29423806; }
.inventory-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 24px 26px; }
.inventory-list-title { display: flex; flex: 0 0 auto; align-items: center; gap: 12px; }
.inventory-list-title h2 { margin: 0; color: #294936; font-size: 21px; font-weight: 650; }
.inventory-list-title > span { color: #78917e; font-size: 13px; }
.inventory-filters { display: flex; min-width: 0; align-items: center; gap: 10px; }
.inventory-search { width: 290px; }
.inventory-search :deep(.ant-input-prefix) { margin-right: 7px; color: #8fa699; }
.inventory-sort { width: 150px; flex-shrink: 0; }
.inventory-view { flex-shrink: 0; }
.inventory-view :deep(.ant-radio-button-wrapper) { padding: 0 13px; }
.inventory-filter-note { display: flex; align-items: center; gap: 8px; padding: 0 26px 18px; color: #6e8977; font-size: 14px; overflow-wrap: anywhere; }
.inventory-filter-note > span:not(.anticon) { min-width: 0; flex: 1; }
.inventory-filter-note :deep(.ant-btn) { padding: 0; }
.inventory-table :deep(.ant-table-thead > tr > th) { background: #f5f8f5; color: #6c8475; font-size: 14px; font-weight: 600; padding: 14px 24px; }
.inventory-table :deep(.ant-table-tbody > tr > td) { padding: 16px 24px; border-bottom-color: #eef3ee; }
.inventory-item-main { display: flex; align-items: center; gap: 14px; width: 100%; padding: 0; border: 0; background: transparent; cursor: pointer; text-align: left; }
.inventory-item-text { min-width: 0; flex: 1; }
.inventory-item-text > strong { display: block; color: #344f3f; font-size: 16px; font-weight: 600; overflow-wrap: anywhere; }
.inventory-item-text > small { display: block; max-width: 420px; margin-top: 5px; overflow: hidden; color: #8b9f91; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.inventory-category-pill { display: inline-flex; align-items: center; gap: 7px; padding: 5px 8px; border-radius: 6px; color: #6e8977; background: #f4f7f4; font-size: 13px; white-space: nowrap; }
.inventory-count { color: #315741; font-size: 17px; font-weight: 650; font-variant-numeric: tabular-nums; }
.inventory-details-button { color: #6c997e; }
.inventory-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; padding: 0 26px 24px; }
.inventory-card-grid.mobile-list { display: none; }
.inventory-item-card { min-width: 0; padding: 19px; border: 1px solid #e0e9e2; border-radius: 13px; background: #fcfdfb; cursor: pointer; text-align: left; transition: border-color .2s ease; }
.inventory-item-card:hover { border-color: #90bba0; background: #f6fbf6; }
.item-card-top { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
.item-card-top > .anticon:last-child { margin-left: auto; color: #93b29d; }
.item-card-actions { display: flex; align-items: center; gap: 3px; margin-left: auto; color: #93b29d; }
.item-card-actions :deep(.ant-btn) { width: 30px; height: 30px; padding: 0; }
.item-card-name { display: block; color: #365440; font-size: 17px; font-weight: 600; overflow-wrap: anywhere; }
.item-card-path { display: block; margin-top: 8px; overflow: hidden; color: #94a398; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.item-card-footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e7eee7; }
.item-card-footer > span { color: #849b89; font-size: 13px; }
.item-card-footer > strong { color: #38583f; font-size: 20px; font-weight: 650; }
.item-card-footer small { color: #849b89; font-size: 13px; font-weight: 400; }
.inventory-pagination { display: flex; justify-content: space-between; align-items: center; gap: 18px; padding: 20px 26px; border-top: 1px solid #e9efe9; }
.inventory-pagination > span { color: #7e9585; font-size: 14px; }
.inventory-empty { display: flex; min-height: 320px; align-items: center; justify-content: center; flex-direction: column; gap: 15px; }
.inventory-empty :deep(.ant-empty-description) { font-size: 16px; color: #748b7a; }
.inventory-skeleton { padding: 15px 26px 30px; }
.item-detail-heading { display: flex; align-items: flex-start; flex-direction: column; gap: 17px; }
.item-detail-heading h2 { margin: 0; color: #294a35; font-size: 25px; font-weight: 650; overflow-wrap: anywhere; }
.item-detail-facts { display: grid; gap: 15px; margin: 26px 0; padding: 22px; border-radius: 12px; background: #f3f7f3; font-size: 15px; }
.item-detail-facts > div { display: flex; justify-content: space-between; gap: 15px; }
.item-detail-facts dt { color: #728778; }
.item-detail-facts dd { margin: 0; color: #355540; overflow-wrap: anywhere; }
.item-detail-path { margin-top: 25px; }
.item-detail-path h3 { margin: 0 0 12px; color: #52755c; font-size: 15px; }
.item-detail-path code { display: block; padding: 14px; border: 1px solid #dfe9e1; border-radius: 8px; color: #6a8371; background: #fafcf9; font-size: 13px; line-height: 1.8; overflow-wrap: anywhere; }
.item-detail-path :deep(.ant-btn) { margin-top: 14px; }
button:focus-visible { outline: 2px solid #237b66; outline-offset: 3px; }
@media (max-width: 1250px) {
    .inventory-toolbar { align-items: stretch; flex-direction: column; }
    .inventory-search { flex: 1; width: auto; }
    .inventory-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .inventory-summary > div:nth-child(3) { border: 0; }
    .inventory-summary > .summary-note { display: none; }
    .inventory-refresh { align-items: flex-end; flex-direction: column-reverse; gap: 8px; }
}
@media (max-width: 820px) {
    .inventory-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .inventory-table :deep(.ant-table-tbody > tr > td), .inventory-table :deep(.ant-table-thead > tr > th) { padding: 15px; }
    .inventory-item-text > small { max-width: 230px; }
}
@media (max-width: 600px) {
    .inventory-heading { align-items: flex-start; flex-direction: column; gap: 19px; }
    .inventory-refresh { width: 100%; align-items: center; flex-direction: row-reverse; justify-content: space-between; }
    .inventory-refresh > span { font-size: 13px; }
    .inventory-summary { padding: 20px 15px; }
    .inventory-summary > div { padding: 0 12px; }
    .inventory-summary > div > strong { font-size: 22px; }
    .inventory-summary > div > span { font-size: 13px; }
    .inventory-summary small { display: block; margin-top: 5px; font-size: 12px; }
    .inventory-categories { gap: 8px; }
    .inventory-categories button { min-height: 40px; padding: 8px 11px; font-size: 14px; }
    .inventory-toolbar { padding: 22px 18px; }
    .inventory-filters { flex-wrap: wrap; }
    .inventory-search { flex: 1 0 100%; }
    .inventory-sort { flex: 1; }
    .inventory-table-wrap { display: none; }
    .inventory-card-grid, .inventory-card-grid.mobile-list { display: grid; grid-template-columns: 1fr; padding: 0 18px 20px; gap: 12px; }
    .inventory-item-card { padding: 18px; }
    .item-card-top { margin-bottom: 15px; }
    .inventory-pagination { align-items: center; flex-direction: column; padding: 20px 10px; }
    .inventory-filter-note { padding: 0 18px 18px; }
}
</style>
