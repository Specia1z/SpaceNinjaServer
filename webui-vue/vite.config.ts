import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
    root: fileURLToPath(new URL(".", import.meta.url)),
    base: "/webui/",
    plugins: [vue()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url))
        }
    },
    build: {
        outDir: fileURLToPath(new URL("../static/webui", import.meta.url)),
        emptyOutDir: false,
        assetsDir: "assets",
        rollupOptions: {
            output: {
                manualChunks(id) {
                    const normalizedId = id.replaceAll("\\", "/");
                    if (normalizedId.includes("/node_modules/ant-design-vue/")) {
                        const match = normalizedId.match(/ant-design-vue\/(?:es|lib)\/([^/]+)/);
                        return `antd-${match?.[1] ?? "shared"}`;
                    }
                    if (normalizedId.includes("/node_modules/@ant-design/icons-vue/")) return "antd-icons";
                    if (normalizedId.includes("/node_modules/vue/")) return "vue";
                    return undefined;
                }
            }
        }
    },
    server: {
        port: 5174,
        proxy: {
            "/api": "http://localhost",
            "/custom": "http://localhost"
        }
    }
});
