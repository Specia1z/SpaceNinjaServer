<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { DeleteOutlined, LockOutlined, ReloadOutlined, SaveOutlined, SearchOutlined, SafetyOutlined, UnlockOutlined, UserOutlined } from "@ant-design/icons-vue";
import { message, Modal } from "ant-design-vue";
import {
    deleteAccountRates,
    getManagedAccountInventory,
    saveAccountFeatures,
    saveAccountRates,
    setManagedAccountBan,
    type AccountRatesResponse,
    type Inventory
} from "../api";
import InventoryPanel from "./InventoryPanel.vue";
import GrantCenter from "./GrantCenter.vue";
import ModPanel from "./ModPanel.vue";

const props = defineProps<{
    authz: string;
    data?: AccountRatesResponse;
    permissions: string[];
    connected: boolean;
    loading?: boolean;
}>();
const emit = defineEmits<{ refresh: [] }>();

const accountSearch = ref("");
const selectedAccountId = ref<string>();
const detailPane = ref("inventory");
const inventory = ref<Inventory>();
const inventoryLoading = ref(false);
const inventoryError = ref("");
const accountBusy = ref(false);
const accountNotice = ref("");
const rateDraft = ref<Record<string, number | boolean | string | undefined>>({});
const featureDraft = ref<Record<string, boolean>>({});

const rateLabels: Record<string, string> = {
    resourceDropMultiplier: "资源掉落倍率",
    modDropMultiplier: "Mod 掉落倍率",
    creditMultiplier: "现金掉落倍率",
    affinityMultiplier: "经验倍率",
    focusXpMultiplier: "专精经验倍率",
    standingMultiplier: "声望倍率",
    nightwaveStandingMultiplier: "午夜电波声望倍率",
    relicRewardMultiplier: "遗物奖励倍率",
    relicPlatinumMultiplier: "遗物白金倍率",
    missionPlatinumMultiplier: "任务白金倍率",
    dailyTributeMultiplier: "每日献礼倍率"
};
const featureLabels: Record<string, string> = {
    universalPolarityEverywhere: "所有装备解锁通用极性",
    unlockDoubleCapacityPotatoesEverywhere: "所有装备解锁双倍容量",
    unlockExilusEverywhere: "所有装备解锁 Exilus 槽位",
    unlockArcanesEverywhere: "所有装备解锁 Arcane"
};

const accounts = computed(() => {
    const query = accountSearch.value.trim().toLocaleLowerCase();
    return (props.data?.accounts ?? []).filter(account => !query || `${account.displayName} ${account.id}`.toLocaleLowerCase().includes(query));
});
const selectedAccount = computed(() => props.data?.accounts.find(account => account.id === selectedAccountId.value));

const selectAccount = (id: string): void => {
    const selected = props.data?.accounts.find(account => account.id === id);
    if (!selected) return;
    selectedAccountId.value = id;
    rateDraft.value = { ...selected.profile };
    featureDraft.value = { ...selected.featureProfile };
    inventory.value = undefined;
    inventoryError.value = "";
    void refreshInventory(id);
};

const refreshInventory = async (accountId = selectedAccountId.value): Promise<void> => {
    if (!accountId) return;
    inventoryLoading.value = true;
    inventoryError.value = "";
    try {
        inventory.value = await getManagedAccountInventory(props.authz, accountId);
    } catch (error) {
        inventoryError.value = error instanceof Error ? error.message : String(error);
    } finally {
        inventoryLoading.value = false;
    }
};

watch(() => props.data?.accounts, nextAccounts => {
    const nextId = selectedAccountId.value && nextAccounts?.some(account => account.id === selectedAccountId.value)
        ? selectedAccountId.value
        : nextAccounts?.[0]?.id;
    if (nextId && nextId !== selectedAccountId.value) selectAccount(nextId);
}, { immediate: true });

const runAccountAction = async (action: () => Promise<unknown>, success: string): Promise<void> => {
    accountBusy.value = true;
    accountNotice.value = "";
    try {
        await action();
        message.success(success);
        emit("refresh");
    } catch (error) {
        accountNotice.value = error instanceof Error ? error.message : String(error);
        message.error(accountNotice.value);
    } finally {
        accountBusy.value = false;
    }
};

const saveRates = (): void => {
    if (!selectedAccountId.value) return;
    void runAccountAction(() => saveAccountRates(props.authz, selectedAccountId.value!, rateDraft.value), "账户倍率已保存");
};
const saveFeatures = (): void => {
    if (!selectedAccountId.value) return;
    void runAccountAction(() => saveAccountFeatures(props.authz, selectedAccountId.value!, featureDraft.value), "账户功能开关已保存");
};
const resetRates = (): void => {
    rateDraft.value = Object.fromEntries([
        ["enabled", true],
        ["expiresAt", undefined],
        ...(props.data?.definitions ?? []).map(definition => [definition.key, 1])
    ]);
    featureDraft.value = Object.fromEntries((props.data?.featureDefinitions ?? []).map(definition => [definition.key, false]));
};
const removeRates = (): void => {
    if (!selectedAccountId.value || !selectedAccount.value) return;
    Modal.confirm({
        title: "删除自定义倍率",
        content: `确定删除 ${selectedAccount.value.displayName} 的自定义倍率吗？`,
        okText: "删除",
        cancelText: "取消",
        okType: "danger",
        onOk: () => runAccountAction(() => deleteAccountRates(props.authz, selectedAccountId.value!), "账户倍率已恢复默认")
    });
};
const setBan = (banned: boolean): void => {
    if (!selectedAccount.value || !selectedAccountId.value) return;
    const action = banned ? "封禁" : "解除封禁";
    Modal.confirm({
        title: `${action}账户`,
        content: `确定对 ${selectedAccount.value.displayName} 执行${action}吗？`,
        okText: action,
        cancelText: "取消",
        okType: banned ? "danger" : "primary",
        onOk: () => runAccountAction(() => setManagedAccountBan(props.authz, selectedAccountId.value!, banned), `账户已${action}`)
    });
};
</script>

<template>
    <section class="account-management-page">
        <header class="account-management-heading">
            <div><div class="eyebrow"><UserOutlined /> ACCOUNT OPERATIONS</div><h1>账户管理<span>.</span></h1><p>以账户为中心管理库存、Mod、倍率和安全状态。</p></div>
            <a-button :loading="loading" @click="emit('refresh')"><ReloadOutlined />刷新账户列表</a-button>
        </header>
        <a-alert v-if="accountNotice" type="error" show-icon :message="accountNotice" class="account-alert" />
        <div class="account-management-layout">
            <aside class="account-directory">
                <div class="directory-heading"><div><span class="section-label">ACCOUNT DIRECTORY</span><h2>账户列表</h2></div><strong>{{ accounts.length }}</strong></div>
                <a-input v-model:value="accountSearch" allow-clear placeholder="搜索名称或账户 ID..." class="account-directory-search"><template #prefix><SearchOutlined /></template></a-input>
                <div class="directory-list">
                    <button v-for="account in accounts" :key="account.id" type="button" class="directory-item" :class="{ selected: account.id === selectedAccountId }" @click="selectAccount(account.id)">
                        <span class="directory-avatar">{{ account.displayName.slice(0, 1).toUpperCase() }}</span>
                        <span class="directory-copy"><strong>{{ account.displayName }}</strong><small>{{ account.id }}</small></span>
                        <span class="directory-state" :class="{ banned: account.banned }">{{ account.banned ? '封禁' : account.hasCustomProfile || account.hasCustomFeatures ? '自定义' : '正常' }}</span>
                    </button>
                </div>
                <a-empty v-if="!accounts.length" description="没有匹配账户" />
            </aside>

            <main v-if="selectedAccount" class="account-detail">
                <div class="account-detail-header">
                    <div class="account-identity"><span class="identity-avatar"><UserOutlined /></span><div><span class="section-label">SELECTED ACCOUNT</span><h2>{{ selectedAccount.displayName }}</h2><code>{{ selectedAccount.id }}</code></div></div>
                    <a-tag :color="selectedAccount.banned ? 'error' : 'success'"><LockOutlined v-if="selectedAccount.banned" />{{ selectedAccount.banned ? '已封禁' : '账户正常' }}</a-tag>
                </div>
                <a-tabs v-model:active-key="detailPane" class="account-detail-tabs">
                    <a-tab-pane key="inventory" tab="库存"><InventoryPanel :inventory="inventory" :loading="inventoryLoading" :error="inventoryError" :editable="true" :authz="authz" :target-account-id="selectedAccount.id" @refresh="refreshInventory" /><GrantCenter :authz="authz" :account-name="selectedAccount.displayName" :account-id="selectedAccount.id" :inventory="inventory" :permissions="permissions" :connected="connected" :target-account-id="selectedAccount.id" @refresh="refreshInventory" /></a-tab-pane>
                    <a-tab-pane key="mods" tab="Mod 仓库"><ModPanel :authz="authz" :permissions="permissions" :target-account-id="selectedAccount.id" :target-account-name="selectedAccount.displayName" /></a-tab-pane>
                    <a-tab-pane key="rates" tab="倍率设置">
                        <div class="settings-panel"><div class="settings-actions"><a-button type="primary" :loading="accountBusy" @click="saveRates"><SaveOutlined />保存倍率</a-button><a-button :loading="accountBusy" @click="saveFeatures"><SaveOutlined />保存功能开关</a-button><a-button :loading="accountBusy" @click="resetRates">恢复编辑默认值</a-button><a-button danger :loading="accountBusy" @click="removeRates"><DeleteOutlined />删除自定义倍率</a-button></div><a-divider orientation="left">倍率配置</a-divider><div class="rate-grid"><div v-for="definition in data?.definitions ?? []" :key="definition.key"><label>{{ rateLabels[definition.key] ?? definition.key }}</label><a-input-number :value="Number(rateDraft[definition.key] ?? 1)" :min="definition.min" :max="definition.max" :step="definition.step" style="width: 100%" @update:value="rateDraft[definition.key] = $event ?? undefined" /></div></div><a-divider orientation="left">账户功能</a-divider><div class="feature-grid"><a-checkbox v-for="definition in data?.featureDefinitions ?? []" :key="definition.key" v-model:checked="featureDraft[definition.key]">{{ featureLabels[definition.key] ?? definition.key }}</a-checkbox></div></div>
                    </a-tab-pane>
                    <a-tab-pane key="security" tab="安全状态">
                        <div class="security-panel"><div class="security-icon" :class="{ banned: selectedAccount.banned }"><SafetyOutlined /></div><div><span class="section-label">ACCOUNT SECURITY</span><h3>{{ selectedAccount.banned ? '账户已封禁' : '账户正常运行' }}</h3><p>{{ selectedAccount.banned ? '该账户无法继续登录，已登录会话也已失效。' : '该账户当前可以正常登录和使用服务。' }}</p></div><a-button v-if="selectedAccount.banned" type="primary" :loading="accountBusy" @click="setBan(false)"><UnlockOutlined />解除封禁</a-button><a-button v-else danger :loading="accountBusy" @click="setBan(true)"><LockOutlined />封禁账户</a-button></div>
                    </a-tab-pane>
                </a-tabs>
            </main>
            <a-empty v-else description="请选择一个账户" />
        </div>
    </section>
</template>

<style scoped>
.account-management-page { display: flex; flex-direction: column; gap: 20px; color: #243630; }
.account-management-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; }
.account-management-heading h1 { margin: 8px 0 7px; color: #243630; font-size: 36px; line-height: 1.15; }
.account-management-heading h1 > span { color: #237b66; }
.account-management-heading p { margin: 0; color: #75827c; font-size: 15px; }
.account-management-heading :deep(.anticon), .account-identity :deep(.anticon) { margin-right: 6px; color: #237b66; }
.account-management-layout { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 18px; align-items: start; }
.account-directory { position: sticky; top: 18px; overflow: hidden; border: 1px solid #dfe8e1; border-radius: 10px; background: #fff; }
.directory-heading { display: flex; align-items: end; justify-content: space-between; padding: 18px 18px 12px; }
.directory-heading h2 { margin: 4px 0 0; font-size: 18px; }
.directory-heading > strong { color: #8b9690; font-size: 13px; }
.section-label { color: #8a9790; font-size: 10px; font-weight: 800; letter-spacing: .12em; }
.account-directory-search { width: calc(100% - 28px); margin: 0 14px 12px; }
.directory-list { max-height: 610px; overflow-y: auto; padding: 0 8px 9px; }
.directory-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 9px; border: 1px solid transparent; border-radius: 8px; background: transparent; cursor: pointer; text-align: left; }
.directory-item:hover { background: #f5f9f6; }
.directory-item.selected { border-color: #b8d8cc; background: #eaf5ef; }
.directory-avatar { display: grid; flex: 0 0 31px; width: 31px; height: 31px; place-items: center; border-radius: 8px; color: #237b66; background: #dcefe6; font-size: 12px; font-weight: 800; }
.directory-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3px; }
.directory-copy strong { overflow: hidden; color: #33443d; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.directory-copy small { overflow: hidden; color: #99a49e; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.directory-state { flex: 0 0 auto; color: #6a9380; font-size: 10px; }
.directory-state.banned { color: #be6262; }
.account-detail { min-width: 0; }
.account-detail-header { display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-bottom: 14px; padding: 16px 18px; border: 1px solid #dfe8e1; border-radius: 10px; background: #fff; }
.account-identity { display: flex; align-items: center; gap: 12px; min-width: 0; }
.identity-avatar { display: grid; flex: 0 0 42px; width: 42px; height: 42px; place-items: center; border-radius: 10px; background: #dcefe6; font-size: 19px; }
.identity-avatar :deep(.anticon) { margin: 0; }
.account-identity h2 { margin: 3px 0 2px; color: #243630; font-size: 20px; }
.account-identity code { color: #91a098; font-size: 10px; }
.account-detail-tabs :deep(.ant-tabs-content-holder) { min-width: 0; }
.settings-panel { padding: 20px; border: 1px solid #dfe8e1; border-radius: 10px; background: #fff; }
.settings-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.rate-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 15px; }
.rate-grid label { display: block; margin-bottom: 6px; color: #6e7f76; font-size: 12px; }
.feature-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; }
.security-panel { display: flex; align-items: center; gap: 16px; padding: 28px; border: 1px solid #dfe8e1; border-radius: 10px; background: #fff; }
.security-icon { display: grid; flex: 0 0 54px; width: 54px; height: 54px; place-items: center; border-radius: 13px; color: #237b66; background: #e5f3eb; font-size: 25px; }
.security-icon.banned { color: #b95353; background: #f9e7e7; }
.security-panel h3 { margin: 4px 0; font-size: 18px; }
.security-panel p { margin: 0; color: #75827c; }
.security-panel > :last-child { margin-left: auto; }
@media (max-width: 900px) { .account-management-layout { grid-template-columns: 1fr; } .account-directory { position: static; } .directory-list { display: flex; max-height: none; gap: 6px; overflow-x: auto; } .directory-item { flex: 0 0 190px; } }
@media (max-width: 640px) { .account-management-heading { align-items: start; flex-direction: column; } .rate-grid, .feature-grid { grid-template-columns: 1fr; } .security-panel { align-items: flex-start; flex-wrap: wrap; } .security-panel > :last-child { margin-left: 0; } }
</style>
