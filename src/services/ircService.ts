import fs from "node:fs";
import type { AddressInfo } from "node:net";
import tls from "node:tls";
import { logger } from "../utils/logger.ts";

export interface IIrcServerOptions {
    address: string;
    ports: number[];
    certFile: string;
    keyFile: string;
    validateCredentials?: (accountId: string, token: string) => Promise<boolean>;
}

interface IIrcClientSession {
    socket: tls.TLSSocket;
    buffer: string;
    nick?: string;
    user?: string;
    accountId?: string;
    credentialsValid: boolean;
    credentialValidationPending: boolean;
    registered: boolean;
    capNegotiating: boolean;
    capabilities: Set<string>;
    channels: Set<string>;
    monitors: Set<string>;
    away?: string;
}

interface IParsedIrcLine {
    command: string;
    params: string[];
}

const supportedCapabilities = new Set(["away-notify", "monitor"]);

const parseIrcLine = (line: string): IParsedIrcLine | undefined => {
    let rest = line;
    if (!rest.trim()) return undefined;
    if (rest.startsWith(":")) {
        const prefixEnd = rest.indexOf(" "),
            prefixLength = prefixEnd + 1;
        if (prefixEnd == -1) return undefined;
        rest = rest.substring(prefixLength);
    }

    let trailing: string | undefined;
    const trailingIndex = rest.indexOf(" :");
    if (trailingIndex != -1) {
        trailing = rest.substring(trailingIndex + 2);
        rest = rest.substring(0, trailingIndex);
    }
    const params = rest.trim().split(/\s+/);
    const command = params.shift()?.toUpperCase();
    if (!command) return undefined;
    if (trailing !== undefined) params.push(trailing);
    return { command, params };
};

const casefold = (value: string): string => value.toLocaleLowerCase("en-US");

const stripPlatformSuffix = (nick: string): string => {
    const characters = [...nick];
    const last = characters.at(-1)?.codePointAt(0);
    if (last !== undefined && last >= 0xe000 && last <= 0xe00f) {
        characters.pop();
    }
    return characters.join("");
};

const nickKey = (nick: string): string => casefold(stripPlatformSuffix(nick));

export class WarframeIrcServer {
    private readonly options: IIrcServerOptions;
    private readonly servers: tls.Server[] = [];
    private readonly sessions = new Set<IIrcClientSession>();
    private readonly clientsByNick = new Map<string, IIrcClientSession>();
    private readonly channels = new Map<string, Set<IIrcClientSession>>();
    private readonly listeningPorts: number[] = [];

    public constructor(options: IIrcServerOptions) {
        this.options = options;
    }

    public async start(): Promise<number[]> {
        const tlsOptions: tls.TlsOptions = {
            cert: fs.readFileSync(this.options.certFile),
            key: fs.readFileSync(this.options.keyFile),
            minVersion: "TLSv1.2"
        };

        try {
            await Promise.all(
                this.options.ports.map(
                    port =>
                        new Promise<void>((resolve, reject) => {
                            const server = tls.createServer(tlsOptions, socket => this.handleConnection(socket));
                            const onError = (error: Error): void => reject(error);
                            server.once("error", onError);
                            server.listen(port, this.options.address, () => {
                                server.off("error", onError);
                                server.on("error", error => logger.error(`IRC listener error: ${error.message}`));
                                this.servers.push(server);
                                this.listeningPorts.push((server.address() as AddressInfo).port);
                                resolve();
                            });
                        })
                )
            );
        } catch (error) {
            await this.stop();
            throw error;
        }
        return [...this.listeningPorts];
    }

    public async stop(): Promise<void> {
        for (const session of this.sessions) session.socket.destroy();
        await Promise.all(
            this.servers.map(
                server =>
                    new Promise<void>(resolve => {
                        server.close(() => resolve());
                    })
            )
        );
        this.servers.length = 0;
        this.listeningPorts.length = 0;
        this.sessions.clear();
        this.clientsByNick.clear();
        this.channels.clear();
    }

    private handleConnection(socket: tls.TLSSocket): void {
        socket.setEncoding("utf8");
        socket.setKeepAlive(true, 30_000);
        const session: IIrcClientSession = {
            socket,
            buffer: "",
            registered: false,
            credentialsValid: !this.options.validateCredentials,
            credentialValidationPending: false,
            capNegotiating: false,
            capabilities: new Set(),
            channels: new Set(),
            monitors: new Set()
        };
        this.sessions.add(session);
        this.send(session, "NOTICE * :Auth AAAAAAA:*** skipping identd (disabled by server administrator)");

        socket.on("data", data => {
            session.buffer += String(data);
            if (session.buffer.length > 65_536) {
                socket.destroy(new Error("IRC input buffer exceeded limit"));
                return;
            }
            let lineEnd = session.buffer.indexOf("\n");
            while (lineEnd != -1) {
                const line = session.buffer.substring(0, lineEnd).replace(/\r$/, "");
                session.buffer = session.buffer.substring(lineEnd + 1);
                this.handleLine(session, line);
                lineEnd = session.buffer.indexOf("\n");
            }
        });
        socket.on("close", () => this.removeSession(session));
        socket.on("error", error => logger.debug(`IRC client error: ${error.message}`));
    }

    private handleLine(session: IIrcClientSession, line: string): void {
        const parsed = parseIrcLine(line);
        if (!parsed) return;
        if (parsed.command == "PASS") {
            logger.trace(`IRC ${session.socket.remoteAddress ?? "unknown"} PASS`);
        } else if (parsed.command == "USER") {
            logger.trace(`IRC ${session.socket.remoteAddress ?? "unknown"} USER ${parsed.params[0] ?? ""}`);
        } else if (parsed.command == "PRIVMSG" || parsed.command == "NOTICE") {
            logger.trace(
                `IRC ${parsed.command} from=${session.nick ?? "*"} to=${parsed.params[0] ?? ""} payload=${JSON.stringify(parsed.params[1] ?? "")}`
            );
        } else {
            logger.trace(`IRC ${session.nick ?? session.socket.remoteAddress ?? "unknown"} ${line}`);
        }

        switch (parsed.command) {
            case "CAP":
                this.handleCap(session, parsed.params);
                return;
            case "PASS":
                return;
            case "NICK":
                this.handleNick(session, parsed.params[0]);
                return;
            case "USER":
                this.handleUser(session, parsed.params);
                return;
            case "PING":
                this.send(session, `:Soup PONG Soup :${parsed.params.at(-1) ?? "Soup"}`);
                return;
            case "PONG":
                return;
            case "QUIT":
                session.socket.end();
                return;
            case "JOIN":
                this.handleJoin(session, parsed.params[0]);
                return;
            case "PART":
                this.handlePart(session, parsed.params[0], parsed.params[1]);
                return;
            case "PRIVMSG":
            case "NOTICE":
                this.handleMessage(session, parsed.command, parsed.params[0], parsed.params[1]);
                return;
            case "ISON":
                this.handleIson(session, parsed.params);
                return;
            case "USERHOST":
                this.handleUserhost(session, parsed.params);
                return;
            case "WHOIS":
                this.handleWhois(session, parsed.params.at(-1));
                return;
            case "WHO":
                this.handleWho(session, parsed.params[0]);
                return;
            case "AWAY":
                this.handleAway(session, parsed.params[0]);
                return;
            case "MONITOR":
                this.handleMonitor(session, parsed.params);
                return;
            case "WATCH":
                this.handleWatch(session, parsed.params);
                return;
            case "NAMES":
                this.sendNames(session, parsed.params[0]);
                return;
            case "LIST":
                this.send(session, `:Soup 321 ${this.nickOrStar(session)} Channel :Users Name`);
                for (const [name, members] of this.channels) {
                    this.send(session, `:Soup 322 ${this.nickOrStar(session)} ${name} ${members.size} :`);
                }
                this.send(session, `:Soup 323 ${this.nickOrStar(session)} :End of /LIST`);
                return;
            case "MODE":
                this.handleMode(session, parsed.params);
                return;
            case "MOTD":
                this.sendMotd(session);
                return;
            default:
                logger.trace(`IRC unsupported command ${parsed.command}`);
        }
    }

    private handleCap(session: IIrcClientSession, params: string[]): void {
        const subcommand = params[0]?.toUpperCase();
        if (subcommand == "LS") {
            session.capNegotiating = true;
            this.send(session, `:Soup CAP * LS :${[...supportedCapabilities].join(" ")}`);
        } else if (subcommand == "REQ") {
            const requested = (params.at(-1) ?? "")
                .split(/\s+/)
                .filter(capability => supportedCapabilities.has(capability));
            for (const capability of requested) session.capabilities.add(capability);
            this.send(session, `:Soup CAP * ACK :${requested.join(" ")}`);
        } else if (subcommand == "END") {
            session.capNegotiating = false;
            this.tryRegister(session);
        }
    }

    private handleNick(session: IIrcClientSession, requestedNick: string | undefined): void {
        const nick = requestedNick?.replace(/^:/, "");
        if (!nick) return;
        const existing = this.findClient(nick);
        if (existing && existing != session) {
            this.send(session, `:Soup 433 * ${nick} :Nickname is already in use`);
            return;
        }
        const oldNick = session.nick;
        if (oldNick) this.clientsByNick.delete(casefold(oldNick));
        session.nick = nick;
        if (session.registered) {
            this.clientsByNick.set(casefold(nick), session);
            this.broadcastShared(session, `:${oldNick}!${this.userOrDefault(session)}@Soup NICK :${nick}`);
        }
        this.tryRegister(session);
    }

    private handleUser(session: IIrcClientSession, params: string[]): void {
        const user = params[0];
        if (!user) return;
        // U44 appends an IRC connection index (for example, _0) to the 24-character account id.
        const accountId = user.substring(0, 24);
        session.user = user;
        session.accountId = accountId;
        const realname = params.at(-1) ?? "";
        let token = "";
        if (realname.startsWith("token=")) token = realname.substring(6);
        if (this.options.validateCredentials) {
            session.credentialsValid = false;
            if (!token) {
                this.send(session, ":Soup WALLOPS :Failed to validate your credentials.");
                return;
            }
            session.credentialValidationPending = true;
            void this.options
                .validateCredentials(accountId, token)
                .then(valid => {
                    if (!this.sessions.has(session) || session.accountId != accountId) return;
                    session.credentialValidationPending = false;
                    session.credentialsValid = valid;
                    if (valid) this.tryRegister(session);
                    else this.send(session, ":Soup WALLOPS :Failed to validate your credentials.");
                })
                .catch(() => {
                    if (!this.sessions.has(session) || session.accountId != accountId) return;
                    session.credentialValidationPending = false;
                    logger.warn("IRC credential validation request failed");
                    this.send(session, ":Soup WALLOPS :Failed to validate your credentials.");
                });
            return;
        }
        this.tryRegister(session);
    }

    private tryRegister(session: IIrcClientSession): void {
        if (
            session.registered ||
            session.capNegotiating ||
            session.credentialValidationPending ||
            !session.credentialsValid ||
            !session.nick ||
            !session.user
        )
            return;
        session.registered = true;
        this.clientsByNick.set(casefold(session.nick), session);
        this.send(session, `:Soup 001 ${session.nick} :Welcome to the Warframe IRC service ${session.nick}`);
        this.send(session, `:Soup 002 ${session.nick} :Your host is Soup`);
        this.send(session, `:Soup 003 ${session.nick} :This server was created for local U44 clients`);
        this.send(session, `:Soup 004 ${session.nick} Soup 1.0 io mt`);
        this.send(session, `:Soup 005 ${session.nick} CASEMAPPING=ascii MONITOR=100 :are supported by this server`);
        this.send(session, `:Soup 251 ${session.nick} :There are ${this.clientsByNick.size} users`);
        this.send(session, `:Soup 305 ${session.nick} :You are no longer marked as being away`);
        this.sendMotd(session);
        this.notifyAvailability(session, true);
        logger.info(`IRC client registered as ${session.nick}`);
    }

    private handleJoin(session: IIrcClientSession, channelList: string | undefined): void {
        if (!session.registered || !channelList) return;
        for (const channelName of channelList.split(",")) {
            const key = casefold(channelName);
            let members = this.channels.get(key);
            if (!members) {
                members = new Set();
                this.channels.set(key, members);
            }
            members.add(session);
            session.channels.add(key);
            this.broadcast(members, `:${this.prefix(session)} JOIN :${channelName}`);
            this.send(session, `:Soup 331 ${session.nick} ${channelName} :No topic is set`);
            this.sendNames(session, channelName);
        }
    }

    private handlePart(session: IIrcClientSession, channelName: string | undefined, reason: string | undefined): void {
        if (!channelName) return;
        const key = casefold(channelName);
        const members = this.channels.get(key);
        if (!members?.has(session)) return;
        this.broadcast(members, `:${this.prefix(session)} PART ${channelName} :${reason ?? "Leaving"}`);
        members.delete(session);
        session.channels.delete(key);
        if (members.size == 0) this.channels.delete(key);
    }

    private handleMessage(
        session: IIrcClientSession,
        command: "PRIVMSG" | "NOTICE",
        target: string | undefined,
        message: string | undefined
    ): void {
        if (!session.registered) {
            logger.warn(`IRC ${command} dropped from ${session.nick ?? "*"}: client is not registered`);
            return;
        }
        if (!target || message === undefined) return;
        if (target.startsWith("#")) {
            const members = this.channels.get(casefold(target));
            if (!members) {
                if (command == "PRIVMSG") this.send(session, `:Soup 403 ${session.nick} ${target} :No such channel`);
                return;
            }
            for (const member of members) {
                if (member != session) this.send(member, `:${this.prefix(session)} ${command} ${target} :${message}`);
            }
            return;
        }
        const recipient = this.findClient(target);
        if (!recipient) {
            if (command == "PRIVMSG") this.send(session, `:Soup 401 ${session.nick} ${target} :No such nick`);
            return;
        }
        this.send(recipient, `:${this.prefix(session)} ${command} ${recipient.nick} :${message}`);
        logger.trace(`IRC ${command} delivered from=${session.nick} to=${recipient.nick}`);
        if (recipient.away && command == "PRIVMSG") {
            this.send(session, `:Soup 301 ${session.nick} ${recipient.nick} :${recipient.away}`);
        }
    }

    private handleIson(session: IIrcClientSession, params: string[]): void {
        const requested = params.join(" ").split(/\s+/).filter(Boolean);
        const online = requested.flatMap(nick => this.findClient(nick)?.nick ?? []);
        this.send(session, `:Soup 303 ${this.nickOrStar(session)} :${online.join(" ")}`);
    }

    private handleUserhost(session: IIrcClientSession, params: string[]): void {
        const entries = params.flatMap(nick => {
            const client = this.findClient(nick);
            return client?.nick ? [`${client.nick}=+${client.user ?? "user"}@Soup`] : [];
        });
        this.send(session, `:Soup 302 ${this.nickOrStar(session)} :${entries.join(" ")}`);
    }

    private handleWhois(session: IIrcClientSession, requestedNick: string | undefined): void {
        if (!requestedNick) return;
        const client = this.findClient(requestedNick);
        if (!client?.nick) {
            this.send(session, `:Soup 401 ${this.nickOrStar(session)} ${requestedNick} :No such nick`);
            return;
        }
        this.send(
            session,
            `:Soup 311 ${this.nickOrStar(session)} ${client.nick} ${client.user ?? "user"} Soup * :${client.nick}`
        );
        this.send(session, `:Soup 312 ${this.nickOrStar(session)} ${client.nick} Soup :Local Warframe IRC`);
        if (client.away) this.send(session, `:Soup 301 ${this.nickOrStar(session)} ${client.nick} :${client.away}`);
        if (client.channels.size != 0) {
            this.send(
                session,
                `:Soup 319 ${this.nickOrStar(session)} ${client.nick} :${[...client.channels].join(" ")}`
            );
        }
        this.send(session, `:Soup 318 ${this.nickOrStar(session)} ${client.nick} :End of /WHOIS list`);
    }

    private handleWho(session: IIrcClientSession, mask: string | undefined): void {
        const candidates = mask?.startsWith("#")
            ? [...(this.channels.get(casefold(mask)) ?? [])]
            : mask
              ? [this.findClient(mask)].filter((client): client is IIrcClientSession => !!client)
              : [...this.sessions].filter(client => client.registered);
        for (const client of candidates) {
            if (!client.nick) continue;
            this.send(
                session,
                `:Soup 352 ${this.nickOrStar(session)} ${mask ?? "*"} ${client.user ?? "user"} Soup Soup ${client.nick} ${client.away ? "G" : "H"} :0 ${client.nick}`
            );
        }
        this.send(session, `:Soup 315 ${this.nickOrStar(session)} ${mask ?? "*"} :End of /WHO list`);
    }

    private handleAway(session: IIrcClientSession, message: string | undefined): void {
        session.away = message || undefined;
        this.send(
            session,
            session.away
                ? `:Soup 306 ${this.nickOrStar(session)} :You have been marked as being away`
                : `:Soup 305 ${this.nickOrStar(session)} :You are no longer marked as being away`
        );
        if (session.nick) {
            for (const observer of this.sessions) {
                if (observer != session && observer.capabilities.has("away-notify")) {
                    this.send(observer, `:${this.prefix(session)} AWAY${session.away ? ` :${session.away}` : ""}`);
                }
            }
        }
    }

    private handleMonitor(session: IIrcClientSession, params: string[]): void {
        const operation = params[0];
        if (operation == "C") {
            session.monitors.clear();
            return;
        }
        if (operation == "L") {
            this.send(session, `:Soup 732 ${this.nickOrStar(session)} :${[...session.monitors].join(",")}`);
            this.send(session, `:Soup 733 ${this.nickOrStar(session)} :End of MONITOR list`);
            return;
        }
        if (operation == "S") {
            const online: string[] = [],
                offline: string[] = [];
            for (const monitored of session.monitors) {
                const client = this.findClient(monitored);
                if (client?.nick) online.push(client.nick);
                else offline.push(monitored);
            }
            if (online.length) this.send(session, `:Soup 730 ${this.nickOrStar(session)} :${online.join(",")}`);
            if (offline.length) this.send(session, `:Soup 731 ${this.nickOrStar(session)} :${offline.join(",")}`);
            return;
        }
        if (operation != "+" && operation != "-") return;
        const nicks = (params[1] ?? "").split(",").filter(Boolean);
        for (const nick of nicks) {
            const key = nickKey(nick);
            if (operation == "+") session.monitors.add(key);
            else session.monitors.delete(key);
        }
        if (operation == "+") this.handleMonitor(session, ["S"]);
    }

    private handleWatch(session: IIrcClientSession, params: string[]): void {
        for (const entry of params) {
            if (entry == "C") {
                session.monitors.clear();
                continue;
            }
            const operation = entry[0];
            const nick = entry.substring(1);
            if (!nick || (operation != "+" && operation != "-")) continue;
            const key = nickKey(nick);
            if (operation == "+") session.monitors.add(key);
            else session.monitors.delete(key);
            const client = this.findClient(nick);
            if (client?.nick) {
                this.send(
                    session,
                    `:Soup 600 ${this.nickOrStar(session)} ${client.nick} ${client.user ?? "user"} Soup 0`
                );
            } else {
                this.send(session, `:Soup 601 ${this.nickOrStar(session)} ${nick} * * 0`);
            }
        }
    }

    private handleMode(session: IIrcClientSession, params: string[]): void {
        const target = params[0];
        if (!target) return;
        if (target.startsWith("#")) {
            this.send(session, `:Soup 324 ${this.nickOrStar(session)} ${target} +nt`);
        } else if (params[1]) {
            this.send(session, `:${this.prefix(session)} MODE ${target} :${params[1]}`);
        } else {
            this.send(session, `:Soup 221 ${this.nickOrStar(session)} +i`);
        }
    }

    private sendNames(session: IIrcClientSession, channelName: string | undefined): void {
        if (!channelName) return;
        const members = this.channels.get(casefold(channelName));
        const names = members ? [...members].flatMap(member => member.nick ?? []) : [];
        this.send(session, `:Soup 353 ${this.nickOrStar(session)} = ${channelName} :${names.join(" ")}`);
        this.send(session, `:Soup 366 ${this.nickOrStar(session)} ${channelName} :End of /NAMES list`);
    }

    private sendMotd(session: IIrcClientSession): void {
        this.send(session, `:Soup 375 ${this.nickOrStar(session)} :- Soup Message of the Day -`);
        this.send(session, `:Soup 372 ${this.nickOrStar(session)} :- Local Warframe social service`);
        this.send(session, `:Soup 376 ${this.nickOrStar(session)} :End of /MOTD command`);
    }

    private removeSession(session: IIrcClientSession): void {
        if (!this.sessions.delete(session)) return;
        if (session.nick) {
            this.clientsByNick.delete(casefold(session.nick));
            this.broadcastShared(session, `:${this.prefix(session)} QUIT :Connection closed`);
            this.notifyAvailability(session, false);
            logger.info(`IRC client disconnected: ${session.nick}`);
        }
        for (const channel of session.channels) {
            const members = this.channels.get(channel);
            members?.delete(session);
            if (members?.size == 0) this.channels.delete(channel);
        }
    }

    private findClient(nick: string): IIrcClientSession | undefined {
        const exact = this.clientsByNick.get(casefold(nick));
        if (exact) return exact;
        const stripped = casefold(stripPlatformSuffix(nick));
        return [...this.clientsByNick.values()].find(
            client => client.nick && casefold(stripPlatformSuffix(client.nick)) == stripped
        );
    }

    private notifyAvailability(subject: IIrcClientSession, online: boolean): void {
        if (!subject.nick) return;
        const subjectKey = nickKey(subject.nick);
        for (const observer of this.sessions) {
            if (!observer.nick || !observer.monitors.has(subjectKey)) continue;
            const numeric = online ? 730 : 731;
            const value = online ? `${subject.nick}!${this.userOrDefault(subject)}@Soup` : subject.nick;
            this.send(observer, `:Soup ${numeric} ${observer.nick} :${value}`);
        }
    }

    private broadcastShared(session: IIrcClientSession, message: string): void {
        const recipients = new Set<IIrcClientSession>();
        for (const channel of session.channels) {
            for (const member of this.channels.get(channel) ?? []) recipients.add(member);
        }
        for (const recipient of recipients) this.send(recipient, message);
    }

    private broadcast(sessions: Iterable<IIrcClientSession>, message: string): void {
        for (const session of sessions) this.send(session, message);
    }

    private prefix(session: IIrcClientSession): string {
        return `${session.nick ?? "*"}!${this.userOrDefault(session)}@Soup`;
    }

    private userOrDefault(session: IIrcClientSession): string {
        return session.user ?? "user";
    }

    private nickOrStar(session: IIrcClientSession): string {
        return session.nick ?? "*";
    }

    private send(session: IIrcClientSession, line: string): void {
        if (!session.socket.destroyed) session.socket.write(line + "\r\n");
    }
}
