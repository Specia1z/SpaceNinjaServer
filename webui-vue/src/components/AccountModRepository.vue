<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ExperimentOutlined, SearchOutlined } from "@ant-design/icons-vue";
import ModPanel from "./ModPanel.vue";
import type { AccountRatesResponse } from "../api";

const props = defineProps<{
    authz: string;
    accounts: AccountRatesResponse["accounts"];
    permissions: string[];
}>();

const selectedAccountId = ref<string>();
const accountSearch = ref("");

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
</script>

<template>
    <section class="account-mod-page">
        <header class="account-mod-heading">
            <div>
                <div class="eyebrow"><ExperimentOutlined /> ACCOUNT MOD REPOSITORY</div>
                <h2>账户 Mod 仓库</h2>
                <p>选择一个可管理账户，查看并调整该账户的 Mod 实例和未融合库存。</p>
            </div>
            <div class="account-mod-count"><strong>{{ accounts.length }}</strong><span>个账户可管理</span></div>
        </header>
        <div class="account-mod-layout">
            <aside class="account-picker panel-card">
                <div class="picker-title"><div><span class="section-label">MANAGED ACCOUNTS</span><h3>账户列表</h3></div><strong>{{ filteredAccounts.length }}</strong></div>
                <a-input v-model:value="accountSearch" allow-clear placeholder="搜索账户..." class="account-search"><template #prefix><SearchOutlined /></template></a-input>
                <div class="account-items">
                    <button v-for="account in filteredAccounts" :key="account.id" type="button" class="account-item" :class="{ selected: account.id === selectedAccountId }" @click="selectedAccountId = account.id">
                        <span class="account-avatar">{{ account.displayName.slice(0, 1).toUpperCase() }}</span>
                        <span><strong>{{ account.displayName }}</strong><small>{{ account.id }}</small></span>
                        <i></i>
                    </button>
                </div>
                <a-empty v-if="!filteredAccounts.length" description="没有匹配账户" />
            </aside>
            <div class="account-mod-content">
                <ModPanel
                    v-if="selectedAccount"
                    :authz="authz"
                    :permissions="permissions"
                    :target-account-id="selectedAccount.id"
                    :target-account-name="selectedAccount.displayName"
                />
                <a-empty v-else description="请选择一个账户" />
            </div>
        </div>
    </section>
</template>

<style scoped>
.account-mod-page { display: flex; flex-direction: column; gap: 20px; }
.account-mod-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; }
.account-mod-heading h2 { margin: 7px 0 5px; color: #243630; font-size: 28px; }
.account-mod-heading p { margin: 0; color: #75827c; }
.account-mod-heading :deep(.anticon) { margin-right: 6px; color: #237b66; }
.account-mod-count { display: flex; flex-direction: column; align-items: end; padding: 11px 15px; border: 1px solid #dce8df; border-radius: 8px; background: #f7fbf8; color: #6f8077; font-size: 12px; }
.account-mod-count strong { color: #237b66; font-size: 23px; line-height: 1; }
.account-mod-layout { display: grid; grid-template-columns: 265px minmax(0, 1fr); gap: 18px; align-items: start; }
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
.account-mod-content { min-width: 0; }
.account-mod-content :deep(.mod-header) { margin-bottom: 18px; }
.account-mod-content :deep(.mod-header h1) { font-size: 30px; }
.account-mod-content :deep(.mod-stats) { grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 15px 18px; }
.account-mod-content :deep(.mod-stat-note) { display: none; }
@media (max-width: 1100px) { .account-mod-layout { grid-template-columns: 220px minmax(0, 1fr); } }
@media (max-width: 820px) { .account-mod-heading { align-items: start; flex-direction: column; } .account-mod-count { align-items: start; } .account-mod-layout { grid-template-columns: 1fr; } .account-picker { position: static; } .account-items { display: flex; max-height: none; gap: 6px; overflow-x: auto; } .account-item { flex: 0 0 180px; } }
</style>
