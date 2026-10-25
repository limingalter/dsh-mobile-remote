# dsh-mobile-remote

让手机通过 Tailscale 访问电脑上的 **DeepSeek Harness** Web GUI，和桌面端共享同一套
profile、插件与会话历史。

> 移动端适配插件基于 [cyanwell/dsh-agent-soul](https://github.com/cyanwell/dsh-agent-soul)
> 的 `plugins/mobile-adapt` 修改而来。来源与许可声明见
> [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

## 它能做什么

- 手机浏览器像 App 一样使用 DSH（对话、工具、审批、会话列表）
- 手机和电脑连的是**同一个 Host**：同一场对话、同一批工具、同一份历史
- 跨网络可用（不同 WiFi / 4G），因为走 Tailscale 虚拟内网，而不是局域网直连
- 附带一个移动端适配插件（基于社区插件增强）：横向标签、抽屉侧栏、长按会话菜单、输入栏单行布局等

## 前置条件

- Windows 10 / 11
- DeepSeek Harness 桌面版（已安装并至少启动过一次）
- [Tailscale](https://tailscale.com/download) 账号（免费个人版即可），电脑与手机登录同一账号

Tailscale 客户端本仓库**不打包分发**（官方更新频繁，自己装才能一直拿到最新版）：

```powershell
# Windows
winget install --id Tailscale.Tailscale -e
```

安卓端从 [官方下载页](https://tailscale.com/download) 或 Google Play 安装。
这样装出来的版本会自动跟随官方更新，避免出现旧客户端连不上的问题。

## 安装

1. 确保 DeepSeek Harness 能正常启动（这样 `~/.dsh/profiles/web` 会生成）
2. 安装 Tailscale，登录，确认 `tailscale status` 能看到本机
3. 克隆本仓库（或下载 ZIP 后解压）
4. 进入仓库根目录执行：

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install.ps1 -WorkDir "D:\dsh-work"
   ```

5. 按提示把服务发布到 tailnet（只需一次，之后开机自启由 Tailscale 服务负责）：

   ```powershell
   & "C:\Program Files\Tailscale\tailscale.exe" serve --bg 3080
   ```

   也可以在安装时加 `-Serve` 让脚本自动执行。

6. 双击生成的 `D:\dsh-work\start-remote.cmd`

   - 窗口里会打印一个带 `?token=` 的完整 URL，手机**首次**访问需要它
   - 脚本带了 `--no-open`，**不会**自动弹出浏览器；想先在电脑上确认链路是否通，
     把窗口里打印的 URL 复制出来自己打开即可
   - 如果**桌面端 DSH 还在运行**，双击后会因为端口被占用而失败，窗口显示
     `[WARN] Port 3080 is already in use.` —— 此时请**完全退出桌面端 DSH**
     （确认托盘和任务管理器里都没有残留进程），再重新双击
7. 手机安装 Tailscale 并登录同一账号，浏览器打开 `https://<设备名>.<tailnet>.ts.net/`
8. 首次访问需要启动窗口里打印的 `?token=...` 完整 URL；成功后 cookie 保留 30 天

## 参数

| 参数 | 默认 | 说明 |
|---|---|---|
| `-WorkDir` | 当前目录 | DSH 工作目录（会话按它分组） |
| `-ProfileName` | `remote` | 要创建的 profile 名 |
| `-Port` | `3080` | 本地监听端口 |
| `-DshPath` | 自动探测 | `dsh.cmd` 路径 |
| `-TailscalePath` | 自动探测 | `tailscale.exe` 路径 |
| `-Force` | 关 | 覆盖已存在的同名 profile |
| `-Serve` | 关 | 安装后自动执行 `tailscale serve` |

## 它会改什么

- 在 `~/.dsh/profiles/<ProfileName>` 新建一个 profile（从干净的 `web` 模板复制）
- 把 `plugin/dsh-agent-mobile-adapt` 放进该 profile 的 `node_modules`，并注册进 bundles
- 在 `-WorkDir` 生成 `start-remote.cmd`
- **不会**改动现有的 `desktop` / `remote` profile；不加 `-Force` 不会覆盖任何已有 profile

## 移动端适配插件

本仓库的移动端插件基于社区项目 [`dsh-agent-soul`](https://github.com/cyanwell/dsh-agent-soul) 中的 `plugins/mobile-adapt` 做了增强，改动集中在 `client.js`（上游约 340 行 → 本版约 566 行）。

这个适配层的目标是**尽可能完整地还原 PC 端 DSH 的界面**，而不是另做一套「手机版」。
所以侧栏、设置页、输入工具条的排布和逻辑都与 PC 端保持一致，没有为了「手机专用」做功能取舍：

| 区块 | 改动 |
|---|---|
| 输入区工具条 | 个性化胶囊限宽、模型按钮只留图标+箭头；五个按钮一行、42px 高 |
| 顶部 tabs | 伪元素扩大点击区域到约 43px（视觉不变） |
| 侧栏自动收起 | 点会话/新会话/面板项/工作区新建后自动收抽屉（保留弹键盘） |
| 侧栏长按 | 长按会话行 0.5s 弹出「…」菜单（置顶/重命名/分叉/归档/复制 ID）；禁用原生拖拽与系统长按菜单 |
| 浮层层级 | 菜单、设置页、重命名对话框、toast 统一压在抽屉之上 |
| 设置页 | 手机上改为顶部横向标签 + 全宽内容 |
| 复制 Session ID | 安卓剪贴板写入不可靠，改为浮层展示 id，长按手动复制 |

## 真实使用体验

下面写的都是实际跑出来的结果，不是设计设想。

**顺的地方**

- `dsh-wallpaper` 没有为它做任何专门适配，它自己就正常了：手机端可以直接导入竖屏壁纸，
  和电脑端互不影响，壁纸也没有被拉伸变形。
- `dsh-soul` 和 `dsh-context` 自带的选项卡、设置选项界面在手机布局下适配得不错，
  不需要额外改动就是可用的。
- 在侧栏内长按某段对话，可以弹出该会话的菜单（置顶 / 重命名 / 分叉 / 归档 / 复制 Session ID）。
  这个功能在手机上不太显眼，所以单独说明。

**容易踩的地方**

- 同一时间只能跑一个 Host：桌面端开着，手机就连不上，反之亦然（storages 与会话写锁）。
- 电脑睡眠或关机 = 手机端直接不可用。这是「远程访问自己电脑」的物理限制，不是 bug。
- 换设备名或换 tailnet 域名后，之前 30 天的 cookie 失效，需要重新走 token 登录。
- DSH 升级后如果手机端布局变怪，多半是 CSS 类名变了；删掉对应规则即可回退，不会报错。

## 兼容性

| 项目 | 版本 / 型号 |
|---|---|
| DSH | 0.2.1-rc.2 |
| Tailscale | 1.104.2 |
| 手机 | Xiaomi 13 |
| 手机浏览器 | 系统自带浏览器 |
| 关联插件 | dsh-wallpaper、dsh-soul、dsh-context |

> 以上只是我这一套环境的实测记录，不代表「只能这样」。DSH 版本差异较大时，
> 移动端规则可能和实际界面不符 —— 这类问题开 issue 时带上版本号，比盲猜快得多。

## 安全提醒

- 默认只通过 Tailscale Serve 发布（tailnet-only），**不要开启 Funnel**
- 启动 URL 携带 token，只应发给自己
- 建议给 Tailscale 账号开启 2FA，并在后台开启设备审批
- 远程使用时尽量不要用管理员权限跑 Host

## 卸载

1. 关闭 Host 窗口
2. 撤销发布：`tailscale serve --https=443 off`
3. 删除 `~/.dsh/profiles/<ProfileName>` 与 `start-remote.cmd`

## 目录结构

```
.
├─ install.ps1                    安装脚本
├─ README.md
├─ LICENSE                        MIT 许可证
├─ THIRD-PARTY-NOTICES.md         上游来源与许可声明
├─ .gitignore
└─ plugin/
   └─ dsh-agent-mobile-adapt/     移动端适配插件（修改版，见该目录 README）
```

## 致谢

- **[cyanwell](https://github.com/cyanwell) / yanqing** —— `dsh-agent-soul` 的作者。
  移动端形态最难的第一步是他做的：把桌面 GUI 收成手机排布，并且坚持「不改 DOM、
  只加媒体查询覆盖」这条路子。本仓库的插件是在他的实现上继续补细节，
  没有原版就没有这个项目。
- **DeepSeek Harness 及其插件社区** —— profile / 插件 / Client 半注入这套机制是这个方案成立的前提。

这是我第一次在开源社区发项目。标注若有疏漏或冒犯之处，欢迎开 issue 指出，我会尽快改正。

## License

本项目以 **MIT** 许可证发布，全文见 [LICENSE](LICENSE)。

其中移动端适配插件基于 [cyanwell/dsh-agent-soul](https://github.com/cyanwell/dsh-agent-soul)
的 `plugins/mobile-adapt` 修改而来，该部分版权归上游作者所有
（MIT，Copyright (c) 2026 dsh-agent-soul contributors），已在该插件目录保留许可证全文。
完整声明见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。