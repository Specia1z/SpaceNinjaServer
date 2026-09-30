import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { repoDir } from "../helpers/pathHelper.ts";

interface IWhirlpool {
    encSync: (input: string, digest?: string) => string | null;
}

let whirlpool: IWhirlpool | undefined;

/**
 * WebUI has always sent Whirlpool(password) over its websocket login protocol.
 * Evaluate the same bundled implementation on the server so legacy WebUI
 * accounts can also authenticate through the player portal.
 */
export const whirlpoolHash = (input: string): string => {
    if (!whirlpool) {
        const source = fs.readFileSync(path.join(repoDir, "static/webui/libs/whirlpool-js.min.js"), "utf8");
        const context: { __whirlpool?: IWhirlpool } = {};
        vm.runInNewContext(`${source}\n;globalThis.__whirlpool = wp;`, context);
        if (!context.__whirlpool) throw new Error("Could not initialize the WebUI Whirlpool implementation");
        whirlpool = context.__whirlpool;
    }
    const result = whirlpool.encSync(input);
    return typeof result == "string" ? result.toLowerCase() : "";
};
