# 第三方组件与许可证（Third-Party Notices）

本仓库包含以修改形式分发的第三方代码。以下是来源、作者与许可声明。

---

## 1. dsh-agent-mobile-adapt（移动端界面适配插件）

| 项目 | 内容 |
|---|---|
| 上游仓库 | https://github.com/cyanwell/dsh-agent-soul |
| 上游路径 | `plugins/mobile-adapt` |
| 上游作者 | yanqing（GitHub: [@cyanwell](https://github.com/cyanwell)），署名 "dsh-agent-soul contributors" |
| 许可证 | MIT，Copyright (c) 2026 dsh-agent-soul contributors |
| 本仓库位置 | `plugin/dsh-agent-mobile-adapt/` |
| 修改性质 | 在原作者实现基础上做了大量增补（CSS 规则与侧栏交互逻辑） |

上游 `client.js` 约 340 行；本仓库的版本约 566 行，改动集中在移动端排布、
侧栏交互与浮层层级。具体改动清单见根目录 `README.md` 的「移动端适配插件」一节。

上游 MIT 许可证全文已附于 `plugin/dsh-agent-mobile-adapt/LICENSE`（逐字保留，未改动）。

> MIT 许可证要求：上述版权声明与许可声明必须包含在本软件的所有副本或实质性部分中。
> 本文件与 `plugin/dsh-agent-mobile-adapt/LICENSE` 共同满足该要求。

---

## 2. DeepSeek Harness（运行环境，非本仓库分发）

本项目是 DeepSeek Harness 的使用方案与插件，不包含其源码。安装脚本会调用
使用者本机已安装的 `dsh`。其许可条款以该项目自身声明为准。

---

如果你是本文件的作者之一，或认为某处归属标注有误，请开 issue 或联系仓库维护者，
我们会尽快更正。