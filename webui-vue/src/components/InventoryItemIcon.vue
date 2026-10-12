<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { DatabaseOutlined } from "@ant-design/icons-vue";

const props = withDefaults(defineProps<{ color: string; background: string; icon?: string; large?: boolean }>(), {
    icon: undefined,
    large: false
});
const imageFailed = ref(false);
const imageSource = computed(() => props.icon ? `https://browse.wf${props.icon}` : "");

watch(() => props.icon, () => { imageFailed.value = false; });
</script>

<template>
    <span class="inventory-item-icon" :class="{ 'is-large': large }" :style="{ color, background }">
        <img v-if="imageSource && !imageFailed" :src="imageSource" alt="" aria-hidden="true" referrerpolicy="no-referrer" @error="imageFailed = true" />
        <DatabaseOutlined v-else />
    </span>
</template>

<style scoped>
.inventory-item-icon { display: grid; width: 42px; height: 42px; flex: 0 0 auto; place-items: center; overflow: hidden; border-radius: 12px; font-size: 20px; }
.inventory-item-icon.is-large { width: 72px; height: 72px; border-radius: 18px; font-size: 28px; }
.inventory-item-icon img { width: 100%; height: 100%; object-fit: contain; }
</style>
