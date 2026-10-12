<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    CopyOutlined,
    DeleteOutlined,
    GiftOutlined,
    InboxOutlined,
    LockOutlined,
    PlusOutlined,
    ReloadOutlined,
    SearchOutlined,
    SendOutlined,
    ThunderboltOutlined
} from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import { addCurrency, addItemsBatch, addManagedAccountCurrency, addManagedAccountItems, getItemCatalog, type CatalogItem, type Inventory } from "../api";

type GrantCurrency = {
    key: string;
    permission: string;
    label: string;
    name: string;
    short: string;
    color: string;
    soft: string;
};

type QueuedItem = CatalogItem & { count: number; fingerprint?: string; rank?: number };
type Activity = { id: number; label: string; detail: string; time: string; success: boolean };

const props = defineProps<{
    authz: string;
    accountName: string;
    accountId: string;
    inventory?: Inventory;
    permissions: string[];
    connected: boolean;
    targetAccountId?: string;
}>();
const emit = defineEmits<{ refresh: [] }>();

const currencies: GrantCurrency[] = [
    { key: "RegularCredits", permission: "addCredits", label: "现金", name: "Credits", short: "CR", color: "#a9782d", soft: "#f8eedb" },
    { key: "PremiumCredits", permission: "addPlatinum", label: "白金", name: "Platinum", short: "PL", color: "#557b9f", soft: "#e8f0f6" },
    { key: "FusionPoints", permission: "addEndo", label: "内融核心", name: "Endo", short: "EN", color: "#237b66", soft: "#e3f2eb" },
    { key: "PrimeTokens", permission: "addRegalAya", label: "御品阿耶", name: "Regal Aya", short: "RA", color: "#8a659b", soft: "#f1eaf5" },
    { key: "CrewShipFusionPoints", permission: "addDirac", label: "Dirac", name: "Dirac", short: "DI", color: "#657c8f", soft: "#e8eef2" }
];
const quickAmounts = [1_000, 10_000, 100_000, 1_000_000];
const catalog = ref<CatalogItem[]>([]);
const catalogLoading = ref(false);
const catalogError = ref(false);
const mode = ref<"currency" | "items">("currency");
const adjustmentMode = ref<"add" | "remove">("add");
const selectedCurrency = ref("RegularCredits");
const currencyAmount = ref<number>(100_000);
const itemQuery = ref("");
const itemType = ref("");
const itemCount = ref<number>(1);
const itemGrantMode = ref<"raw" | "ranked">("raw");
const itemRank = ref<number>(0);
const queuedItems = ref<QueuedItem[]>([]);
const busy = ref(false);
const activity = ref<Activity[]>([]);
const copied = ref(false);

const hasPermission = (permission: string): boolean => Boolean(props.targetAccountId) || props.permissions.includes(permission);
const availableCurrencies = computed(() => currencies.filter(item => hasPermission(item.permission)));
const selectedCurrencyMeta = computed(() => currencies.find(item => item.key === selectedCurrency.value) ?? currencies[0]);
const currentCurrencyBalance = computed(() => {
    const value = props.inventory?.[selectedCurrency.value];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
});
const number = (value: number): string => value.toLocaleString("zh-CN");
const filteredCatalog = computed(() => {
    const query = itemQuery.value.trim().toLocaleLowerCase();
    if (query.length < 2) return [];
    return catalog.value
        .filter(item => `${item.name} ${item.uniqueName}`.toLocaleLowerCase().includes(query))
        .sort((left, right) => {
            const score = (item: CatalogItem): number => {
                const name = item.name.toLocaleLowerCase();
                const uniqueName = item.uniqueName.toLocaleLowerCase();
                if (name === query || uniqueName === query) return 0;
                if (name.startsWith(query) || uniqueName.endsWith(`/${query}`)) return 1;
                if (item.subtype === "Resource" || uniqueName.includes("/types/items/miscitems/")) return 2;
                return 3;
            };
            return score(left) - score(right) || left.name.localeCompare(right.name, "zh-CN") || left.uniqueName.localeCompare(right.uniqueName);
        })
        .slice(0, 20);
});
const selectedItem = computed(() => catalog.value.find(item => item.uniqueName === itemType.value));
const itemIsMod = computed(() => selectedItem.value?.category === "mods" || itemType.value.startsWith("/Lotus/Upgrades/Mods/"));
const itemMaxRank = computed(() => Math.max(0, selectedItem.value?.fusionLimit ?? 10));
const itemCanBeQueued = computed(() => itemType.value.trim().startsWith("/") && Number.isInteger(itemCount.value) && itemCount.value > 0 && (!itemIsMod.value || itemGrantMode.value === "raw" || (Number.isInteger(itemRank.value) && itemRank.value >= 0 && itemRank.value <= itemMaxRank.value)));
const canSubmitCurrency = computed(() => hasPermission(selectedCurrencyMeta.value.permission) && Number.isInteger(currencyAmount.value) && currencyAmount.value > 0);
const canSubmitItems = computed(() => hasPermission("addItems") && queuedItems.value.length > 0);
const allGrantPermissions = computed(() => currencies.some(item => hasPermission(item.permission)) || hasPermission("addItems"));

watch(adjustmentMode, value => {
    if (value === "remove") itemGrantMode.value = "raw";
});

const selectCurrency = (currency: GrantCurrency): void => {
    if (hasPermission(currency.permission)) selectedCurrency.value = currency.key;
};

const selectItem = (item: CatalogItem): void => {
    itemType.value = item.uniqueName;
    itemQuery.value = item.name;
    if (item.category === "mods") itemGrantMode.value = "ranked";
};

const addToQueue = (): void => {
    if (!itemCanBeQueued.value) return;
    const type = itemType.value.trim();
    const fingerprint = itemIsMod.value && itemGrantMode.value === "ranked" ? JSON.stringify({ lvl: itemRank.value }) : undefined;
    const count = fingerprint ? 1 : itemCount.value;
    const existing = queuedItems.value.find(item => item.uniqueName === type && item.fingerprint === fingerprint);
    if (existing && !fingerprint) existing.count += count;
    else queuedItems.value.push({
        uniqueName: type,
        name: selectedItem.value?.name ?? type.split("/").filter(Boolean).at(-1) ?? type,
        icon: selectedItem.value?.icon,
        count,
        fingerprint,
        rank: fingerprint ? itemRank.value : undefined
    });
    itemCount.value = 1;
    message.success("已加入发放队列");
};

const removeFromQueue = (item: QueuedItem): void => {
    queuedItems.value = queuedItems.value.filter(entry => entry.uniqueName !== item.uniqueName || entry.fingerprint !== item.fingerprint);
};

const formatTime = (): string => new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
const addActivity = (label: string, detail: string, success: boolean): void => {
    activity.value.unshift({ id: Date.now(), label, detail, time: formatTime(), success });
    activity.value = activity.value.slice(0, 5);
};

const submitCurrency = async (): Promise<void> => {
    if (!props.authz || !canSubmitCurrency.value || busy.value) return;
    busy.value = true;
    try {
        const delta = adjustmentMode.value === "remove" ? -currencyAmount.value : currencyAmount.value;
        if (props.targetAccountId) {
            await addManagedAccountCurrency(props.authz, props.targetAccountId, selectedCurrency.value, delta);
        } else {
            await addCurrency(props.authz, selectedCurrency.value, currencyAmount.value);
        }
        message.success(`${selectedCurrencyMeta.value.label}已发放`);
        addActivity(`发放 ${selectedCurrencyMeta.value.label}`, `+${number(currencyAmount.value)} ${selectedCurrencyMeta.value.name}`, true);
        emit("refresh");
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        message.error(detail);
        addActivity("货币发放失败", detail, false);
    } finally {
        busy.value = false;
    }
};

const submitItems = async (): Promise<void> => {
    if (!props.authz || !canSubmitItems.value || busy.value) return;
    busy.value = true;
        const batch = queuedItems.value.map(item => ({ ItemType: item.uniqueName, ItemCount: adjustmentMode.value === "remove" ? -item.count : item.count, ...(item.fingerprint ? { Fingerprint: item.fingerprint } : {}) }));
    try {
        if (props.targetAccountId) {
            await addManagedAccountItems(props.authz, props.targetAccountId, batch);
        } else {
            await addItemsBatch(props.authz, batch);
        }
        message.success(`已发放 ${batch.length} 种物品`);
        addActivity("批量发放物品", `${batch.length} 种物品，共 ${number(batch.reduce((sum, item) => sum + item.ItemCount, 0))} 个`, true);
        queuedItems.value = [];
        emit("refresh");
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        message.error(detail);
        addActivity("物品发放失败", detail, false);
    } finally {
        busy.value = false;
    }
};

const copyAccountId = async (): Promise<void> => {
    try {
        await navigator.clipboard.writeText(props.accountId);
        copied.value = true;
        window.setTimeout(() => copied.value = false, 1500);
    } catch {
        message.error("复制失败");
    }
};

onMounted(async () => {
    if (availableCurrencies.value[0]) selectedCurrency.value = availableCurrencies.value[0].key;
    catalogLoading.value = true;
    try {
        catalog.value = (await getItemCatalog()).items;
    } catch {
        catalogError.value = true;
    } finally {
        catalogLoading.value = false;
    }
});
</script>

<template>
    <section class="grant-page" aria-label="发放中心">
        <header class="grant-header">
            <div>
                <div class="grant-kicker"><GiftOutlined /> ACCOUNT OPERATIONS</div>
                <h1>发放中心<span>.</span></h1>
                <p>为{{ targetAccountId ? accountName : '当前账户' }}添加货币或库存物品，所有操作都会经过权限校验并实时同步。</p>
            </div>
            <div class="grant-target">
                <div class="target-status"><i :class="{ online: connected }"></i>{{ connected ? "实时连接" : "正在重连" }}</div>
                <strong>{{ accountName }}</strong>
                <button type="button" :title="copied ? '已复制' : '复制账户 ID'" @click="copyAccountId"><span>{{ accountId }}</span><CopyOutlined /></button>
            </div>
        </header>

        <a-alert v-if="!allGrantPermissions" type="warning" show-icon class="grant-alert" message="当前账户没有发放权限" description="请联系管理员为账户授予 addItems 或对应的货币权限。" />

        <div class="grant-layout">
            <main class="grant-main">
                <div class="grant-modebar">
                    <div><span class="section-label">执行操作</span><strong>{{ mode === 'currency' ? '添加账户货币' : '添加库存物品' }}</strong></div>
                     <div class="grant-mode-controls"><a-segmented v-model:value="mode" :options="[{ label: '货币', value: 'currency' }, { label: '物品', value: 'items' }]" /><a-segmented v-model:value="adjustmentMode" :options="[{ label: '增加', value: 'add' }, { label: '扣除', value: 'remove' }]" /></div>
                </div>

                <section v-if="mode === 'currency'" class="grant-workspace" aria-label="货币发放">
                    <div class="currency-grid">
                        <button v-for="currency in currencies" :key="currency.key" type="button" class="currency-choice" :class="{ selected: selectedCurrency === currency.key, locked: !hasPermission(currency.permission) }" :style="{ '--currency-color': currency.color, '--currency-soft': currency.soft }" :disabled="!hasPermission(currency.permission)" @click="selectCurrency(currency)">
                            <span class="currency-symbol">{{ currency.short }}</span>
                            <span class="currency-copy"><strong>{{ currency.label }}</strong><small>{{ currency.name }}</small></span>
                            <LockOutlined v-if="!hasPermission(currency.permission)" class="currency-lock" />
                            <CheckCircleOutlined v-else-if="selectedCurrency === currency.key" class="currency-check" />
                        </button>
                    </div>
                    <div class="grant-form-panel">
                        <div class="form-panel-heading"><div><span class="section-label">发放数量</span><h2>{{ selectedCurrencyMeta.label }}</h2></div><span class="balance-readout">当前余额 <strong>{{ currentCurrencyBalance === undefined ? '—' : number(currentCurrencyBalance) }}</strong></span></div>
                        <a-form layout="vertical" @submit.prevent="submitCurrency">
                            <a-form-item label="添加数量">
                                 <a-input-number v-model:value="currencyAmount" :min="1" :precision="0" size="large" class="grant-number" />
                                <div class="quick-amounts"><button v-for="amount in quickAmounts" :key="amount" type="button" :class="{ active: currencyAmount === amount }" @click="currencyAmount = amount">+{{ number(amount) }}</button></div>
                            </a-form-item>
                             <div class="form-submit-row"><span><ThunderboltOutlined /> {{ adjustmentMode === 'remove' ? '扣除后余额不能低于 0' : '操作将立即写入库存' }}</span><a-button type="primary" size="large" html-type="submit" :loading="busy" :disabled="!canSubmitCurrency"><SendOutlined />{{ adjustmentMode === 'remove' ? '确认扣除' : '确认增加' }}</a-button></div>
                        </a-form>
                    </div>
                </section>

                <section v-else class="grant-workspace" aria-label="物品发放">
                    <div class="item-picker-panel">
                        <div class="form-panel-heading"><div><span class="section-label">添加到队列</span><h2>选择库存物品</h2></div><span class="permission-state" :class="{ allowed: hasPermission('addItems') }"><i></i>{{ hasPermission('addItems') ? '有发放权限' : '无发放权限' }}</span></div>
                         <div class="item-search-wrap">
                            <SearchOutlined />
                            <input v-model="itemQuery" type="search" placeholder="搜索中文名称或物品路径" aria-label="搜索物品" />
                            <span v-if="catalogLoading" class="search-status">加载目录...</span>
                        </div>
                        <div v-if="filteredCatalog.length" class="item-suggestions" role="listbox">
                            <button v-for="item in filteredCatalog" :key="item.uniqueName" type="button" role="option" @click="selectItem(item)"><span class="suggestion-icon" :style="{ backgroundImage: item.icon ? `url(https://browse.wf${item.icon})` : undefined }"><InboxOutlined v-if="!item.icon" /></span><span><strong>{{ item.name }}</strong><small>{{ item.uniqueName }}</small></span><PlusOutlined /></button>
                        </div>
                        <div v-else-if="itemQuery.length >= 2 && !catalogLoading" class="search-empty">没有找到匹配物品，可以直接输入完整物品路径。</div>
                         <div class="direct-item-row"><label for="grant-item-path">物品路径</label><a-input id="grant-item-path" v-model:value="itemType" placeholder="/Lotus/Types/Items/MiscItems/Forma" /><a-input-number v-model:value="itemCount" :min="1" :max="itemIsMod && itemGrantMode === 'ranked' ? 1 : undefined" :precision="0" aria-label="物品数量" /></div>
                        <div v-if="itemIsMod" class="mod-grant-options"><span>Mod 发放方式</span><a-segmented v-model:value="itemGrantMode" :options="[{ label: '未融合', value: 'raw' }, { label: '指定等级', value: 'ranked' }]" /><a-input-number v-if="itemGrantMode === 'ranked'" v-model:value="itemRank" :min="0" :max="itemMaxRank" :precision="0" addon-before="等级" /></div>
                         <div class="selected-item-preview"><span class="preview-icon" :style="{ backgroundImage: selectedItem?.icon ? `url(https://browse.wf${selectedItem.icon})` : undefined }"><InboxOutlined v-if="!selectedItem?.icon" /></span><span><strong>{{ selectedItem?.name ?? (itemType ? itemType.split('/').filter(Boolean).at(-1) : '尚未选择物品') }}</strong><small>{{ itemType || '输入路径或从上方搜索结果中选择' }}{{ itemIsMod && itemGrantMode === 'ranked' ? ` · 等级 ${itemRank}` : '' }}</small></span><a-button type="primary" :disabled="!itemCanBeQueued || !hasPermission('addItems')" @click="addToQueue"><PlusOutlined />加入{{ adjustmentMode === 'remove' ? '扣除' : '发放' }}队列</a-button></div>
                        <a-alert v-if="catalogError" type="info" show-icon message="物品目录暂时不可用" description="仍可以直接输入完整物品路径进行发放。" />
                    </div>
                    <div class="queue-panel">
                        <div class="queue-heading"><div><span class="section-label">待执行</span><h2>发放队列 <sup>{{ queuedItems.length }}</sup></h2></div><a-button v-if="queuedItems.length" type="text" danger @click="queuedItems = []"><DeleteOutlined />清空</a-button></div>
                        <div v-if="queuedItems.length" class="queue-list">
                            <div v-for="item in queuedItems" :key="`${item.uniqueName}-${item.fingerprint ?? 'raw'}`" class="queue-item"><span class="preview-icon small" :style="{ backgroundImage: item.icon ? `url(https://browse.wf${item.icon})` : undefined }"><InboxOutlined v-if="!item.icon" /></span><span class="queue-copy"><strong>{{ item.name }}{{ item.rank !== undefined ? ` · 等级 ${item.rank}` : '' }}</strong><small>{{ item.uniqueName }}</small></span><strong class="queue-count">×{{ number(item.count) }}</strong><button type="button" aria-label="移除物品" title="移除物品" @click="removeFromQueue(item)"><DeleteOutlined /></button></div>
                             <div class="queue-submit"><span><strong>{{ queuedItems.length }}</strong> 种物品，共 <strong>{{ number(queuedItems.reduce((sum, item) => sum + item.count, 0)) }}</strong> 个</span><a-button type="primary" size="large" :loading="busy" :disabled="!canSubmitItems" @click="submitItems"><SendOutlined />执行批量{{ adjustmentMode === 'remove' ? '扣除' : '发放' }}</a-button></div>
                        </div>
                        <div v-else class="queue-empty"><InboxOutlined /><strong>队列还是空的</strong><span>搜索物品后加入队列，可一次性发放多种物品。</span></div>
                    </div>
                </section>
            </main>

            <aside class="grant-side">
                <section class="permission-panel">
                    <div class="side-heading"><div><span class="section-label">ACCESS CONTROL</span><h2>可用权限</h2></div><LockOutlined /></div>
                    <div class="permission-list"><div v-for="currency in currencies" :key="currency.permission" class="permission-row"><i :class="{ allowed: hasPermission(currency.permission) }"></i><span>{{ currency.label }}</span><code>{{ currency.permission }}</code></div><div class="permission-row"><i :class="{ allowed: hasPermission('addItems') }"></i><span>库存物品</span><code>addItems</code></div></div>
                    <p class="side-note">权限由当前会话授予，服务端会在每次提交时再次校验。</p>
                </section>
                <section class="activity-panel">
                    <div class="side-heading"><div><span class="section-label">SESSION LOG</span><h2>最近操作</h2></div><ClockCircleOutlined /></div>
                    <div v-if="activity.length" class="activity-list"><div v-for="entry in activity" :key="entry.id" class="activity-row"><span class="activity-icon" :class="{ failed: !entry.success }"><CheckCircleOutlined v-if="entry.success" /><ThunderboltOutlined v-else /></span><span><strong>{{ entry.label }}</strong><small>{{ entry.detail }}</small></span><time>{{ entry.time }}</time></div></div>
                    <div v-else class="activity-empty"><ClockCircleOutlined /><span>本次会话还没有发放记录</span></div>
                </section>
                <div class="grant-safety"><CheckCircleOutlined /><span>每次操作都会触发库存同步，完成后可在库存页面核对结果。</span><ReloadOutlined /></div>
            </aside>
        </div>
    </section>
</template>

<style scoped>
.grant-page { --grant-ink: #223e32; --grant-secondary: #6d8175; color: var(--grant-ink); }
.grant-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 28px; margin-bottom: 27px; }
.grant-kicker { display: flex; align-items: center; gap: 8px; color: #5a806c; font-size: 12px; font-weight: 700; letter-spacing: .13em; }
.grant-kicker .anticon { color: #b1843e; font-size: 15px; }
.grant-header h1 { margin: 10px 0 9px; color: var(--grant-ink); font-size: 42px; font-weight: 650; line-height: 1.2; letter-spacing: 0; }
.grant-header h1 > span { color: #4a9a7d; }
.grant-header p { max-width: 690px; margin: 0; color: var(--grant-secondary); font-size: 16px; line-height: 1.65; }
.grant-target { min-width: 225px; padding: 15px 17px; border: 1px solid #dce8df; border-radius: 12px; background: #fff; box-shadow: 0 4px 14px #284c3505; }
.target-status { display: flex; align-items: center; gap: 7px; color: #668375; font-size: 12px; }
.target-status i, .permission-row i, .permission-state i { width: 7px; height: 7px; border-radius: 50%; background: #b3beb8; }
.target-status i.online, .permission-row i.allowed, .permission-state.allowed i { background: #57b47b; box-shadow: 0 0 0 3px #57b47b1c; }
.grant-target > strong { display: block; margin-top: 10px; overflow: hidden; color: #315340; font-size: 16px; text-overflow: ellipsis; white-space: nowrap; }
.grant-target > button { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px; padding: 0; border: 0; color: #9aa89f; background: transparent; font-size: 11px; cursor: pointer; text-align: left; }
.grant-target > button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.grant-target > button:hover { color: #237b66; }
.grant-alert { margin-bottom: 18px; }
.grant-layout { display: grid; grid-template-columns: minmax(0, 1fr) 310px; gap: 20px; align-items: start; }
.grant-main, .grant-side { min-width: 0; }
.grant-modebar, .grant-workspace, .permission-panel, .activity-panel { border: 1px solid #dfe8e1; border-radius: 15px; background: #fff; box-shadow: 0 5px 20px #29423806; }
.grant-modebar { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 20px 24px; }
.section-label { display: block; color: #789083; font-size: 10px; font-weight: 700; letter-spacing: .13em; line-height: 1.4; }
.grant-modebar strong { display: block; margin-top: 4px; color: #315340; font-size: 18px; font-weight: 650; }
.grant-modebar :deep(.ant-segmented) { padding: 4px; background: #f1f6f2; }
.grant-modebar :deep(.ant-segmented-item-selected) { color: #237b66; box-shadow: 0 2px 7px #29423810; }
.grant-mode-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.grant-workspace { margin-top: 14px; overflow: hidden; }
.currency-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 9px; padding: 20px 22px; border-bottom: 1px solid #edf1ee; background: #fbfdfb; }
.currency-choice { position: relative; display: flex; min-width: 0; align-items: center; gap: 10px; padding: 12px 10px; border: 1px solid #e4ece5; border-radius: 10px; color: #587063; background: #fff; cursor: pointer; text-align: left; transition: border-color .18s ease, background .18s ease; }
.currency-choice:hover:not(:disabled), .currency-choice.selected { border-color: var(--currency-color); background: var(--currency-soft); }
.currency-choice.locked { color: #9ca8a1; background: #f8faf8; cursor: not-allowed; }
.currency-symbol { display: grid; width: 31px; height: 31px; flex: 0 0 auto; place-items: center; border-radius: 9px; color: var(--currency-color); background: var(--currency-soft); font-size: 10px; font-weight: 800; }
.currency-copy { min-width: 0; }
.currency-copy strong, .currency-copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.currency-copy strong { color: inherit; font-size: 13px; font-weight: 650; }
.currency-copy small { margin-top: 3px; color: #95a39a; font-size: 10px; }
.currency-lock, .currency-check { position: absolute; top: 9px; right: 8px; color: #a7b1ab; font-size: 11px; }
.currency-check { color: var(--currency-color); }
.grant-form-panel, .item-picker-panel, .queue-panel { padding: 25px; }
.form-panel-heading, .queue-heading, .side-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.form-panel-heading h2, .queue-heading h2, .side-heading h2 { margin: 5px 0 0; color: #315340; font-size: 21px; font-weight: 650; line-height: 1.25; }
.balance-readout { color: #91a097; font-size: 12px; }
.balance-readout strong { display: block; margin-top: 4px; color: #3d614d; font-size: 18px; font-weight: 650; text-align: right; }
.grant-form-panel :deep(.ant-form) { margin-top: 27px; }
.grant-form-panel :deep(.ant-form-item-label > label) { color: #64796b; font-size: 13px; font-weight: 600; }
.grant-number { width: 100% !important; }
.grant-number :deep(.ant-input-number-input) { height: 48px; color: #315340; font-size: 25px; font-variant-numeric: tabular-nums; }
.quick-amounts { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
.quick-amounts button { padding: 5px 10px; border: 1px solid #dfe9e1; border-radius: 6px; color: #789083; background: #fbfdfb; font-size: 12px; cursor: pointer; }
.quick-amounts button:hover, .quick-amounts button.active { color: #237b66; border-color: #8fc0a4; background: #edf7f0; }
.form-submit-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 22px; }
.form-submit-row > span { color: #8b9c91; font-size: 12px; }
.form-submit-row > span .anticon { color: #b1843e; }
.form-submit-row :deep(.ant-btn), .queue-submit :deep(.ant-btn) { min-width: 145px; height: 42px; }
.grant-side { display: grid; gap: 14px; }
.permission-panel, .activity-panel { padding: 21px; }
.side-heading h2 { font-size: 17px; }
.side-heading > .anticon { margin-top: 8px; color: #9aac9f; font-size: 19px; }
.permission-list { display: grid; gap: 12px; margin-top: 22px; }
.permission-row { display: flex; align-items: center; gap: 8px; min-width: 0; color: #5c7365; font-size: 13px; }
.permission-row span { min-width: 0; flex: 1; }
.permission-row code { color: #a0aca4; font-size: 10px; }
.side-note { margin: 19px 0 0; padding-top: 15px; border-top: 1px solid #edf1ee; color: #9aa89f; font-size: 11px; line-height: 1.6; }
.activity-list { display: grid; gap: 13px; margin-top: 22px; }
.activity-row { display: flex; min-width: 0; align-items: flex-start; gap: 9px; }
.activity-icon { display: grid; width: 22px; height: 22px; flex: 0 0 auto; place-items: center; border-radius: 7px; color: #4ca873; background: #e8f5eb; font-size: 12px; }
.activity-icon.failed { color: #b15d5d; background: #f8eaea; }
.activity-row > span:nth-child(2) { min-width: 0; flex: 1; }
.activity-row strong, .activity-row small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.activity-row strong { color: #496352; font-size: 12px; font-weight: 600; }
.activity-row small { margin-top: 3px; color: #96a39a; font-size: 10px; }
.activity-row time { flex: 0 0 auto; color: #a4afa8; font-size: 10px; }
.activity-empty { display: flex; min-height: 120px; align-items: center; justify-content: center; flex-direction: column; gap: 9px; color: #a2afa6; font-size: 12px; text-align: center; }
.activity-empty .anticon { color: #c1cbc4; font-size: 22px; }
.grant-safety { display: flex; align-items: center; gap: 9px; padding: 14px 16px; border: 1px solid #d9e9dc; border-radius: 11px; color: #6e8b76; background: #eef8ef; font-size: 11px; line-height: 1.5; }
.grant-safety .anticon:first-child { flex: 0 0 auto; color: #56aa75; font-size: 15px; }
.grant-safety .anticon:last-child { flex: 0 0 auto; margin-left: auto; color: #94bd9d; }
.item-picker-panel { border-bottom: 1px solid #edf1ee; }
.permission-state { display: flex; align-items: center; gap: 7px; color: #a27d4c; font-size: 11px; }
.permission-state.allowed { color: #5e8e6d; }
.item-search-wrap { position: relative; display: flex; align-items: center; gap: 10px; margin-top: 24px; padding: 0 14px; border: 1px solid #dce7df; border-radius: 9px; background: #fbfdfb; }
.item-search-wrap:focus-within { border-color: #77af91; box-shadow: 0 0 0 3px #77af9115; }
.item-search-wrap > .anticon { color: #8ca497; }
.item-search-wrap input { width: 100%; height: 45px; border: 0; outline: 0; color: #365944; background: transparent; font-size: 14px; }
.item-search-wrap input::placeholder { color: #a0ada5; }
.search-status { flex: 0 0 auto; color: #91a199; font-size: 11px; }
.item-suggestions { display: grid; max-height: 320px; gap: 3px; margin-top: 7px; padding: 6px; overflow-y: auto; border: 1px solid #e0eae2; border-radius: 9px; background: #fff; box-shadow: 0 7px 18px #29423812; overscroll-behavior: contain; scrollbar-gutter: stable; scrollbar-color: #a9c5b1 #f3f7f3; scrollbar-width: thin; }
.item-suggestions::-webkit-scrollbar { width: 8px; }
.item-suggestions::-webkit-scrollbar-track { border-radius: 8px; background: #f3f7f3; }
.item-suggestions::-webkit-scrollbar-thumb { border: 2px solid #f3f7f3; border-radius: 8px; background: #a9c5b1; }
.item-suggestions::-webkit-scrollbar-thumb:hover { background: #7ea98b; }
.item-suggestions button { display: flex; min-width: 0; align-items: center; gap: 10px; padding: 8px; border: 0; border-radius: 6px; color: #557063; background: transparent; cursor: pointer; text-align: left; }
.item-suggestions button:hover { background: #f0f7f1; }
.item-suggestions button > span:nth-child(2) { min-width: 0; flex: 1; }
.item-suggestions button strong, .item-suggestions button small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-suggestions button strong { color: #3e604b; font-size: 13px; font-weight: 600; }
.item-suggestions button small { margin-top: 3px; color: #9aa89f; font-size: 10px; }
.item-suggestions button > .anticon:last-child { color: #9bb9a4; }
.suggestion-icon, .preview-icon { display: grid; width: 36px; height: 36px; flex: 0 0 auto; place-items: center; border-radius: 8px; color: #7ca188; background-color: #edf5ef; background-position: center; background-repeat: no-repeat; background-size: contain; font-size: 17px; }
.search-empty { margin-top: 10px; color: #9aa79f; font-size: 12px; }
.direct-item-row { display: grid; grid-template-columns: auto minmax(0, 1fr) 115px; align-items: center; gap: 10px; margin-top: 18px; }
.direct-item-row label { color: #6e8275; font-size: 12px; }
.direct-item-row .ant-input-number { width: 115px; }
.mod-grant-options { display: flex; align-items: center; gap: 10px; margin-top: 14px; color: #6e8275; font-size: 12px; }
.mod-grant-options > span { flex: 0 0 auto; }
.mod-grant-options :deep(.ant-segmented) { padding: 3px; background: #f1f6f2; }
.mod-grant-options :deep(.ant-segmented-item-selected) { color: #237b66; }
.mod-grant-options :deep(.ant-input-number) { width: 125px; margin-left: auto; }
.selected-item-preview { display: flex; min-width: 0; align-items: center; gap: 11px; margin-top: 19px; padding: 11px; border: 1px solid #e1ebe3; border-radius: 10px; background: #f8fbf8; }
.selected-item-preview > span:nth-child(2) { min-width: 0; flex: 1; }
.selected-item-preview strong, .selected-item-preview small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.selected-item-preview strong { color: #3d5f49; font-size: 13px; font-weight: 600; }
.selected-item-preview small { margin-top: 3px; color: #96a59b; font-size: 10px; }
.selected-item-preview :deep(.ant-btn) { flex: 0 0 auto; height: 34px; }
.item-picker-panel :deep(.ant-alert) { margin-top: 14px; }
.queue-panel { background: #fcfdfc; }
.queue-heading { align-items: center; }
.queue-heading h2 sup { display: inline-grid; min-width: 22px; height: 22px; place-items: center; margin-left: 4px; padding: 0 5px; border-radius: 99px; color: #5a8768; background: #e6f2e7; font-size: 11px; vertical-align: 3px; }
.queue-heading :deep(.ant-btn) { padding: 0; font-size: 12px; }
.queue-list { display: grid; gap: 9px; margin-top: 20px; }
.queue-item { display: flex; min-width: 0; align-items: center; gap: 10px; padding: 10px; border: 1px solid #e3ebe4; border-radius: 9px; background: #fff; }
.preview-icon.small { width: 30px; height: 30px; font-size: 14px; }
.queue-copy { min-width: 0; flex: 1; }
.queue-copy strong, .queue-copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.queue-copy strong { color: #46634f; font-size: 12px; font-weight: 600; }
.queue-copy small { margin-top: 3px; color: #a0aca4; font-size: 9px; }
.queue-count { flex: 0 0 auto; color: #52775c; font-size: 13px; font-weight: 650; }
.queue-item > button { display: grid; width: 26px; height: 26px; flex: 0 0 auto; place-items: center; border: 0; border-radius: 6px; color: #a9b4ac; background: transparent; cursor: pointer; }
.queue-item > button:hover { color: #b65e5e; background: #fff0f0; }
.queue-submit { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; padding-top: 17px; border-top: 1px solid #e8efe9; color: #87988d; font-size: 12px; }
.queue-submit strong { color: #4f7257; }
.queue-empty { display: flex; min-height: 180px; align-items: center; justify-content: center; flex-direction: column; gap: 9px; color: #9daaa1; text-align: center; }
.queue-empty .anticon { color: #b5c4b9; font-size: 30px; }
.queue-empty strong { color: #718878; font-size: 14px; font-weight: 600; }
.queue-empty span { max-width: 230px; font-size: 11px; line-height: 1.6; }
@media (max-width: 1180px) { .grant-layout { grid-template-columns: minmax(0, 1fr) 270px; } .currency-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 900px) { .grant-header { align-items: flex-start; flex-direction: column; } .grant-target { width: 100%; } .grant-layout { grid-template-columns: 1fr; } .grant-side { grid-template-columns: repeat(2, minmax(0, 1fr)); } .grant-safety { grid-column: 1 / -1; } }
@media (max-width: 600px) { .grant-header h1 { font-size: 34px; } .grant-modebar { align-items: stretch; flex-direction: column; padding: 18px; } .grant-modebar :deep(.ant-segmented) { width: 100%; } .grant-modebar :deep(.ant-segmented-group) { width: 100%; } .grant-modebar :deep(.ant-segmented-item) { flex: 1; text-align: center; } .currency-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 15px; } .currency-choice { padding: 10px 8px; } .grant-form-panel, .item-picker-panel, .queue-panel { padding: 18px; } .form-submit-row, .queue-submit { align-items: stretch; flex-direction: column; } .form-submit-row :deep(.ant-btn), .queue-submit :deep(.ant-btn) { width: 100%; } .direct-item-row { grid-template-columns: 1fr 105px; } .direct-item-row label { grid-column: 1 / -1; } .direct-item-row .ant-input-number { width: 105px; } .mod-grant-options { align-items: stretch; flex-direction: column; } .mod-grant-options :deep(.ant-segmented), .mod-grant-options :deep(.ant-input-number) { width: 100%; margin-left: 0; } .grant-side { grid-template-columns: 1fr; } .grant-safety { grid-column: auto; } }
</style>
