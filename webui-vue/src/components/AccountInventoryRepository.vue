<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { DatabaseOutlined, SearchOutlined } from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import { getManagedAccountInventory, type AccountRatesResponse, type Inventory } from "../api";
import InventoryPanel from "./InventoryPanel.vue";
import GrantCenter from "./GrantCenter.vue";

const props = defineProps<{
    authz: string;
    accounts: AccountRatesResponse["accounts"];
    permissions: string[];
    connected: boolean;
}>();

const selectedAccountId = ref<string>();
const accountSearch = ref("");
const inventory = ref<Inventory>();
const loading = ref(false);
const error = ref("");

watch(
    () => props.accounts,
    accounts => {
        if (!selectedAccountId.value || !accounts.some(account => account.id === selectedAccountId.value)) {
            selectedAccountId.value = accounts[0]?.id;
        }
    },
    { immediate: true }
);

const filteredAccounts = computed(() => {
    const query = accountSearch.value.trim().toLocaleLowerCase();
    return props.accounts.filter(account => !query || `${account.displayName} ${account.id}`.toLocaleLowerCase().includes(query));
});
const selectedAccount = computed(() => props.accounts.find(account => account.id === selectedAccountId.value));

const refresh = async (): Promise<void> => {
    if (!selectedAccountId.value) return;
    loading.value = true;
    error.value = "";
    try {
        inventory.value = await getManagedAccountInventory(props.authz, selectedAccountId.value);
    } catch (reason) {
        inventory.value = undefined;
        error.value = reason instanceof Error ? reason.message : String(reason);
        message.error(error.value);
    } finally {
        loading.value = false;
    }
};

watch(selectedAccountId, () => void refresh(), { immediate: true });
</script>

<template>
    <section class="account-inventory-page">
        <header class="account-inventory-heading">
            <div><div class="eyebrow"><DatabaseOutlined /> ACCOUNT INVENTORY CONTROL</div><h2>账户库存管理</h2><p>选择目标账户，查看完整库存并执行货币和物品管理操作。</p></div>
            <div class="account-inventory-count"><strong>{{ accounts.length }}</strong><span>个账户可管理</span></div>
        </header>
        <div class="account-inventory-layout">
            <aside class="account-picker panel-card">
                <div class="picker-title"><div><span class="section-label">MANAGED ACCOUNTS</span><h3>账户列表</h3></div><strong>{{ filteredAccounts.length }}</strong></div>
                <a-input v-model:value="accountSearch" allow-clear placeholder="搜索账户..." class="account-search"><template #prefix><SearchOutlined /></template></a-input>
                <div class="account-items">
                    <button v-for="account in filteredAccounts" :key="account.id" type="button" class="account-item" :class="{ selected: account.id === selectedAccountId }" @click="selectedAccountId = account.id">
                        <span class="account-avatar">{{ account.displayName.slice(0, 1).toUpperCase() }}</span><span><strong>{{ account.displayName }}</strong><small>{{ account.id }}</small></span><i></i>
                    </button>
                </div>
                <a-empty v-if="!filteredAccounts.length" description="没有匹配账户" />
            </aside>
            <main v-if="selectedAccount" class="account-inventory-content">
                <InventoryPanel :inventory="inventory" :loading="loading" :error="error" :updated-at="undefined" />
                <GrantCenter :authz="authz" :account-name="selectedAccount.displayName" :account-id="selectedAccount.id" :inventory="inventory" :permissions="permissions" :connected="connected" :target-account-id="selectedAccount.id" @refresh="refresh" />
            </main>
            <a-empty v-else description="请选择一个账户" />
        </div>
    </section>
</template>

<style scoped>
.account-inventory-page { display: flex; flex-direction: column; gap: 20px; }
.account-inventory-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; }
.account-inventory-heading h2 { margin: 7px 0 5px; color: #243630; font-size: 28px; }
.account-inventory-heading p { margin: 0; color: #75827c; }
.account-inventory-heading :deep(.anticon) { margin-right: 6px; color: #237b66; }
.account-inventory-count { display: flex; flex-direction: column; align-items: end; padding: 11px 15px; border: 1px solid #dce8df; border-radius: 8px; background: #f7fbf8; color: #6f8077; font-size: 12px; }
.account-inventory-count strong { color: #237b66; font-size: 23px; line-height: 1; }
.account-inventory-layout { display: grid; grid-template-columns: 265px minmax(0, 1fr); gap: 18px; align-items: start; }
.panel-card { border: 1px solid #e1e8e2; border-radius: 9px; background: #fff; }
.account-picker { position: sticky; top: 18px; overflow: hidden; }
.picker-title { display: flex; align-items: end; justify-content: space-between; padding: 17px 17px 12px; }
.picker-title h3 { margin: 3px 0 0; color: #243630; font-size: 16px; }
.picker-title > strong { color: #8b9690; font-size: 13px; }
.section-label { color: #8a9790; font-size: 10px; font-weight: 800; letter-spacing: .12em; }
.account-search { width: calc(100% - 28px); margin: 0 14px 10px; }
.account-items { max-height: 540px; overflow: auto; padding: 0 8px 8px; }
.account-item { display: flex; align-items: center; gap: 9px; width: 100%; padding: 10px 9px; border: 1px solid transparent; border-radius: 7px; color: inherit; background: transparent; cursor: pointer; text-align: left; }
.account-item:hover { background: #f4f8f5; }
.account-item.selected { border-color: #b8d8cc; background: #eaf5ef; }
.account-avatar { display: grid; flex: 0 0 29px; width: 29px; height: 29px; place-items: center; border-radius: 7px; color: #237b66; background: #dcefe6; font-size: 12px; font-weight: 800; }
.account-item > span:nth-child(2) { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
.account-item strong { overflow: hidden; color: #33443d; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.account-item small { overflow: hidden; color: #99a49e; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.account-item i { width: 5px; height: 5px; border-radius: 50%; background: #cad5ce; }
.account-item.selected i { background: #237b66; box-shadow: 0 0 0 3px #237b6620; }
.account-inventory-content { display: flex; min-width: 0; flex-direction: column; gap: 24px; }
.account-inventory-content :deep(.inventory-heading) { margin-bottom: 18px; }
.account-inventory-content :deep(.inventory-heading h1) { font-size: 30px; }
.account-inventory-content :deep(.inventory-refresh) { display: none; }
.account-inventory-content :deep(.grant-header) { margin-top: 4px; }
.account-inventory-content :deep(.grant-header h1) { font-size: 30px; }
@media (max-width: 820px) { .account-inventory-heading { align-items: start; flex-direction: column; } .account-inventory-count { align-items: start; } .account-inventory-layout { grid-template-columns: 1fr; } .account-picker { position: static; } .account-items { display: flex; max-height: none; gap: 6px; overflow-x: auto; } .account-item { flex: 0 0 180px; } }
</style>
