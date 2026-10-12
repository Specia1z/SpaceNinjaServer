<script setup lang="ts">
import { ArrowRightOutlined, LockOutlined, MailOutlined } from "@ant-design/icons-vue";
import OrbitArtwork from "./OrbitArtwork.vue";

defineProps<{ connected: boolean; error: string }>();
const email = defineModel<string>("email", { required: true });
const password = defineModel<string>("password", { required: true });
const registering = defineModel<boolean>("registering", { required: true });
defineEmits<{ submit: [] }>();
</script>

<template>
    <main class="login-page">
        <section class="login-story">
            <a href="/webui/" class="brand login-brand" aria-label="SpaceNinja 首页">
                <span class="brand-mark"><span></span><span></span><span></span></span>
                <span>SpaceNinja<span class="brand-caption">SERVER CONSOLE</span></span>
            </a>
            <div class="story-copy">
                <span class="story-kicker"><span></span> 你的服务器，你的世界</span>
                <h1>掌控每一刻。<br /><span>探索无限可能。</span></h1>
                <p>从账户到库存，从日常操作到世界状态。<br />让你的私人宇宙，井然有序。</p>
            </div>
            <div class="story-art"><OrbitArtwork /><span class="orbit-caption">YOUR UNIVERSE. YOUR RULES.</span></div>
            <div class="story-footer"><span>SPACE NINJA / CONTROL CENTER</span><span>01 — ∞</span></div>
        </section>
        <section class="login-workspace">
            <div class="login-topline"><span>私人服务器管理控制台</span><a-tag :color="connected ? 'success' : 'default'">{{ connected ? '服务已连接' : '正在连接服务' }}</a-tag></div>
            <div class="login-form-wrap">
                <div class="login-symbol"><LockOutlined /></div>
                <span class="eyebrow">开始管理你的世界</span>
                <h2>{{ registering ? '创建新账户' : '欢迎回来' }}</h2>
                <p class="muted">{{ registering ? '填写邮箱和密码，开启你的服务器之旅。' : '登录你的账户，进入 SpaceNinja 控制台。' }}</p>
                <a-alert v-if="error" type="error" :message="error" show-icon class="login-alert" />
                <a-form layout="vertical" class="login-form" @submit.prevent="$emit('submit')">
                    <a-form-item label="邮箱地址">
                        <a-input v-model:value="email" type="email" size="large" autocomplete="username" placeholder="请输入邮箱地址" required>
                            <template #prefix><MailOutlined /></template>
                        </a-input>
                    </a-form-item>
                    <a-form-item label="密码">
                        <a-input-password v-model:value="password" size="large" :autocomplete="registering ? 'new-password' : 'current-password'" placeholder="请输入密码" required>
                            <template #prefix><LockOutlined /></template>
                        </a-input-password>
                    </a-form-item>
                    <a-button type="primary" html-type="submit" block size="large" :loading="!connected" class="login-button">
                        {{ registering ? '创建账户' : '进入控制台' }}<ArrowRightOutlined />
                    </a-button>
                </a-form>
                <div class="login-register"><span>{{ registering ? '已经拥有账户？' : '还没有账户？' }}</span><a-button type="link" @click="registering = !registering">{{ registering ? '返回登录' : '创建账户' }}<ArrowRightOutlined /></a-button></div>
                <div class="login-hint"><LockOutlined /><span>使用你的服务器账户登录</span></div>
            </div>
            <footer class="login-footer"><span>SpaceNinjaServer</span><span>为每一个私人宇宙而生。</span></footer>
        </section>
    </main>
</template>
