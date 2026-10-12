<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
    CheckCircleOutlined,
    CopyOutlined,
    DeleteOutlined,
    ExperimentOutlined,
    InboxOutlined,
    LockOutlined,
    PlusOutlined,
    SearchOutlined,
    SettingOutlined,
    ThunderboltOutlined
} from "@ant-design/icons-vue";
import { message, Modal } from "ant-design-vue";
import {
    addItems,
    addManagedAccountMod,
    deleteManagedAccountMod,
    getItemCatalog,
    getManagedAccountInventory,
    updateManagedAccountMod,
    updateModFingerprint,
    type CatalogItem,
    type Inventory
} from "../api";

type ModEntry = {
    key: string;
    type: string;
    name: string;
    icon?: string;
    oid?: string;
    count: number;
    rank: number;
    maxRank: number;
    raw: boolean;
    fingerprint: Record<string, unknown>;
};

const props = defineProps<{
    authz: string;
    inventory?: Inventory;
    globalView?: boolean;
    permissions: string[];
    targetAccountId?: string;
    targetAccountName?: string;
}>();
const emit = defineEmits<{ refresh: [] }>();

const names = ref<Record<string, string>>({});
const icons = ref<Record<string, string>>({});
const mods = ref<CatalogItem[]>([]);
const search = ref("");
const filter = ref<"all" | "owned" | "raw">("all");
const selectedKey = ref<string>();
const targetRank = ref<number>(0);
const loading = ref(false);
const catalogError = ref(false);
const targetInventory = ref<Inventory>();
const targetLoading = ref(false);

const canManage = computed(() => !props.globalView && (Boolean(props.targetAccountId) || props.permissions.includes("addItems")));
const currentInventory = computed(() => props.targetAccountId ? targetInventory.value : props.inventory);
const modMeta = computed(() => new Map(mods.value.map(mod => [mod.uniqueName, mod])));
const number = (value: number): string => value.toLocaleString("zh-CN");

const parseFingerprint = (value: unknown): Record<string, unknown> => {
    if (typeof value === "string") {
        try {
            const parsed: unknown = JSON.parse(value);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return { ...(parsed as Record<string, unknown>) };
        } catch {
            return {};
        }
    }
    return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
};

const getOid = (value: unknown): string | undefined => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "$oid" in value && typeof value.$oid === "string") return value.$oid;
    return undefined;
};

const getRank = (fingerprint: Record<string, unknown>): number => {
    const level = fingerprint.lvl ?? fingerprint.rank;
    return typeof level === "number" && Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
};

const getMaxRank = (type: string): number => Math.max(0, modMeta.value.get(type)?.fusionLimit ?? 10);

const entries = computed<ModEntry[]>(() => {
    const result: ModEntry[] = [];
    const rawItems = currentInventory.value?.RawUpgrades;
    if (Array.isArray(rawItems)) {
        for (const [index, value] of rawItems.entries()) {
            if (!value || typeof value !== "object") continue;
            const item = value as Record<string, unknown>;
            if (typeof item.ItemType !== "string") continue;
            const meta = modMeta.value.get(item.ItemType);
            result.push({
                key: `raw-${item.ItemType}-${index}`,
                type: item.ItemType,
                name: names.value[item.ItemType] ?? item.ItemType.split("/").filter(Boolean).at(-1) ?? item.ItemType,
                icon: icons.value[item.ItemType] ?? meta?.icon,
                count: typeof item.ItemCount === "number" ? Math.max(0, item.ItemCount) : 1,
                rank: 0,
                maxRank: getMaxRank(item.ItemType),
                raw: true,
                fingerprint: {}
            });
        }
    }
    const ownedItems = currentInventory.value?.Upgrades;
    if (Array.isArray(ownedItems)) {
        for (const [index, value] of ownedItems.entries()) {
            if (!value || typeof value !== "object") continue;
            const item = value as Record<string, unknown>;
            if (typeof item.ItemType !== "string") continue;
            const fingerprint = parseFingerprint(item.UpgradeFingerprint);
            const itemId = getOid(item.ItemId);
            result.push({
                key: `owned-${itemId ?? `${item.ItemType}-${index}`}`,
                type: item.ItemType,
                name: names.value[item.ItemType] ?? item.ItemType.split("/").filter(Boolean).at(-1) ?? item.ItemType,
                icon: icons.value[item.ItemType] ?? modMeta.value.get(item.ItemType)?.icon,
                oid: itemId,
                count: typeof item.ItemCount === "number" ? Math.max(0, item.ItemCount) : 1,
                rank: itemId ? getRank(fingerprint) : 0,
                maxRank: getMaxRank(item.ItemType),
                raw: false,
                fingerprint
            });
        }
    }
    return result;
});

const filteredEntries = computed(() => {
    const query = search.value.trim().toLocaleLowerCase();
    return entries.value
        .filter(item => filter.value === "all" || (filter.value === "raw" ? item.raw : !item.raw))
        .filter(item => !query || `${item.name} ${item.type}`.toLocaleLowerCase().includes(query))
        .sort((left, right) => left.name.localeCompare(right.name, "zh-CN") || right.rank - left.rank || left.key.localeCompare(right.key));
});
const selected = computed(() => entries.value.find(item => item.key === selectedKey.value));
const rankPresets = computed(() => {
    const maxRank = selected.value?.maxRank ?? 0;
    return [0, 1, 2, 5, 8, maxRank].filter((value, index, values) => value <= maxRank && values.indexOf(value) === index);
});
const totalRaw = computed(() => entries.value.filter(item => item.raw).reduce((sum, item) => sum + item.count, 0));
const ownedCount = computed(() => entries.value.filter(item => !item.raw).reduce((sum, item) => sum + item.count, 0));
const uniqueCount = computed(() => new Set(entries.value.map(item => item.type)).size);

const selectEntry = (entry: ModEntry): void => {
    selectedKey.value = entry.key;
    targetRank.value = entry.rank;
};

const setRank = (rank: number): void => {
    targetRank.value = Math.max(0, Math.min(selected.value?.maxRank ?? 0, Math.floor(rank)));
};

const onRankInput = (value: number | null): void => {
    setRank(Number(value ?? 0));
};

const saveRank = async (rank: number): Promise<void> => {
    const item = selected.value;
    if (!item?.oid || !canManage.value || loading.value) return;
    loading.value = true;
    try {
        const fingerprint = { ...item.fingerprint, lvl: rank };
        if (props.targetAccountId) {
            await updateManagedAccountMod(props.authz, props.targetAccountId, item.oid, fingerprint);
        } else {
            await updateModFingerprint(props.authz, item.oid, fingerprint);
        }
        targetRank.value = rank;
        message.success(`${item.name} 已调整为等级 ${rank}`);
        await loadTargetInventory();
        emit("refresh");
    } catch (error) {
        message.error(error instanceof Error ? error.message : String(error));
    } finally {
        loading.value = false;
    }
};

const changeRank = async (): Promise<void> => {
    await saveRank(targetRank.value);
};

const maxSelectedRank = async (): Promise<void> => {
    const item = selected.value;
    if (!item) return;
    await saveRank(item.maxRank);
};

const deleteSelected = (): void => {
    const item = selected.value;
    if (!item || !props.targetAccountId || loading.value) return;
    Modal.confirm({
        title: "删除 Mod",
        content: `确定删除 ${item.name}${item.raw ? ` 的 ${item.count} 张未融合库存` : "这个实例"}吗？`,
        okText: "删除",
        cancelText: "取消",
        okType: "danger",
        onOk: async () => {
            loading.value = true;
            try {
                await deleteManagedAccountMod(props.authz, props.targetAccountId!, item.raw
                    ? { itemType: item.type, itemCount: item.count }
                    : { oid: item.oid });
                message.success(`已删除 ${item.name}`);
                selectedKey.value = undefined;
                await loadTargetInventory();
                emit("refresh");
            } catch (error) {
                message.error(error instanceof Error ? error.message : String(error));
                throw error;
            } finally {
                loading.value = false;
            }
        }
    });
};

const grantSelected = async (): Promise<void> => {
    const item = selected.value;
    if (!item || !canManage.value || loading.value) return;
    loading.value = true;
    try {
        if (props.targetAccountId) {
            await addManagedAccountMod(props.authz, props.targetAccountId, item.type, 1, JSON.stringify({ lvl: item.maxRank }));
        } else {
            await addItems(props.authz, item.type, 1, JSON.stringify({ lvl: item.maxRank }));
        }
        message.success(`已添加 1 张满级 ${item.name}`);
        await loadTargetInventory();
        emit("refresh");
    } catch (error) {
        message.error(error instanceof Error ? error.message : String(error));
    } finally {
        loading.value = false;
    }
};

const copyType = async (): Promise<void> => {
    if (!selected.value) return;
    try {
        await navigator.clipboard.writeText(selected.value.type);
        message.success("已复制 Mod 路径");
    } catch {
        message.error("复制失败");
    }
};

const loadTargetInventory = async (): Promise<void> => {
    if (!props.targetAccountId) {
        targetInventory.value = undefined;
        return;
    }
    targetInventory.value = undefined;
    targetLoading.value = true;
    try {
        targetInventory.value = await getManagedAccountInventory(props.authz, props.targetAccountId);
    } catch (error) {
        message.error(error instanceof Error ? error.message : String(error));
    } finally {
        targetLoading.value = false;
    }
};

watch(() => props.targetAccountId, () => void loadTargetInventory(), { immediate: true });

onMounted(async () => {
    try {
        const catalog = await getItemCatalog();
        names.value = catalog.names;
        icons.value = catalog.icons;
        mods.value = catalog.items.filter(item => item.category === "mods");
    } catch {
        catalogError.value = true;
    }
});
</script>

<template>
    <section class="mod-page" aria-label="Mod 管理">
        <header class="mod-header">
            <div>
                <div class="mod-kicker"><ExperimentOutlined /> LOADOUT MANAGEMENT</div>
                <h1>{{ globalView ? '全服 Mod 总览' : targetAccountName ? `${targetAccountName} · Mod 仓库` : 'Mod 管理' }}<span>.</span></h1>
                <p>{{ globalView ? '汇总全部玩家已持有的 Mod 和未融合库存，按 Mod 类型查看全服数量。' : targetAccountName ? '查看并管理该账户的已持有 Mod、未融合库存和等级。' : '查看当前账户的 Mod、调整已持有实例等级，并快速补发 Mod。' }}</p>
            </div>
            <div class="mod-access" :class="{ allowed: canManage }"><i></i><span>{{ canManage ? "可执行管理操作" : "仅可查看" }}</span><LockOutlined v-if="!canManage" /></div>
        </header>
        <a-alert v-if="catalogError" type="info" show-icon message="Mod 目录暂时无法加载" description="仍会显示库存中的 Mod，名称可能使用内部路径。" class="mod-alert" />

        <div class="mod-stats">
            <div class="mod-stat mod-stat-primary"><span class="mod-stat-icon"><ExperimentOutlined /></span><span>Mod 种类</span><strong>{{ number(uniqueCount) }}</strong><small>当前库存</small></div>
            <div class="mod-stat mod-stat-owned"><span class="mod-stat-icon"><SettingOutlined /></span><span>已持有实例</span><strong>{{ number(ownedCount) }}</strong><small>可调整等级</small></div>
            <div class="mod-stat mod-stat-raw"><span class="mod-stat-icon"><InboxOutlined /></span><span>未融合数量</span><strong>{{ number(totalRaw) }}</strong><small>RawUpgrades</small></div>
            <div class="mod-stat-note"><ThunderboltOutlined /><span>{{ globalView ? '全服视图为聚合数据，单账户修改请进入账户管理。' : '等级调整会直接写入当前账户库存，并触发同步。' }}</span></div>
        </div>

        <div class="mod-layout">
            <section class="mod-browser">
                <div class="mod-toolbar">
                    <div><span class="section-label">INVENTORY MODS</span><h2>{{ globalView ? '全服 Mod' : '我的 Mod' }} <sup>{{ filteredEntries.length }}</sup></h2></div>
                    <div class="mod-filters"><a-input v-model:value="search" allow-clear placeholder="搜索 Mod 名称或路径" aria-label="搜索 Mod"><template #prefix><SearchOutlined /></template></a-input><a-segmented v-model:value="filter" :options="[{ label: '全部', value: 'all' }, { label: '已持有', value: 'owned' }, { label: '未融合', value: 'raw' }]" /></div>
                </div>
                <div v-if="filteredEntries.length" class="mod-list">
                    <button v-for="item in filteredEntries" :key="item.key" type="button" class="mod-row" :class="{ selected: selectedKey === item.key }" @click="selectEntry(item)">
                        <span class="mod-icon" :style="{ backgroundImage: item.icon ? `url(https://browse.wf${item.icon})` : undefined }"><InboxOutlined v-if="!item.icon" /></span>
                        <span class="mod-row-copy"><strong>{{ item.name }}</strong><small>{{ item.type }}</small></span>
                        <span v-if="item.raw" class="mod-state raw">未融合 ×{{ number(item.count) }}</span><span v-else class="mod-state">等级 {{ item.rank }}/{{ item.maxRank }}</span>
                        <CheckCircleOutlined v-if="selectedKey === item.key" class="mod-selected" />
                    </button>
                </div>
                <a-empty v-else description="没有匹配的 Mod" class="mod-empty" />
            </section>

            <aside class="mod-detail">
                <template v-if="selected">
                    <div class="detail-heading"><span class="mod-icon large" :style="{ backgroundImage: selected.icon ? `url(https://browse.wf${selected.icon})` : undefined }"><InboxOutlined v-if="!selected.icon" /></span><div><span class="section-label">SELECTED MOD</span><h2>{{ selected.name }}</h2><span class="detail-badge" :class="{ raw: selected.raw }">{{ selected.raw ? '未融合库存' : `实例等级 ${selected.rank}/${selected.maxRank}` }}</span></div></div>
                    <div class="detail-path"><code>{{ selected.type }}</code><a-button type="text" title="复制 Mod 路径" aria-label="复制 Mod 路径" @click="copyType"><CopyOutlined /></a-button></div>
                    <div v-if="globalView" class="global-mod-detail"><div><span>全服持有数量</span><strong>{{ number(selected.count) }}</strong></div><p>当前为全部玩家的聚合数据，不显示单个实例等级。需要调整或删除 Mod 时，请进入账户管理并选择具体账户。</p></div>
                    <template v-else-if="!selected.raw">
                        <div class="rank-editor"><div class="rank-editor-top"><span>调整等级</span><strong>{{ targetRank }} <small>/ {{ selected.maxRank }}</small></strong></div><a-slider :value="targetRank" :min="0" :max="selected.maxRank" :step="1" @update:value="onRankInput" /><div class="rank-buttons"><button v-for="rank in rankPresets" :key="rank" type="button" :class="{ active: targetRank === rank }" @click="setRank(rank)">{{ rank }}</button></div><div class="rank-actions"><a-button type="primary" size="large" :loading="loading" :disabled="!canManage || targetRank === selected.rank" @click="changeRank"><SettingOutlined />保存等级 {{ targetRank }}</a-button><a-button size="large" :loading="loading" :disabled="!canManage || selected.rank === selected.maxRank" @click="maxSelectedRank"><ThunderboltOutlined />直接满级</a-button><a-button v-if="targetAccountId" danger size="large" :loading="loading" @click="deleteSelected"><DeleteOutlined />删除 Mod</a-button></div></div>
                    </template>
                     <div v-else class="raw-detail"><div><span>未融合数量</span><strong>{{ number(selected.count) }}</strong></div><p>未融合 Mod 没有独立实例，无法直接调整等级。可以从这里继续添加相同 Mod。</p><a-button v-if="targetAccountId" danger :loading="loading" @click="deleteSelected"><DeleteOutlined />删除全部未融合库存</a-button></div>
                    <div v-if="!globalView" class="grant-mod"><div><span>快速补发满级 Mod</span><small>直接添加 1 张等级 {{ selected.maxRank }} 的 Mod 实例</small></div><a-button :loading="loading" :disabled="!canManage" @click="grantSelected"><PlusOutlined />添加满级</a-button></div>
                </template>
                <div v-else class="mod-detail-empty"><ExperimentOutlined /><strong>选择一个 Mod</strong><span>从左侧列表选择后查看等级和管理操作。</span></div>
            </aside>
        </div>
    </section>
</template>

<style scoped>
.mod-page { --mod-ink: #302c3d; --mod-purple: #7966a1; --mod-soft: #f3eff8; color: var(--mod-ink); }
.mod-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 27px; }
.mod-kicker { display: flex; align-items: center; gap: 8px; color: #74648f; font-size: 12px; font-weight: 700; letter-spacing: .13em; }
.mod-kicker .anticon { color: #a27dc0; font-size: 15px; }
.mod-header h1 { margin: 10px 0 9px; color: #302c3d; font-size: 42px; font-weight: 650; line-height: 1.2; letter-spacing: 0; }
.mod-header h1 > span { color: #987fbe; }
.mod-header p { margin: 0; color: #7e788a; font-size: 16px; line-height: 1.65; }
.mod-access { display: flex; align-items: center; gap: 8px; padding: 11px 13px; border: 1px solid #eadff2; border-radius: 9px; color: #a17482; background: #fff8fa; font-size: 12px; }
.mod-access.allowed { color: #6a8876; border-color: #d9e9dc; background: #f1f8f1; }
.mod-access i { width: 7px; height: 7px; border-radius: 50%; background: #c58591; }
.mod-access.allowed i { background: #57b47b; box-shadow: 0 0 0 3px #57b47b1c; }
.mod-alert { margin-bottom: 18px; }
.mod-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) 1.5fr; margin-bottom: 20px; padding: 21px 24px; border: 1px solid #e4dff0; border-radius: 14px; background: linear-gradient(105deg, #f4f0f8, #faf8fc); }
.mod-stats > div { min-width: 0; padding: 0 21px; border-right: 1px solid #e4dfeb; }
.mod-stats > div:first-child { padding-left: 0; }
.mod-stats > div:nth-child(3) { border: 0; }
.mod-stats > div > span, .mod-stats > div > small { display: block; color: #887f98; font-size: 12px; }
.mod-stats strong { display: block; margin: 4px 0; color: #463d58; font-size: 27px; font-weight: 650; font-variant-numeric: tabular-nums; }
.mod-stats small { color: #aa9fb6 !important; font-size: 10px !important; }
.mod-stat-note { display: flex; align-items: center; gap: 12px; padding-right: 0 !important; border: 0 !important; color: #796c8a; font-size: 12px; line-height: 1.6; }
.mod-stat-note .anticon { flex: 0 0 auto; color: #a27dc0; font-size: 21px; }
.global-mod-detail { margin-top: 26px; padding: 18px; border-radius: 11px; color: #786d83; background: #faf8fc; }
.global-mod-detail > div { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.global-mod-detail strong { color: #513f6b; font-size: 27px; font-weight: 650; }
.global-mod-detail p { margin: 12px 0 0; color: #9b91a5; font-size: 12px; line-height: 1.7; }
.mod-layout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(320px, .75fr); gap: 20px; align-items: start; }
.mod-browser, .mod-detail { min-width: 0; border: 1px solid #e3deeb; border-radius: 14px; background: #fff; box-shadow: 0 5px 20px #3e315c07; }
.mod-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 22px 24px; border-bottom: 1px solid #eeeaf1; }
.section-label { display: block; color: #9a91a6; font-size: 10px; font-weight: 700; letter-spacing: .13em; }
.mod-toolbar h2 { margin: 5px 0 0; color: #453b56; font-size: 21px; font-weight: 650; }
.mod-toolbar h2 sup { display: inline-grid; min-width: 22px; height: 22px; place-items: center; margin-left: 4px; padding: 0 5px; border-radius: 99px; color: #79639d; background: #f0ebf7; font-size: 11px; vertical-align: 3px; }
.mod-filters { display: flex; min-width: 0; align-items: center; gap: 9px; }
.mod-filters .ant-input-affix-wrapper { width: min(260px, 100%); border-color: #e3deeb; background: #fcfbfd; }
.mod-filters :deep(.ant-segmented) { padding: 4px; background: #f5f1f8; }
.mod-filters :deep(.ant-segmented-item-selected) { color: #715a96; box-shadow: 0 2px 7px #3e315c12; }
.mod-list { max-height: 600px; overflow-y: auto; padding: 8px; scrollbar-color: #c6b8d4 #f7f4f9; scrollbar-width: thin; }
.mod-list::-webkit-scrollbar { width: 8px; }
.mod-list::-webkit-scrollbar-track { background: #f7f4f9; }
.mod-list::-webkit-scrollbar-thumb { border: 2px solid #f7f4f9; border-radius: 8px; background: #c6b8d4; }
.mod-row { display: flex; width: 100%; min-width: 0; align-items: center; gap: 12px; padding: 11px 12px; border: 0; border-bottom: 1px solid #f0edf3; color: #665e71; background: transparent; cursor: pointer; text-align: left; }
.mod-row:last-child { border-bottom: 0; }
.mod-row:hover, .mod-row.selected { border-radius: 8px; background: #f5f1f8; }
.mod-icon { display: grid; width: 38px; height: 38px; flex: 0 0 auto; place-items: center; border-radius: 8px; color: #917bb0; background-color: #f1edf6; background-position: center; background-repeat: no-repeat; background-size: contain; font-size: 18px; }
.mod-icon.large { width: 64px; height: 64px; border-radius: 13px; font-size: 27px; }
.mod-row-copy { min-width: 0; flex: 1; }
.mod-row-copy strong, .mod-row-copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mod-row-copy strong { color: #4e465e; font-size: 14px; font-weight: 600; }
.mod-row-copy small { margin-top: 4px; color: #aaa2b0; font-size: 10px; }
.mod-state { flex: 0 0 auto; padding: 5px 8px; border-radius: 6px; color: #7d6a9a; background: #f2edf7; font-size: 11px; font-variant-numeric: tabular-nums; }
.mod-state.raw { color: #8e7d59; background: #faf3e5; }
.mod-selected { flex: 0 0 auto; color: #8b70ad; }
.mod-empty { min-height: 300px; padding: 20px; }
.mod-detail { padding: 24px; }
.detail-heading { display: flex; align-items: center; gap: 14px; }
.detail-heading > div { min-width: 0; }
.detail-heading h2 { margin: 5px 0 0; overflow-wrap: anywhere; color: #463b56; font-size: 22px; font-weight: 650; }
.detail-heading p { margin: 5px 0 0; color: #9b91a5; font-size: 12px; }
.detail-path { display: flex; align-items: center; gap: 8px; margin-top: 22px; }
.detail-path code { min-width: 0; flex: 1; padding: 10px; overflow: hidden; border: 1px solid #ece7f0; border-radius: 7px; color: #8a8095; background: #fbfafc; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.detail-path :deep(.ant-btn) { flex: 0 0 auto; color: #8976a3; }
.rank-editor { margin-top: 26px; padding: 18px; border: 1px solid #e7e0ed; border-radius: 11px; background: #faf8fc; }
.rank-editor-top { display: flex; align-items: baseline; justify-content: space-between; color: #786d83; font-size: 13px; }
.rank-editor-top strong { color: #513f6b; font-size: 27px; font-weight: 650; }
.rank-editor-top small { color: #a79eae; font-size: 13px; font-weight: 400; }
.rank-editor :deep(.ant-slider) { margin: 21px 8px 13px; }
.rank-editor :deep(.ant-slider-track) { background: #8b70ad; }
.rank-editor :deep(.ant-slider-handle::after) { box-shadow: 0 0 0 2px #8b70ad; }
.rank-buttons { display: flex; justify-content: space-between; gap: 5px; margin-bottom: 17px; }
.rank-buttons button { min-width: 28px; padding: 4px 6px; border: 1px solid #e1d8e9; border-radius: 5px; color: #8b7d99; background: #fff; font-size: 11px; cursor: pointer; }
.rank-buttons button.active, .rank-buttons button:hover { color: #735894; border-color: #ac94c2; background: #f0e9f7; }
.rank-actions { display: flex; gap: 8px; }
.rank-actions :deep(.ant-btn) { flex: 1; min-width: 0; }
.rank-editor :deep(.ant-btn-primary) { border-color: #7966a1; background: #7966a1; }
.raw-detail { margin-top: 26px; padding: 18px; border-radius: 11px; background: #faf6eb; }
.raw-detail > div { display: flex; align-items: center; justify-content: space-between; color: #887854; font-size: 13px; }
.raw-detail strong { color: #6d5a33; font-size: 24px; }
.raw-detail p { margin: 11px 0 0; color: #a08d66; font-size: 11px; line-height: 1.6; }
.grant-mod { display: flex; align-items: center; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #eeeaf1; }
.grant-mod > div { min-width: 0; flex: 1; }
.grant-mod span, .grant-mod small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.grant-mod span { color: #665a71; font-size: 12px; font-weight: 600; }
.grant-mod small { margin-top: 3px; color: #a49ba9; font-size: 10px; }
.grant-mod .ant-input-number { width: 70px; }
.grant-mod :deep(.ant-btn) { background: #7966a1; border-color: #7966a1; }
.mod-detail-empty { display: flex; min-height: 410px; align-items: center; justify-content: center; flex-direction: column; gap: 10px; color: #a49cae; text-align: center; }
.mod-detail-empty .anticon { color: #c1b4ce; font-size: 34px; }
.mod-detail-empty strong { color: #71657e; font-size: 15px; }
.mod-detail-empty span { max-width: 220px; font-size: 11px; line-height: 1.6; }
@media (max-width: 1100px) { .mod-layout { grid-template-columns: minmax(0, 1fr) 330px; } .mod-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); } .mod-stat-note { display: none !important; } }
@media (max-width: 850px) { .mod-header { align-items: flex-start; flex-direction: column; } .mod-access { align-self: flex-start; } .mod-layout { grid-template-columns: 1fr; } .mod-detail { order: -1; } .mod-detail-empty { min-height: 220px; } }
@media (max-width: 600px) { .mod-header h1 { font-size: 34px; } .mod-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 16px 10px; } .mod-stats > div { padding: 0 9px; } .mod-stats strong { font-size: 21px; } .mod-stats > div > span { font-size: 11px; } .mod-toolbar { align-items: stretch; flex-direction: column; padding: 18px; } .mod-filters { align-items: stretch; flex-direction: column; } .mod-filters .ant-input-affix-wrapper { width: 100%; } .mod-filters :deep(.ant-segmented) { width: 100%; } .mod-filters :deep(.ant-segmented-group) { width: 100%; } .mod-filters :deep(.ant-segmented-item) { flex: 1; text-align: center; } .mod-detail { padding: 18px; } .detail-heading h2 { font-size: 19px; } .rank-actions { align-items: stretch; flex-direction: column; } }

/* Refined workspace treatment: compact metrics, a calmer library list, and a focused dark inspector. */
.mod-page { --mod-ink: #243229; --mod-muted: #748279; --mod-accent: #237b66; --mod-purple: #7966a1; color: var(--mod-ink); }
.mod-header { padding-bottom: 22px; border-bottom: 1px solid #e5ebe6; }
.mod-kicker { color: #58776a; letter-spacing: .15em; }
.mod-kicker .anticon { color: #8873aa; }
.mod-header h1 { color: #23382d; font-weight: 680; }
.mod-header h1 > span { color: var(--mod-accent); }
.mod-header p { color: #718078; }
.mod-access { border-color: #d9e9dc; color: #61806d; background: #f1f8f1; }
.mod-stats { grid-template-columns: repeat(3, minmax(0, 1fr)) 1.35fr; gap: 12px; padding: 0; border: 0; background: transparent; }
.mod-stats > div { position: relative; min-height: 104px; padding: 17px 16px 13px 54px !important; border: 1px solid #e0e8e1 !important; border-radius: 12px; background: #fff; box-shadow: 0 4px 14px #29423806; }
.mod-stat .mod-stat-icon { position: absolute; top: 17px; left: 16px; display: grid; width: 27px; height: 27px; place-items: center; border-radius: 8px; color: #237b66; background: #e5f2e9; font-size: 14px; }
.mod-stat-owned .mod-stat-icon { color: #7966a1; background: #eeeaf5; }
.mod-stat-raw .mod-stat-icon { color: #a9782d; background: #f8eedb; }
.mod-stats > div > span:not(.mod-stat-icon) { color: #718078; font-size: 12px; }
.mod-stats strong { margin: 8px 0 2px; color: #294438; font-size: 25px; }
.mod-stats small { color: #99a59e !important; }
.mod-stat-note { display: flex !important; min-height: 104px; align-items: center; gap: 10px; padding: 17px !important; border-color: #d8e8da !important; color: #6d8575; background: #f2f8f2 !important; box-shadow: none !important; line-height: 1.5; }
.mod-stat-note .anticon { color: #58a374; }
.mod-layout { grid-template-columns: minmax(0, 1.25fr) minmax(350px, .75fr); gap: 18px; }
.mod-browser { overflow: hidden; border-color: #dfe7e1; border-radius: 13px; box-shadow: 0 6px 22px #29423808; }
.mod-toolbar { padding: 19px 21px; border-bottom-color: #e8eee9; }
.mod-toolbar h2 { color: #294438; font-size: 20px; }
.mod-toolbar h2 sup { color: #4e8369; background: #e7f2e9; }
.mod-filters .ant-input-affix-wrapper { border-color: #dfe7e1; background: #fbfdfb; }
.mod-filters :deep(.ant-segmented) { background: #eff5f0; }
.mod-filters :deep(.ant-segmented-item-selected) { color: #237b66; }
.mod-list { max-height: 620px; padding: 6px; }
.mod-row { min-height: 64px; padding: 10px 13px; border-bottom-color: #edf2ee; }
.mod-row:hover { background: #f7faf7; }
.mod-row.selected { border-radius: 8px; background: #eef7f0; box-shadow: inset 3px 0 #237b66; }
.mod-icon { width: 40px; height: 40px; border: 1px solid #e8e1ef; border-radius: 9px; background-color: #f5f1f8; }
.mod-row-copy strong { color: #3b5444; }
.mod-row-copy small { color: #94a199; }
.mod-state { color: #5e846c; background: #eaf5ec; }
.mod-state.raw { color: #97733c; background: #fbf2df; }
.mod-selected { color: #237b66; }
.mod-detail { overflow: hidden; padding: 0; border-color: #202a34; border-radius: 13px; color: #e8efe9; background: #202a34; box-shadow: 0 8px 24px #16202926; }
.detail-heading { align-items: center; padding: 26px 24px 22px; background: #202a34; }
.mod-icon.large { width: 70px; height: 70px; border: 1px solid #526071; background-color: #303c49; box-shadow: 0 8px 18px #10182040; }
.detail-heading .section-label { color: #94a9a0; }
.detail-heading h2 { color: #f0f6f0; font-size: 23px; }
.detail-badge { display: inline-flex; align-items: center; margin-top: 7px; padding: 4px 8px; border-radius: 5px; color: #b6ddc3; background: #2b5142; font-size: 10px; }
.detail-badge.raw { color: #e1c18a; background: #5b4931; }
.detail-path { margin: 0; padding: 0 24px 20px; background: #202a34; }
.detail-path code { border-color: #3c4a58; color: #b3c2bb; background: #29343f; }
.detail-path :deep(.ant-btn) { color: #a9c0b4; }
.rank-editor { margin: 0 20px; padding: 19px; border: 1px solid #40505d; border-radius: 10px; background: #29343f; }
.rank-editor-top { color: #b4c1ba; }
.rank-editor-top strong { color: #eef7ef; font-size: 30px; }
.rank-editor-top small { color: #91a39a; }
.rank-editor :deep(.ant-slider-rail) { background: #4a5967; }
.rank-editor :deep(.ant-slider-track) { background: #6eb58c; }
.rank-editor :deep(.ant-slider-handle::after) { box-shadow: 0 0 0 2px #8cc6a3; }
.rank-buttons { margin-bottom: 18px; }
.rank-buttons button { border-color: #4a5865; color: #b4c0b9; background: #34414c; }
.rank-buttons button.active, .rank-buttons button:hover { border-color: #78bd96; color: #e8f5ea; background: #37624d; }
.rank-actions :deep(.ant-btn-primary) { border-color: #6eb58c; background: #5a9c77; }
.rank-actions :deep(.ant-btn-default) { border-color: #4a5865; color: #d4e0d8; background: #34414c; }
.rank-actions { display: flex; flex-wrap: wrap; }
.rank-actions :deep(.ant-btn) { flex: 1 1 130px; min-width: 130px; white-space: nowrap; }
.raw-detail { margin: 20px; border: 1px solid #66553b; color: #ead7ae; background: #4a3e2e; }
.raw-detail > div { color: #ddc38d; }
.raw-detail strong { color: #f4dfac; }
.raw-detail p { color: #cdb98e; }
.grant-mod { margin: 20px 24px 0; padding: 17px 0 24px; border-top-color: #3c4a58; }
.grant-mod span { color: #d4e0d8; }
.grant-mod small { color: #93a69b; }
.grant-mod :deep(.ant-btn) { color: #eff8f0; border-color: #5a9c77; background: #5a9c77; }
.mod-detail-empty { min-height: 420px; color: #95a69d; background: #202a34; }
.mod-detail-empty .anticon { color: #668074; }
.mod-detail-empty strong { color: #d9e7dd; }
@media (max-width: 1100px) { .mod-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 600px) { .mod-stats { gap: 8px; padding: 0; } .mod-stats > div { min-height: 91px; padding: 13px 8px 10px !important; } .mod-stats > div > span:not(.mod-stat-icon) { font-size: 10px; } .mod-stat .mod-stat-icon { top: 11px; left: 8px; width: 22px; height: 22px; font-size: 11px; } .mod-stats strong { margin-top: 28px; font-size: 19px; } .mod-stats small { font-size: 9px !important; } .detail-heading { padding: 21px 18px 18px; } .detail-path { padding: 0 18px 18px; } .rank-editor { margin: 0 16px; } .grant-mod { margin-left: 18px; margin-right: 18px; } }
</style>
