# SpaceNinjaServer

[English](README.md) | 简体中文

SpaceNinjaServer 是基于 [OpenWF SpaceNinjaServer](https://onlyg.it/OpenWF/SpaceNinjaServer) 的独立二次开发版本，由 [Specia1z](https://github.com/Specia1z) 维护。项目用于私有服务器、兼容性研究、软件保存与开发测试，并非 Digital Extremes 的官方服务。

## 重要声明

使用、部署或修改本项目之前，请阅读以下内容：

- 本项目与 Digital Extremes Ltd.、Warframe 及其关联公司不存在从属、授权、赞助或认可关系。Warframe、相关名称、商标、美术资源和游戏内容的权利归各自权利人所有。
- 本项目仅按现状提供，不对适销性、特定用途适用性、持续可用性、数据完整性、兼容性、安全性或无侵权作出任何明示或默示保证。
- 使用者必须自行确认其使用行为符合所在地法律法规、软件许可、网络服务条款及其拥有的授权。不得将本项目用于未授权访问、破坏正式服务、规避技术保护措施、侵犯知识产权或其他违法用途。
- 本仓库适用 [LICENSE](LICENSE) 中的 AGPLv3 与 Commons Clause 条件。不得违反其中的非商业限制销售本软件，或提供主要价值来源于本软件的收费产品、托管服务或咨询支持服务。
- 部署者应自行承担账号、数据库、网络暴露、证书、第三方接口、客户端文件和数据备份产生的全部风险。请勿上传账号凭据、私钥、生产数据库或其他敏感信息。
- 实时世界状态来自第三方公开数据源，其准确性、合法性、可用性和持续性不由本项目维护者保证。部署者应评估相关数据源条款并承担使用责任。
- 本说明旨在明确项目边界，不构成法律意见，也不能保证免除任何司法管辖区下依法不能排除的责任。如计划公开运营、提供给第三方或处理真实用户数据，请先咨询合格的法律专业人士。

继续使用本项目，即表示你理解上述风险，并同意自行承担部署和使用责任。

## 当前特性

- 重点兼容 Warframe 42.0.11 客户端系列。
- 从公开数据源同步实时世界状态，并针对目标客户端过滤不兼容内容。
- 在 MongoDB 中独立维护 Goal 与入侵的全局进度、完成状态、重启恢复和延迟清理。
- 同步警报、活动、裂缝、突击、虚空风暴、集团任务、午夜电波、日历、深渊、Baro、Darvo、Varzia 和 Teshin 等数据。
- 提供账号初始化、任务解锁、新账号礼包、任务白金奖励、段位冷却和管理员配置选项。
- 提供基于浏览器的 WebUI，用于账号管理和服务器配置。

## 环境要求

- Windows 10/11 或常见 Linux 发行版。
- Node.js 24 或更高版本。
- Git。
- MongoDB 7 或更高版本；也可使用默认配置自动管理的嵌入式 MongoDB。
- 与服务器数据和 BuildLabel 映射兼容的客户端。

## Windows 部署

### 1. 下载代码

```powershell
git clone https://github.com/Specia1z/SpaceNinjaServer.git
Set-Location SpaceNinjaServer
```

### 2. 安装依赖

```powershell
npm ci
```

### 3. 创建配置

```powershell
Copy-Item config-vanilla.json config.json
```

至少检查以下配置：

- `myAddress`：客户端访问服务器时使用的域名或 IP。仅本机使用可保留 `localhost`。
- `bindAddress`：监听地址，默认 `0.0.0.0`。
- `httpPort`、`httpsPort`：默认 `80` 和 `443`。端口冲突时可改为其他端口。
- `administratorNames`：允许使用管理员功能的游戏账号名称。
- `webui.adminOnly`：是否仅允许管理员使用 WebUI。
- `worldState.liveSync`：是否启用实时世界状态同步。模板默认关闭。
- `database`：保留对象配置可使用本地持久化的嵌入式 MongoDB，也可替换为已有 MongoDB URI。

外部 MongoDB 示例：

```json
{
  "database": "mongodb://127.0.0.1:27017/openWF"
}
```

不要只保留上述片段覆盖整个配置文件；应仅替换原配置中的 `database` 字段。

### 4. 检查并启动

开发模式会自动重载代码：

```powershell
npm run verify
npm run dev
```

生产式构建：

```powershell
npm run build
npm start
```

默认 WebUI 地址为 `http://localhost/webui/`。如果修改了 HTTP 端口，例如 `8080`，则访问 `http://localhost:8080/webui/`。

## Linux 部署

以下命令假设 Node.js 24、Git 和构建环境已经安装：

```bash
git clone https://github.com/Specia1z/SpaceNinjaServer.git
cd SpaceNinjaServer
npm ci
cp config-vanilla.json config.json
npm run verify
npm run build
npm start
```

Linux 上普通用户通常不能直接监听 `80` 和 `443` 端口。推荐在 `config.json` 中使用高位端口，例如 `8080` 和 `8443`，再通过 Caddy、Nginx 或其他反向代理提供对外访问。不要为了方便长期使用 root 身份运行 Node.js 服务。

生产环境建议使用 systemd 或其他进程管理器保持服务运行，并在升级前备份 `config.json` 与 MongoDB 数据。

## Docker Compose 部署

当前 fork 的多架构 Web 镜像发布到 GitHub Container Registry：

- `ghcr.io/specia1z/spaceninjaserver:latest`：跟随 `main` 分支。
- `ghcr.io/specia1z/spaceninjaserver:<commit-sha>`：对应不可变的具体提交。

Compose 包含四个服务：

- `spaceninjaserver`：使用本仓库发布的 GHCR 镜像。
- `mongodb`：使用 MongoDB 官方镜像。
- `warframe-irc-server`：保留 `openwf/warframe-irc-server` 上游镜像。
- `warframe-hub-server`：保留 `openwf/warframe-hub-server` 上游镜像。

拉取镜像并启动完整服务：

```bash
docker compose pull
docker compose up -d
```

如果需要直接构建当前检出的源码，而不是使用已发布的 Web 镜像：

```bash
docker compose up -d --build
```

Web 服务占用 TCP `80` 和 `443`，IRC 服务占用 TCP `6665-6669` 与 `6695-6699`，Hub 服务占用 UDP `6952`。对公网开放前应根据实际需求配置防火墙，不需要的端口不要暴露。

首次启动时，容器会自动创建 `docker-data/conf/config.json`，并将数据库地址设置为 Compose 中的 MongoDB 服务。持久化目录包括：

- `docker-data/conf`：服务器配置。
- `docker-data/database`：MongoDB 数据。
- `docker-data/logs`：服务器日志。
- `docker-data/static-data`：运行时静态数据。

修改配置后重启服务：

```bash
docker compose restart spaceninjaserver
```

查看日志：

```bash
docker compose logs -f
```

停止服务但保留数据：

```bash
docker compose down
```

不要使用 `docker compose down -v`，除非你明确希望删除相关卷中的数据。

## 多平台 Release

GitHub Releases 提供 Windows x64、Linux x64/ARM64、macOS Intel 和 macOS Apple Silicon 五种运行包。每个包都包含已编译服务、生产依赖和对应的 Node.js 运行时，不需要另行安装 Node.js。

下载并解压对应平台文件后：

- Windows：运行 `start.cmd`。
- Linux/macOS：运行 `./start.sh`。

启动脚本会在首次运行时从 `config-vanilla.json` 创建 `config.json`。同一 Release 中的 `SHA256SUMS.txt` 可用于校验附件完整性。默认模板可启动本地内嵌 MongoDB，生产环境也可以改为外部 MongoDB 连接字符串。

## 实时世界状态

在 `config.json` 中启用：

```json
{
  "worldState": {
    "liveSync": true
  }
}
```

同样不要用该片段覆盖完整配置，只修改现有 `worldState.liveSync` 字段。

启用后，服务器会同步受支持的官方活动定义，同时进行客户端版本兼容过滤。Goal 与入侵活动的官方 ID、节点、阵营、奖励和时间作为快照保存；官方 `Count`、`CountAlt`、`HealthPct`、`Success` 和入侵 `Completed` 不会覆盖私服状态。全局进度由任务上报驱动并保存在 MongoDB，官方条目消失或数据源暂时不可用时，未过期的本地活动仍可恢复。

世界状态中的 `Events` 数组实际用于新闻和公告，不包含游戏活动进度字段，因此继续只同步公告定义。Fomorian/Razorback 类型活动使用本地 100 贡献目标递减生命值，其余可计数 Goal 按本地贡献递增；玩家个人奖励进度仍独立保存在玩家 Inventory 中。

## 安全建议

- 不要将 `config.json`、数据库目录、日志、私钥或账号导出文件提交到 Git；仓库已默认忽略常见本地数据。
- 对公网开放前，修改默认配置并限制 WebUI 管理权限。
- 使用可信证书和反向代理，不要将仓库内的开发证书视为生产证书。
- 限制 MongoDB 监听范围，不要把未认证的数据库端口暴露到公网。
- 定期备份 MongoDB 与配置文件，并验证备份能够恢复。
- 实时同步和第三方接口应设置合理的出站访问策略、监控与故障处理。

## 更新与检查

```bash
git pull --ff-only
npm ci
npm run verify
npm run build
```

提交代码前建议运行：

```bash
npm run verify
npm run lint
npm exec prettier -- --check .
git diff --check
```

版本变化请参阅 [CHANGELOG.md](CHANGELOG.md)，更多开发规范请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。许可证全文请参阅 [LICENSE](LICENSE)。
