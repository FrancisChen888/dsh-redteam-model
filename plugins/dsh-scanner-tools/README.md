# dsh-scanner-tools（v0.1.0 已实现）

pentest 三级兜底第一级的运行时化：本机 nuclei/httpx/ffuf 封装为模型工具，纪律内置。
挂载：**宿主平面**（随集合 bundle 全模式常驻；本插件的 `cordis.patch.yml` 供单独安装时使用，
集合的 `cordis.patch.yml` 另有 `bundled-dsh-scanner-tools` include 行读 `./bundled.cordis.yml`，
该包已列入 `dsh.profile.bundles` 时 include 行自动停用——两条路径互斥，永远只挂一次）。

## 工具

| 工具 | 默认速率 | 防盲打 | 产物 |
|---|---|---|---|
| `nuclei_scan(target, workspace, severity?, rate?)` | -rl 15 | 主动：须已登记 assets.md | 命中→scan-reconcile.md 待处置行（命中≠漏洞） |
| `httpx_probe(targets, workspace, rate?)` | -rl 25 | 轻探测：允许未登记，提示回填 | 存活/指纹 JSON |
| `ffuf_fuzz(url, workspace, mode, wordlist?, rate?)` | -rate 50 | 主动：须已登记 | -o JSON 直接入产物 |

共同行为：
- 产物写 `<workspace>/artifacts/scans/<tool>-<ts>.json`，并回 `evidence-index.md` 一行
  （**速率注记**：默认值标注「保守默认」；显式 rate 覆盖会留「默认 X → Y，留痕」）。
- **绝不自动安装**：缺二进制→三级兜底提示（本机→MCP→安装请求）；nuclei 模板库缺失→
  前置拦截并提示需用户批准一次性下载（`-update-templates`，数据非工具）。
- ffuf 字典必须显式给（wordlist 参数），不代装字典。

## 测试

- `node test/run.mjs`：登记检查/无 assets 提示/缺二进制兜底提示/默认速率（5 项，全过）。
- 实机冒烟（DVWA 127.0.0.1:8081）：httpx 真跑通+证据落盘 ✓；ffuf 小字典真跑通+证据 ✓；
  防盲打拒绝 ✓；nuclei 模板缺失前置拦截 ✓（模板下载待用户批准，见 PROGRESS）。
