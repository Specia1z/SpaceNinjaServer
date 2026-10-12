import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { whirlpoolReady } from "./whirlpool";

type AuthSuccess = { id: string; DisplayName: string; Nonce: number };
type WsMessage = {
    wsid?: number;
    auth_succ?: AuthSuccess;
    auth_fail?: string;
    permissions?: string[];
    update_inventory?: boolean;
    config_reloaded?: boolean;
    nonce_updated?: boolean;
};

const allPermissions = [
    "addItems",
    "addCredits",
    "addPlatinum",
    "addEndo",
    "addRegalAya",
    "addDirac",
    "manageQuests",
    "setBooster",
    "setInvigoration"
];

const socket = ref<WebSocket>();
const wsid = ref(0);
const account = ref<AuthSuccess>();
const permissions = ref<string[]>([]);
const authError = ref("");
const connected = ref(false);
const inventoryChanged = ref(0);
const configChanged = ref(0);
let reconnectTimer: number | undefined;

const email = () => localStorage.getItem("spaceninja.email") ?? "";
const password = () => localStorage.getItem("spaceninja.password") ?? "";

const encodedPassword = (): string => {
    const result = window.wp?.encSync(password());
    if (!result) throw new Error("WebUI password encoder is unavailable");
    return result;
};

const sendAuth = (register = false): void => {
    if (socket.value?.readyState !== WebSocket.OPEN || !email() || !password()) return;
    socket.value.send(
        JSON.stringify({
            auth: {
                email: email().toLowerCase(),
                password: encodedPassword(),
                isRegister: register,
                allPermissions
            }
        })
    );
};

const connect = (): void => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${location.host}/custom/ws`);
    socket.value = ws;
    ws.onopen = () => {
        connected.value = true;
        authError.value = "";
        try {
            sendAuth();
        } catch (error) {
            authError.value = error instanceof Error ? error.message : String(error);
        }
    };
    ws.onmessage = event => {
        const message = JSON.parse(String(event.data)) as WsMessage;
        if (message.wsid !== undefined) wsid.value = message.wsid;
        if (message.auth_succ) account.value = message.auth_succ;
        if (message.permissions) permissions.value = message.permissions;
        if (message.auth_fail) {
            authError.value = message.auth_fail;
            account.value = undefined;
        }
        if (message.update_inventory !== undefined) inventoryChanged.value++;
        if (message.config_reloaded !== undefined) configChanged.value++;
        if (message.nonce_updated !== undefined) sendAuth();
    };
    ws.onclose = () => {
        connected.value = false;
        if (reconnectTimer === undefined) {
            reconnectTimer = window.setTimeout(() => {
                reconnectTimer = undefined;
                connect();
            }, 2500);
        }
    };
};

const logout = (): void => {
    socket.value?.send(JSON.stringify({ logout: true }));
    localStorage.removeItem("spaceninja.email");
    localStorage.removeItem("spaceninja.password");
    account.value = undefined;
    permissions.value = [];
};

export const useAuth = () => {
    onMounted(async () => {
        try {
            await whirlpoolReady;
            if (!socket.value || socket.value.readyState === WebSocket.CLOSED) connect();
        } catch (error) {
            authError.value = error instanceof Error ? error.message : String(error);
        }
    });
    onBeforeUnmount(() => {
        if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
    });

    return {
        account,
        authError,
        connected,
        configChanged,
        inventoryChanged,
        permissions,
        authz: computed(() =>
            account.value ? `accountId=${account.value.id}&nonce=${account.value.Nonce}&wsid=${wsid.value}` : ""
        ),
        login: (nextEmail: string, nextPassword: string, register: boolean) => {
            localStorage.setItem("spaceninja.email", nextEmail);
            localStorage.setItem("spaceninja.password", nextPassword);
            authError.value = "";
            try {
                sendAuth(register);
            } catch (error) {
                authError.value = error instanceof Error ? error.message : String(error);
            }
        },
        logout,
        hasPermission: (permission: string) => permissions.value.includes(permission)
    };
};
