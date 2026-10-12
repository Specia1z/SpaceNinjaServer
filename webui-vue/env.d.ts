/// <reference types="vite/client" />

interface Window {
    wp?: {
        encSync(input: string): string | null;
    };
}
