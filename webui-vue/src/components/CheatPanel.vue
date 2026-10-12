<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ReloadOutlined, SaveOutlined, SearchOutlined, ThunderboltOutlined } from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import {
    accountCheatCategories,
    accountCheatDefinitions,
    type AccountCheatDefinition,
    type AccountCheatValue
} from "../accountCheats";
import { setAdminConfig } from "../api";

const props = defineProps<{
    authz: string;
    config: Record<string, unknown> | null | undefined;
    busy?: boolean;
}>();

const emit = defineEmits<{
    refresh: [];
}>();

const search = ref("");
const activeCategory = ref("全部");
const draft = ref<Record<string, AccountCheatValue>>({});
const initial = ref<Record<string, AccountCheatValue>>({});
const saving = ref(false);

const setDraftFromConfig = (config: Record<string, unknown> | null | undefined): void => {
    const values = Object.fromEntries(
        accountCheatDefinitions.map(definition => {
            const value = config?.[`accountCheats.${definition.key}`];
            return [definition.key, typeof value === "boolean" || typeof value === "number" ? value : definition.defaultValue];
        })
    ) as Record<string, AccountCheatValue>;
    draft.value = { ...values };
    initial.value = { ...values };
};

watch(() => props.config, setDraftFromConfig, { immediate: true });

const categories = computed(() => ["全部", ...accountCheatCategories]);
const visibleDefinitions = computed(() => {
    const query = search.value.trim().toLowerCase();
    return accountCheatDefinitions.filter(definition => {
        const matchesCategory = activeCategory.value === "全部" || definition.category === activeCategory.value;
        const matchesSearch = !query || [definition.key, definition.label, definition.description].some(value => value.toLowerCase().includes(query));
        return matchesCategory && matchesSearch;
    });
});

const groupedDefinitions = computed(() => accountCheatCategories
    .map(category => ({
        category,
        definitions: visibleDefinitions.value.filter(definition => definition.category === category)
    }))
    .filter(group => group.definitions.length > 0));

const enabledCount = computed(() => accountCheatDefinitions.filter(definition => definition.type === "boolean" && draft.value[definition.key] === true).length);
const changedCount = computed(() => accountCheatDefinitions.filter(definition => draft.value[definition.key] !== initial.value[definition.key]).length);
const numericCount = computed(() => accountCheatDefinitions.filter(definition => definition.type === "number").length);

const definitionValue = (definition: AccountCheatDefinition): AccountCheatValue =>
    draft.value[definition.key] ?? definition.defaultValue;

const updateValue = (definition: AccountCheatDefinition, value: AccountCheatValue | null): void => {
    if (value === null) return;
    draft.value[definition.key] = value;
};

const resetDraft = (): void => {
    draft.value = { ...initial.value };
};

const resetDefaults = (): void => {
    draft.value = Object.fromEntries(accountCheatDefinitions.map(definition => [definition.key, definition.defaultValue]));
};

const save = async (): Promise<void> => {
    if (!changedCount.value || saving.value) return;
    const edits = Object.fromEntries(
        accountCheatDefinitions
            .filter(definition => draft.value[definition.key] !== initial.value[definition.key])
            .map(definition => [`accountCheats.${definition.key}`, draft.value[definition.key]])
    ) as Record<string, boolean | number>;
    saving.value = true;
    try {
        await setAdminConfig(props.authz, edits);
        message.success(`已保存 ${Object.keys(edits).length} 项作弊配置`);
        emit("refresh");
    } catch (error) {
        message.error(error instanceof Error ? error.message : String(error));
    } finally {
        saving.value = false;
    }
};
</script>

<template>
    <section class="cheat-panel">
        <div class="cheat-hero">
            <div class="cheat-hero-copy">
                <div class="eyebrow">SERVER OVERRIDES / ACCOUNT CHEATS</div>
                <h2>作弊选项</h2>
                <p>这些配置作用于服务器上的所有账户。修改后会通过实时配置同步生效。</p>
            </div>
            <div class="cheat-hero-icon"><ThunderboltOutlined /></div>
        </div>

        <div class="cheat-summary">
            <div><span class="summary-label">已启用开关</span><strong>{{ enabledCount }}</strong><small>项</small></div>
            <div><span class="summary-label">数值配置</span><strong>{{ numericCount }}</strong><small>项</small></div>
            <div :class="{ dirty: changedCount }"><span class="summary-label">待保存修改</span><strong>{{ changedCount }}</strong><small>项</small></div>
            <div class="summary-note"><span class="status-dot online"></span>服务器级配置</div>
        </div>

        <div class="cheat-toolbar">
            <a-input v-model:value="search" allow-clear placeholder="搜索名称、说明或配置键..." class="cheat-search">
                <template #prefix><SearchOutlined /></template>
            </a-input>
            <div class="cheat-categories">
                <button v-for="category in categories" :key="category" type="button" :class="{ active: activeCategory === category }" @click="activeCategory = category">{{ category }}</button>
            </div>
            <div class="cheat-actions">
                <a-button :disabled="!changedCount || saving" @click="resetDraft"><ReloadOutlined />撤销修改</a-button>
                <a-button :disabled="saving" @click="resetDefaults">恢复默认值</a-button>
                <a-button type="primary" :loading="saving || busy" :disabled="!changedCount" @click="save"><SaveOutlined />保存修改<span v-if="changedCount">（{{ changedCount }}）</span></a-button>
            </div>
        </div>

        <a-alert
            message="高影响配置"
            description="部分选项开启时会清理账户中的冷却、任务或 Nemesis 状态。保存后这些清理会在服务端执行。"
            type="warning"
            show-icon
            class="cheat-alert"
        />

        <div v-if="!visibleDefinitions.length" class="cheat-empty"><a-empty description="没有匹配的作弊选项" /></div>
        <div v-else class="cheat-groups">
            <section v-for="group in groupedDefinitions" :key="group.category" class="cheat-group">
                <div class="cheat-group-heading"><div><span class="group-kicker">CONFIG GROUP</span><h3>{{ group.category }}</h3></div><span>{{ group.definitions.length }} 项</span></div>
                <div class="cheat-grid">
                    <article v-for="definition in group.definitions" :key="definition.key" class="cheat-item" :class="{ enabled: definition.type === 'boolean' && definitionValue(definition) === true, changed: definitionValue(definition) !== initial[definition.key] }">
                        <div class="cheat-item-content">
                            <div class="cheat-item-title"><strong>{{ definition.label }}</strong><code>{{ definition.key }}</code></div>
                            <p>{{ definition.description }}</p>
                            <span v-if="definition.warning" class="cheat-warning">{{ definition.warning }}</span>
                        </div>
                        <a-switch
                            v-if="definition.type === 'boolean'"
                            :checked="definitionValue(definition) === true"
                            checked-children="开"
                            un-checked-children="关"
                            @update:checked="updateValue(definition, $event)"
                        />
                        <div v-else class="cheat-number-control">
                            <a-input-number
                                :value="Number(definitionValue(definition))"
                                :min="definition.min"
                                :max="definition.max"
                                :step="definition.step"
                                :addon-after="definition.suffix"
                                @update:value="updateValue(definition, $event)"
                            />
                        </div>
                    </article>
                </div>
            </section>
        </div>
    </section>
</template>

<style scoped>
.cheat-panel { display: flex; flex-direction: column; gap: 18px; }
.cheat-hero { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding: 26px 30px; color: #eaf7f1; background: linear-gradient(120deg, #12362f, #1e5d4e); border-radius: 12px; box-shadow: 0 14px 28px rgba(25, 91, 73, .14); }
.cheat-hero-copy { min-width: 0; }
.cheat-hero h2 { margin: 5px 0 6px; color: #fff; font-size: 27px; }
.cheat-hero p { margin: 0; color: #b8d8cc; }
.cheat-hero-icon { display: grid; flex: 0 0 60px; width: 60px; height: 60px; place-items: center; border: 1px solid rgba(255,255,255,.22); border-radius: 14px; color: #d7f7a6; font-size: 28px; background: rgba(255,255,255,.1); }
.cheat-summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(190px, auto); gap: 12px; }
.cheat-summary > div { display: flex; align-items: baseline; gap: 7px; padding: 15px 17px; border: 1px solid #e1e8e2; border-radius: 9px; background: #fff; }
.cheat-summary strong { color: #1f332d; font-size: 24px; }
.cheat-summary small { color: #8b9690; }
.summary-label { color: #75827c; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
.cheat-summary .dirty strong { color: #bd7225; }
.summary-note { justify-content: center; color: #237b66; font-size: 13px; font-weight: 700; }
.cheat-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.cheat-search { width: 280px; }
.cheat-categories { display: flex; gap: 5px; flex: 1; overflow-x: auto; padding-bottom: 2px; }
.cheat-categories button { flex: 0 0 auto; padding: 7px 11px; border: 1px solid transparent; border-radius: 7px; color: #75827c; background: transparent; cursor: pointer; font: inherit; font-size: 13px; }
.cheat-categories button:hover, .cheat-categories button.active { border-color: #b8d8cc; color: #17604e; background: #e9f4ef; }
.cheat-actions { display: flex; gap: 8px; }
.cheat-alert { border-radius: 8px; }
.cheat-groups { display: flex; flex-direction: column; gap: 24px; }
.cheat-group { min-width: 0; }
.cheat-group-heading { display: flex; align-items: end; justify-content: space-between; margin-bottom: 10px; }
.cheat-group-heading h3 { margin: 2px 0 0; color: #243630; font-size: 18px; }
.cheat-group-heading > span { color: #8a9790; font-size: 12px; }
.group-kicker { color: #8a9790; font-size: 10px; font-weight: 800; letter-spacing: .12em; }
.cheat-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.cheat-item { display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 106px; padding: 15px 16px; border: 1px solid #e1e8e2; border-radius: 9px; background: #fff; transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
.cheat-item:hover { border-color: #bdd6cb; box-shadow: 0 8px 18px rgba(35, 76, 61, .06); transform: translateY(-1px); }
.cheat-item.enabled { border-color: #9bceb9; background: #f7fcf9; }
.cheat-item.changed { box-shadow: inset 3px 0 #c48a36; }
.cheat-item-content { min-width: 0; }
.cheat-item-title { display: flex; flex-wrap: wrap; align-items: baseline; gap: 7px; }
.cheat-item-title strong { color: #243630; font-size: 14px; }
.cheat-item-title code { color: #8d9a93; font-size: 10px; overflow-wrap: anywhere; }
.cheat-item p { margin: 5px 0 0; color: #7a8780; font-size: 12px; line-height: 1.5; }
.cheat-warning { display: block; margin-top: 5px; color: #a56722; font-size: 11px; line-height: 1.4; }
.cheat-number-control { flex: 0 0 128px; }
.cheat-number-control :deep(.ant-input-number) { width: 100%; }
.cheat-empty { padding: 40px 0; background: #fff; border: 1px solid #e1e8e2; border-radius: 9px; }
@media (max-width: 1100px) { .cheat-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } .summary-note { justify-content: flex-start; } .cheat-toolbar { align-items: stretch; } .cheat-search { width: 100%; } .cheat-categories { order: 3; flex-basis: 100%; } }
@media (max-width: 720px) { .cheat-hero { padding: 20px; } .cheat-hero-icon { display: none; } .cheat-summary, .cheat-grid { grid-template-columns: 1fr; } .cheat-actions { width: 100%; } .cheat-actions .ant-btn { flex: 1; } .cheat-item { align-items: flex-start; } }
</style>
