<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
    DashboardOutlined,
    DatabaseOutlined,
    ExperimentOutlined,
    GiftOutlined,
    LogoutOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    ReloadOutlined,
    SaveOutlined,
    SettingOutlined,
    UserOutlined
} from "@ant-design/icons-vue";
import { message, theme } from "ant-design-vue";
import type { ThemeConfig } from "ant-design-vue/es/config-provider/context";
import zhCN from "ant-design-vue/es/locale/zh_CN";
import LoginPanel from "./components/LoginPanel.vue";
const OverviewPanel = defineAsyncComponent(() => import("./components/OverviewPanel.vue"));
const InventoryPanel = defineAsyncComponent(() => import("./components/InventoryPanel.vue"));
const GrantCenter = defineAsyncComponent(() => import("./components/GrantCenter.vue"));
const ModPanel = defineAsyncComponent(() => import("./components/ModPanel.vue"));
const CheatPanel = defineAsyncComponent(() => import("./components/CheatPanel.vue"));
const AccountManagement = defineAsyncComponent(() => import("./components/AccountManagement.vue"));
import {
    getAccountRates,
    getAdminOverview,
    getAdminConfig,
    getInventory,
    setAdminConfig,
    type AccountRatesResponse,
    type AdminOverviewResponse,
    type Inventory
} from "./api";
import { useAuth } from "./auth";

const {
    account,
    authError,
    authz,
    connected,
    configChanged,
    inventoryChanged,
    login,
    logout,
    hasPermission,
    permissions
} = useAuth();

const mobileQuery = window.matchMedia("(max-width: 991px)");
const collapsed = ref(mobileQuery.matches);
const activeView = ref("dashboard");
const loginEmail = ref(localStorage.getItem("spaceninja.email") ?? "");
const loginPassword = ref("");
const registering = ref(false);
const inventory = ref<Inventory>();
const inventoryLoading = ref(false);
const inventoryError = ref("");
const inventoryUpdatedAt = ref<Date>();
const adminOverview = ref<AdminOverviewResponse>();
const isAdmin = ref(false);
const adminConfig = ref<Record<string, unknown> | null>();
const accountRates = ref<AccountRatesResponse>();
const adminPane = ref("cheats");
const adminBusy = ref(false);
const adminNotice = ref("");
const liveSync = ref(false);
const invasionMode = ref("official");

const themeConfig: ThemeConfig = {
    algorithm: theme.defaultAlgorithm,
    token: {
        colorPrimary: "#237b66",
        colorInfo: "#237b66",
        colorText: "#23332e",
        colorTextSecondary: "#75827c",
        colorBgLayout: "#f4f6f4",
        colorBorder: "#dce3de",
        colorBorderSecondary: "#e9ede9",
        borderRadius: 10,
        controlHeight: 40,
        fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    }
};

const viewTitles: Record<string, string> = {
    dashboard: "概览",
    inventory: "账户库存",
    mods: "Mod 管理",
    grants: "发放中心",
    accounts: "账户管理",
    admin: "管理后台"
};

const currencies = [
    { key: "RegularCredits", permission: "addCredits", label: "现金", name: "Credits", icon: "CR", color: "#a9782d" },
    { key: "PremiumCredits", permission: "addPlatinum", label: "白金", name: "Platinum", icon: "PL", color: "#557b9f" },
    { key: "FusionPoints", permission: "addEndo", label: "内融核心", name: "Endo", icon: "EN", color: "#237b66" },
    { key: "PrimeTokens", permission: "addRegalAya", label: "御品阿耶", name: "Regal Aya", icon: "RA", color: "#8a659b" }
];

const refreshInventory = async (): Promise<void> => {
    if (isAdmin.value) {
        await refreshGlobalOverview();
        return;
    }
    if (!authz.value || inventoryLoading.value) return;
    const currentAccountId = account.value?.id;
    inventoryLoading.value = true;
    inventoryError.value = "";
    try {
        const nextInventory = await getInventory(authz.value);
        if (account.value?.id !== currentAccountId) return;
        inventory.value = nextInventory;
        inventoryUpdatedAt.value = new Date();
    } catch (error) {
        if (account.value?.id === currentAccountId) {
            inventoryError.value = error instanceof Error ? error.message : String(error);
        }
    } finally {
        inventoryLoading.value = false;
    }
};

const refreshGlobalOverview = async (): Promise<void> => {
    if (!authz.value || inventoryLoading.value || !isAdmin.value) return;
    inventoryLoading.value = true;
    inventoryError.value = "";
    try {
        const nextOverview = await getAdminOverview(authz.value);
        adminOverview.value = nextOverview;
        inventory.value = nextOverview.inventory;
        inventoryUpdatedAt.value = new Date(nextOverview.generatedAt);
    } catch (error) {
        inventoryError.value = error instanceof Error ? error.message : String(error);
    } finally {
        inventoryLoading.value = false;
    }
};

const refreshAdmin = async (): Promise<void> => {
    if (!authz.value) return;
    adminConfig.value = await getAdminConfig(authz.value);
    isAdmin.value = adminConfig.value !== null;
    if (!isAdmin.value) {
        accountRates.value = undefined;
        adminOverview.value = undefined;
        return;
    }
    liveSync.value = adminConfig.value?.["worldState.liveSync"] === true;
    invasionMode.value = String(adminConfig.value?.["worldState.invasionMode"] ?? "official");
    accountRates.value = await getAccountRates(authz.value);
};

const runAdmin = async (action: () => Promise<unknown>, success: string): Promise<void> => {
    adminBusy.value = true;
    adminNotice.value = "";
    try {
        await action();
        message.success(success);
        await refreshAdmin();
    } catch (error) {
        adminNotice.value = error instanceof Error ? error.message : String(error);
    } finally {
        adminBusy.value = false;
    }
};

const submitLogin = (): void => {
    if (!loginEmail.value || !loginPassword.value) return;
    login(loginEmail.value, loginPassword.value, registering.value);
};

const selectView = (event: { key: string | number }): void => {
    activeView.value = String(event.key);
    if (window.matchMedia("(max-width: 991px)").matches) collapsed.value = true;
};

const saveConfig = (): void => {
    if (!authz.value) return;
    void runAdmin(
        () =>
            setAdminConfig(authz.value!, {
                "worldState.liveSync": liveSync.value,
                "worldState.invasionMode": invasionMode.value
            }),
        "服务器配置已保存"
    );
};

watch(account, async current => {
    if (!current) {
        inventory.value = undefined;
        inventoryUpdatedAt.value = undefined;
        inventoryError.value = "";
        adminOverview.value = undefined;
        accountRates.value = undefined;
        isAdmin.value = false;
        return;
    }
    loginPassword.value = "";
    try {
        await refreshAdmin();
        await (isAdmin.value ? refreshGlobalOverview() : refreshInventory());
    } catch (error) {
        message.error(error instanceof Error ? error.message : String(error));
    }
});

watch(inventoryChanged, () => void (isAdmin.value ? refreshGlobalOverview() : refreshInventory()));
watch(configChanged, () => void refreshAdmin());
watch(isAdmin, value => {
    if (value && activeView.value === "grants") activeView.value = "dashboard";
});

const syncNavigationBreakpoint = (event: MediaQueryListEvent): void => {
    collapsed.value = event.matches;
};

onMounted(() => mobileQuery.addEventListener("change", syncNavigationBreakpoint));
onBeforeUnmount(() => mobileQuery.removeEventListener("change", syncNavigationBreakpoint));
</script>

<template>
    <a-config-provider :locale="zhCN" :theme="themeConfig">
        <LoginPanel
            v-if="!account"
            v-model:email="loginEmail"
            v-model:password="loginPassword"
            v-model:registering="registering"
            :connected="connected"
            :error="authError"
            @submit="submitLogin"
        />
        <a-layout v-else class="shell">
            <a-layout-sider v-model:collapsed="collapsed" :trigger="null" width="248" :collapsed-width="0" class="sider">
                <div class="brand app-brand">
                    <div class="brand-mark"><span></span><span></span><span></span></div>
                    <div v-if="!collapsed" class="brand-copy"><strong>SpaceNinja</strong><small>SERVER CONSOLE</small></div>
                </div>
                <div v-if="!collapsed" class="nav-label">WORKSPACE</div>
                <a-menu :selected-keys="[activeView]" theme="dark" mode="inline" @click="selectView">
                    <a-menu-item key="dashboard"><template #icon><DashboardOutlined /></template>概览</a-menu-item>
                    <a-menu-item key="inventory"><template #icon><DatabaseOutlined /></template>库存</a-menu-item>
                     <a-menu-item key="mods"><template #icon><ExperimentOutlined /></template>Mod 管理</a-menu-item>
                     <a-menu-item v-if="!isAdmin" key="grants"><template #icon><GiftOutlined /></template>发放中心</a-menu-item>
                     <a-menu-item v-if="isAdmin" key="accounts"><template #icon><UserOutlined /></template>账户管理</a-menu-item>
                     <a-menu-item v-if="isAdmin" key="admin"><template #icon><SettingOutlined /></template>管理后台</a-menu-item>
                </a-menu>
                <div class="sider-footer">
                    <div class="connection-state"><span class="status-dot" :class="{ online: connected }"></span><span v-if="!collapsed">{{ connected ? '实时连接' : '正在重连' }}</span></div>
                    <span v-if="!collapsed" class="server-version">SpaceNinjaServer</span>
                </div>
            </a-layout-sider>
            <button v-if="!collapsed" class="nav-backdrop" aria-label="关闭导航菜单" @click="collapsed = true"></button>
            <a-layout class="app-layout">
                <a-layout-header class="topbar">
                    <div class="topbar-left">
                        <a-button type="text" class="collapse-button" :aria-label="collapsed ? '展开导航菜单' : '收起导航菜单'" :aria-expanded="!collapsed" @click="collapsed = !collapsed"><MenuUnfoldOutlined v-if="collapsed" /><MenuFoldOutlined v-else /></a-button>
                        <div class="topbar-title"><span class="eyebrow">SERVER CONSOLE / WORKSPACE</span><strong>{{ viewTitles[activeView] }}</strong></div>
                    </div>
                    <div class="topbar-actions">
                        <a-tag class="connection-tag" :color="connected ? 'success' : 'warning'"><span class="status-dot" :class="{ online: connected }"></span>{{ connected ? '服务在线' : '正在重连' }}</a-tag>
                        <span class="header-divider"></span>
                        <a-avatar size="small" class="user-avatar"><UserOutlined /></a-avatar>
                        <div class="user-meta"><strong>{{ account.DisplayName }}</strong><span>{{ isAdmin ? '管理员账户' : '操作员账户' }}</span></div>
                        <a-button type="text" class="header-logout" title="退出登录" @click="logout"><LogoutOutlined /></a-button>
                    </div>
                </a-layout-header>
                <a-layout-content class="content">
                    <div class="content-inner">
                        <OverviewPanel
                            v-if="activeView === 'dashboard'"
                            :display-name="account.DisplayName"
                            :inventory="inventory"
                            :currencies="currencies"
                            :connected="connected"
                            :is-admin="isAdmin"
                            :global-stats="adminOverview"
                            :can-grant="currencies.some(currency => hasPermission(currency.permission)) || hasPermission('addDirac') || hasPermission('addItems')"
                            :loading="inventoryLoading"
                            :error="inventoryError"
                            :updated-at="inventoryUpdatedAt"
                            @refresh="refreshInventory"
                            @navigate="selectView({ key: $event })"
                        />
                        <InventoryPanel
                            v-else-if="activeView === 'inventory'"
                            :inventory="inventory"
                            :global-view="isAdmin"
                            :loading="inventoryLoading"
                            :error="inventoryError"
                            :updated-at="inventoryUpdatedAt"
                            @refresh="refreshInventory"
                        />
                        <ModPanel
                            v-else-if="activeView === 'mods'"
                            :authz="authz"
                            :inventory="inventory"
                            :global-view="isAdmin"
                            :permissions="permissions"
                            @refresh="refreshInventory"
                        />
                         <GrantCenter
                             v-else-if="activeView === 'grants' && !isAdmin"
                            :authz="authz"
                            :account-name="account.DisplayName"
                            :account-id="account.id"
                            :inventory="inventory"
                            :permissions="permissions"
                            :connected="connected"
                            @refresh="refreshInventory"
                        />
                         <AccountManagement
                             v-else-if="activeView === 'accounts'"
                             :authz="authz"
                             :data="accountRates"
                             :permissions="permissions"
                             :connected="connected"
                             :loading="adminBusy"
                             @refresh="refreshAdmin"
                         />
                         <section v-else class="page-section">
                            <div class="page-heading"><div><div class="eyebrow">SERVER ADMINISTRATION</div><h1>管理后台</h1><p class="muted">管理账户倍率、作弊选项和服务器控制状态。</p></div><a-button :loading="adminBusy" @click="refreshAdmin"><ReloadOutlined />刷新数据</a-button></div>
                            <a-alert v-if="adminNotice" type="error" :message="adminNotice" show-icon class="admin-alert" />
                             <a-tabs v-model:active-key="adminPane" class="admin-tabs">
                                 <a-tab-pane key="cheats" tab="作弊选项"><CheatPanel :authz="authz" :config="adminConfig" :busy="adminBusy" @refresh="refreshAdmin" /></a-tab-pane>
                                  <a-tab-pane key="status" tab="系统状态"><div class="dashboard-grid"><a-card class="panel-card" title="世界状态配置" :bordered="false"><a-form layout="vertical"><a-form-item label="实时世界状态同步"><a-switch v-model:checked="liveSync" /></a-form-item><a-form-item label="入侵数据来源"><a-select v-model:value="invasionMode" :options="[{ value: 'official', label: '官方' }, { value: 'local', label: '本地' }, { value: 'hybrid', label: '混合' }]" /></a-form-item><a-button type="primary" :loading="adminBusy" @click="saveConfig"><SaveOutlined />保存服务器配置</a-button></a-form></a-card></div></a-tab-pane>
                            </a-tabs>
                        </section>
                    </div>
                </a-layout-content>
                <a-layout-footer class="footer"><span>SpaceNinjaServer</span><span>为每一个私人宇宙而生。</span></a-layout-footer>
            </a-layout>
        </a-layout>
    </a-config-provider>
</template>
