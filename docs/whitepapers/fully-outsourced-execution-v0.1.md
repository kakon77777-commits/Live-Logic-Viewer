# Live Logic Viewer 與完全外包執行架構
## 安全動態邏輯渲染、受管 Sandbox 與零本地執行協議技術白皮書

**英文題名：** *Live Logic Viewer with Fully Outsourced Execution: A Secure Protocol for Dynamic Logic Rendering over Managed Sandboxes*  
**版本：** v0.1  
**日期：** 2026-08-17  
**作者：** Neo.K（概念提出）／Aletheia（架構整理與技術形式化）  
**機構：** EveMissLab / 一言諾科技有限公司  
**狀態：** Architecture Whitepaper / Pre-Implementation Specification

---

## 摘要

本白皮書提出一種將「動態邏輯論文／持續運行判斷」與高權限本地執行環境完全分離的系統架構。

既有 EveGlyph 原型已證明以下互動可行：

$$
\Omega
\rightarrow
\top_p
\rightarrow
\Omega
\rightarrow
\bot_p,
$$

並能讓 Evidence、Judgment、公式與 Replay timeline 隨真實狀態轉移同步更新。然而，EveGlyph 同時具有本地檔案、workspace、MCP、agent、可執行計算與其他高權限能力，不適合作為公開瀏覽器動態判斷器的最終安全邊界。

因此，本白皮書提出新的獨立架構：

$$
\boxed{
\text{Viewer}
\neq
\text{Execution Environment}.
}
$$

更進一步：

$$
\boxed{
\text{Execution Infrastructure}
\notin
\text{Our Trusted Local Surface}.
}
$$

所有不可信或使用者提供的程式碼，完全交由第三方 Managed Sandbox Provider 執行。我們僅保有：

1. Viewer；
2. Control Plane；
3. Execution Protocol；
4. Schema Validation；
5. Event Canonicalization；
6. Provenance / Signature；
7. Dynamic Logic Projection。

瀏覽器不取得 shell、本地檔案、Node.js、MCP、Agent write tool 或 Sandbox credential。Managed Sandbox 也不直接向 Viewer 回傳可執行 DOM、HTML 或 JavaScript。兩者之間唯一合法的介面是：

$$
\boxed{
\text{Validated Structured Data}.
}
$$

本白皮書的核心安全不變量為：

> **The Viewer renders claims about computation; input data never gains the authority to become browser-side computation.**

中文：

> **Viewer 可以呈現計算結果，但任何輸入資料都不能因為被載入而取得瀏覽器執行能力。**

---

# 1. 問題背景

## 1.1 動態邏輯需要真正運行

靜態論文通常是：

$$
\text{Source}
\rightarrow
\text{Render}
\rightarrow
\text{Read}.
$$

生成判斷論則需要：

$$
\text{Evidence}
\rightarrow
J(P,t)
\rightarrow
\text{Transition}
\rightarrow
\text{Render}.
$$

當新 evidence 到達：

$$
E_{t+1},
$$

判斷可能從：

$$
J(P,t)=\top_p
$$

變成：

$$
J(P,t+1)=\Omega.
$$

因此真正的 Live Paper 不能只有動畫；它必須讓畫面對真實狀態轉移產生反應。

## 1.2 本地執行與公開 Viewer 不應共域

若同一產品同時擁有本地檔案、shell、Node.js、workspace、MCP、agent credentials、AI tools、可執行程式碼與公開輸入，attack surface 會不必要地膨脹。

因此：

$$
\boxed{
\text{Public Rendering Surface}
\cap
\text{Privileged Local Execution Surface}
=
\varnothing
}
$$

應被視為第一級設計目標。

---

# 2. 系統目標

本專案的目標不是建立另一個 IDE，而是建立：

$$
\boxed{
\text{一個低權限、可公開部署、
只呈現經驗證動態判斷結果的 Viewer。}
}
$$

具體要求：

- 瀏覽器可以播放、暫停、回放判斷歷史；
- Evidence、Judgment、公式、時間軸可隨事件更新；
- 可顯示遠端程式執行結果；
- 使用者程式碼永遠不在 Viewer 執行；
- Viewer 不持有 Sandbox API secret；
- 執行 infrastructure 完全由 Managed Sandbox Provider 提供；
- 所有 provider output 必須先 schema validate；
- Viewer 只接收 canonical event/result；
- provider 可替換；
- 動態邏輯與執行供應商解耦。

---

# 3. 非目標

v0.1 明確不做：

- 本地 shell；
- 本地 filesystem bridge；
- Node.js server；
- arbitrary browser-side JavaScript execution；
- browser-side Python；
- WebAssembly execution；
- MCP；
- Agent write tool；
- browser extension execution；
- remote desktop；
- arbitrary HTML rendering；
- arbitrary user CSS；
- arbitrary Markdown raw HTML；
- unrestricted network proxy；
- persistent multi-user development container；
- browser 直接呼叫 Sandbox provider API。

---

# 4. 威脅模型

本系統假設以下輸入均可能是惡意的：

$$
\boxed{
\text{User}
+
\text{Code}
+
\text{AI Output}
+
\text{External Evidence}
+
\text{Sandbox Stdout}
}
$$

主要威脅包括 Browser XSS、credential theft、sandbox escape、SSRF/egress abuse、resource abuse、output bomb、protocol confusion 與 replay forgery。

---

# 5. 信任域

整體架構分成四個 domain：

```text
┌──────────────────────────────┐
│  A. Browser Viewer           │
│  Lowest privilege            │
└──────────────┬───────────────┘
               │ validated event/result
               ▼
┌──────────────────────────────┐
│  B. Thin Control Plane       │
│  Serverless orchestration    │
└──────────────┬───────────────┘
               │ provider API
               ▼
┌──────────────────────────────┐
│  C. Managed Sandbox Provider │
│  Untrusted code executes     │
└──────────────┬───────────────┘
               │ raw result
               ▼
┌──────────────────────────────┐
│  D. Canonicalizer/Validator  │
│  Convert to safe protocol    │
└──────────────────────────────┘
```

B 與 D 在部署上可以位於同一 serverless Worker，但在邏輯上必須保持不同責任。

---

# 6. 核心架構

推薦 MVP：

```text
Browser
   │
   │ HTTPS JSON
   ▼
Control Worker
   │
   │ provider credential
   ▼
Managed Sandbox
   │
   │ raw stdout/result
   ▼
Control Worker
   │
   │ schema validate
   │ canonicalize
   │ sign
   ▼
Browser Viewer
```

形式化：

$$
\boxed{
U
\rightarrow
C
\rightarrow
S
\rightarrow
V
\rightarrow
E_c
\rightarrow
R
}
$$

其中 $U$ 是 user request，$C$ 是 control plane，$S$ 是 sandbox，$V$ 是 validator，$E_c$ 是 canonical event，$R$ 是 renderer。

---

# 7. 為什麼執行端完全外包

Managed Sandbox Provider 專門處理 VM/container lifecycle、filesystem isolation、process isolation、resource quota、command execution、runtime image、teardown、observability 與 infrastructure patching。

目前官方文件顯示，Cloudflare Sandbox SDK 可由 Workers 控制隔離執行環境，並說明每個 sandbox 使用獨立 VM 隔離 filesystem、process 與 network；Deno Sandbox 提供 Linux microVM；Modal Sandboxes 面向 arbitrary/untrusted code execution 並提供 network blocking；E2B 提供 isolated cloud sandbox 與 code/command execution。

因此本專案不自建 Docker daemon、Kubernetes、Firecracker cluster、container scheduler 或 sandbox host pool。

---

# 8. Provider-neutral Execution Adapter

Control Plane 不直接耦合單一供應商。

```ts
interface ExecutionProvider {
  create(job): SandboxHandle
  upload(handle, files): void
  execute(handle, runner): RawExecutionResult
  terminate(handle): void
}
```

v0.1：

```text
CloudflareSandboxProvider
```

未來：

```text
DenoSandboxProvider
ModalSandboxProvider
E2BSandboxProvider
```

核心要求：

$$
\boxed{
\text{Provider}
\neq
\text{Protocol}.
}
$$

---

# 9. Provider 選型

## 9.1 Cloudflare Sandbox

優勢：

- Worker 與 Sandbox 整合直接；
- 隔離 VM；
- command timeout；
- filesystem/process/network isolation；
- 可自訂 outbound handler / egress policy；
- 不需自建 execution infrastructure。

MVP 推薦：

$$
\boxed{
\text{Cloudflare Worker}
\rightarrow
\text{Cloudflare Sandbox}
}
$$

作為 reference backend。

## 9.2 Deno Sandbox

優勢包括 Linux microVM、ephemeral lifecycle、host allowlist、secret substitution 與 dashboard audit。

但 Deno 官方目前文件對 default outbound policy 存在互相衝突的文字：Create 頁描述 default no outbound network access，而 Security 頁描述 default unrestricted outbound network access。

因此本白皮書建立更強規則：

$$
\boxed{
\text{Provider Default}
=
\text{Untrusted Configuration}.
}
$$

任何 production job 都必須顯式設定 network policy。

## 9.3 Modal Sandbox

Modal 提供面向 untrusted code 的 Sandbox，並支援 `block_network=true` 完全阻擋 outbound traffic，也支援 allowlist。它適合 Python-heavy、AI-generated code 與較重 scientific compute。

## 9.4 E2B

E2B 提供 on-demand isolated Linux VM，支援 command 與 code execution。它可作為未來 adapter，但 v0.1 不設為 default reference backend，直到完成 provider-specific egress、secret、resource-limit 與 audit review。

---

# 10. 一次工作、一個 Sandbox

MVP 採：

$$
\boxed{
1\ Job
\rightarrow
1\ Ephemeral\ Sandbox.
}
$$

不重用使用者 sandbox，降低 cross-job filesystem leakage、hidden process、state contamination 與 provenance 混淆。

---

# 11. Execution Request Protocol

Viewer 不送任意 shell command，只送受限結構：

```json
{
  "schema_version": "0.1",
  "job_id": "job_01",
  "runner": "python",
  "source": "print(1 + 1)",
  "network_policy": {
    "mode": "deny"
  },
  "limits": {
    "wall_ms": 5000,
    "output_bytes": 65536
  }
}
```

Control Plane 只允許固定 runner。v0.1 建議先只支援 Python。

---

# 12. 固定 Runner

Sandbox 內由 adapter 決定：

```text
python /workspace/main.py
```

而不是直接執行使用者指定 command line。

$$
\boxed{
\text{User controls source}
\neq
\text{User controls host command line}.
}
$$

---

# 13. Network Policy 必須顯式

每個 job 必須帶 network policy。

若缺失：

$$
\boxed{
\text{Reject Job}.
}
$$

不可繼承 provider default。

MVP 預設明確要求：

$$
\boxed{
\text{Outbound Network}
=
\text{DENY}.
}
$$

未來若需外部 API，只允許顯式 host allowlist。

---

# 14. Secret Policy

MVP：

$$
\boxed{
\text{No user job receives application secrets.}
}
$$

未來若必須使用第三方 API，secret 不出現在 Viewer、不出現在 user source，優先採 provider-side secret substitution，並綁定指定 host。

---

# 15. Execution Result Envelope

Sandbox raw result 不直接送瀏覽器，而先 canonicalize：

```json
{
  "schema_version": "0.1",
  "job_id": "job_01",
  "status": "completed",
  "execution": {
    "runtime": "python",
    "exit_code": 0,
    "wall_ms": 137
  },
  "result": {
    "type": "scalar",
    "value": 2
  },
  "provenance": {
    "request_hash": "...",
    "source_hash": "...",
    "runner_hash": "..."
  }
}
```

---

# 16. Sandbox Output 不是 Evidence

$$
\boxed{
\text{Execution Result}
\neq
\text{Evidence}.
}
$$

程式算出 0.72，只表示某模型或公式在某輸入下輸出 0.72，不表示世界真實支持度為 72%。

---

# 17. Canonical Event Protocol

Viewer 真正消費的是 event：

```json
{
  "event_id": "evt_01",
  "type": "metric_update",
  "claim_id": "claim_1",
  "payload": {
    "field": "support",
    "from": 0.68,
    "to": 0.72
  }
}
```

v0.1 合法 event types：

```text
claim_created
evidence_added
evidence_invalidated
judgment_transition
metric_update
formula_projection
timeline_marker
execution_completed
execution_failed
```

---

# 18. Forbidden Event Fields

Canonical event 禁止攜帶：

```text
html
script
javascript
css
onclick
srcdoc
iframe
eval
module
worker
wasm
shell
command
```

若出現則 reject envelope。

---

# 19. Formula Projection

Viewer 第一版只接受：

```json
{
  "formula": {
    "tex": "S_t = 0.72",
    "value": 0.72
  }
}
```

`tex` 是 presentation data，不是 executable code。

$$
\boxed{
\text{TeX}
\neq
\text{Formula Runtime}.
}
$$

---

# 20. Viewer Architecture

```text
live-logic-viewer/
├─ src/
│  ├─ protocol/
│  ├─ validation/
│  ├─ store/
│  ├─ projection/
│  ├─ playback/
│  ├─ renderer/
│  └─ security/
├─ schemas/
├─ examples/
├─ tests/
└─ docs/
```

不存在：

```text
agent/
mcp/
filesystem/
shell/
executor/
workspace/
local-bridge/
```

---

# 21. Replay

Replay 只改 cursor，不重跑程式。

$$
\boxed{
\text{Replay}
\neq
\text{Re-execution}.
}
$$

若要重新計算：

$$
\text{New Job}
\rightarrow
\text{New Sandbox}.
$$

---

# 22. Browser CSP

建議最低 CSP：

```text
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
object-src 'none';
frame-src 'none';
worker-src 'none';
base-uri 'none';
form-action 'none';
frame-ancestors 'none';
```

若 MVP 完全離線載入 JSON，`connect-src 'none'` 更佳。

---

# 23. Browser Hardening

MVP：

- no inline script；
- no `unsafe-eval`；
- no `eval()`；
- no `new Function()`；
- no dynamic import URL；
- no Service Worker；
- no raw `innerHTML` from event data；
- prefer `textContent`；
- schema validate before store；
- size limit before parse；
- reject deeply nested JSON；
- no auto-fetch from event URLs。

---

# 24. Control Plane

Control Plane 可使用 Cloudflare Worker 或 Deno Deploy。

它只做 authentication、rate limit、schema validation、provider orchestration、timeout、canonicalization、signature 與 response。

它不承擔長期 execution host。

---

# 25. Browser 不持有 Provider Credential

禁止：

```text
Browser
→ provider API directly
```

必須：

```text
Browser
→ Control Plane
→ Provider
```

所以：

$$
\boxed{
\text{Provider Secret}
\notin
\text{Browser}.
}
$$

---

# 26. Abuse Control

公開 execution API 至少需要 authentication、rate limit、per-user quota、max code size、max runtime、max output、max concurrent jobs、max daily compute、reject binary payload、reject long-lived daemon 與 explicit abuse policy。

---

# 27. Resource Limits

每個 job 明確設定：

$$
T_{\max},
M_{\max},
O_{\max}.
$$

例如：

```json
{
  "wall_ms": 5000,
  "memory_mb": 512,
  "output_bytes": 65536
}
```

Provider 若不能保證某欄位，adapter 必須回報 unsupported，不得假裝已施加限制。

---

# 28. Provenance

每個 result 保存 request/source/runner hash、provider、runtime version 與 timestamp。

長期建議 Control Plane 對 canonical envelope 使用 asymmetric signature：

$$
\sigma
=
\operatorname{Sign}_{sk}(H(E_c)).
$$

Viewer 只持有 public key 驗證：

$$
\operatorname{Verify}_{pk}(E_c,\sigma)=1.
$$

v0.1 可以先預留欄位、後續再啟用簽章。

---

# 29. Dynamic Logic 層

Viewer 的 Dynamic Logic 不等於執行引擎。

它做：

$$
\text{Canonical Event}
\rightarrow
\text{Judgment Projection}.
$$

例如：

$$
\Omega
\rightarrow
\top_p
\rightarrow
\Omega.
$$

輸入永遠是 validated event。

---

# 30. Event-driven Motion

Browser motion 遵守：

$$
\boxed{
\text{No Event}
\Rightarrow
\text{No Motion}.
}
$$

禁止 fake thinking animation、idle probability drift 與 decorative confidence oscillation。

---

# 31. 三種時間

系統區分 Wall Time $t_w$、Execution Time $t_e$、Replay Time $t_r$。

因此：

$$
t_w\neq t_e\neq t_r.
$$

---

# 32. 一次完整資料流

```text
1. User submits source
2. Browser validates request shape
3. Control Plane authenticates
4. Control Plane validates again
5. Control Plane creates one sandbox
6. Source uploaded
7. Fixed runner executes
8. Timeout/output limits enforced
9. Raw result returned
10. Sandbox terminated
11. Result canonicalized
12. Result schema validated
13. Provenance attached
14. Optional signature added
15. Canonical event delivered
16. Viewer validates
17. Dynamic Logic projection updates
18. Formula/Timeline/Judgment render transition
```

---

# 33. Failure Flow

Sandbox timeout、OOM、nonzero exit、provider error 或 invalid output 均只產生 execution failure。

不得：

$$
\mathrm{ExecutionFailure}
\Rightarrow
\bot.
$$

即：

$$
\boxed{
\mathrm{ERROR}
\neq
\Omega
\neq
\bot.
}
$$

---

# 34. Provider Lock-in

ExecutionRequest、ExecutionResult、CanonicalEvent 均由本專案定義，Provider adapter 只負責翻譯。

因此 Cloudflare → Deno 不要求重寫 Viewer。

---

# 35. Reference Backend 決策

v0.1 實作推薦：

$$
\boxed{
\text{Cloudflare Worker}
+
\text{Cloudflare Sandbox}
}
$$

但核心程式碼必須維持 provider adapter。v0.2 前至少新增第二個 provider adapter，以驗證 protocol portability。

---

# 36. Security Invariants

- **SI-1:** Viewer 不包含 arbitrary code execution。
- **SI-2:** Provider credential 不進 Browser。
- **SI-3:** Sandbox output 必須 validation 後才能進 Viewer。
- **SI-4:** Execution Result 不等於 Evidence。
- **SI-5:** Replay 不等於 Execution。
- **SI-6:** Error、Omega、False 三者不同。
- **SI-7:** Network Policy 缺失即 Reject。
- **SI-8:** Provider Default 不等於 Security Policy。
- **SI-9:** Input Data 不取得 Browser Execution Authority。

---

# 37. 與可不可論的工程對應

可：提交程式、執行、取得結果、動態顯示、重算、更換 provider。

不可：讓 Viewer 執行輸入程式、讓瀏覽器取得 secret、讓 raw output 直接成 DOM、讓 provider default 取代安全政策、讓 execution result 僭位成 evidence、讓 error 冒充 false。

因此：

$$
\boxed{
\text{可執行，
不可讓執行權回到 Viewer。}
}
$$

---

# 38. MVP 範圍

### Viewer

Claim card、Evidence card、Judgment card、Formula projection、Timeline、Play / Pause / Seek、file-based event package、HTTP result package。

### Control Plane

one endpoint、auth、rate limit、explicit network deny、one sandbox/job、Python fixed runner、timeout、output cap、schema validation。

### Sandbox

ephemeral、no persistent volume、no network、no secrets、fixed Python entrypoint、destroy after job。

---

# 39. MVP API

```text
POST /v1/jobs
GET  /v1/jobs/{job_id}
GET  /v1/jobs/{job_id}/events
```

---

# 40. 實作順序

## Phase 0 — Security Skeleton

repo、CSP、schemas、no-execution tests、JSON import、static replay。

## Phase 1 — Viewer

dynamic cards、formula projection、timeline、motion、replay。

## Phase 2 — Control Plane

auth、quota、request validation、Cloudflare adapter。

## Phase 3 — Managed Execution

one sandbox/job、Python fixed runner、timeout、no egress、canonical result。

## Phase 4 — Live Event

Viewer receives job events、automatic state transition、no Play button required for current live stream。

## Phase 5 — Provider Portability

Deno adapter、protocol conformance tests。

---

# 41. 測試要求

Security tests：XSS payload remains text、script rejected、forbidden fields rejected、CSP forbids eval、browser bundle has no provider secret、oversized/deep JSON rejected、network policy missing rejected、sandbox output HTML never rendered raw。

Runtime tests：timeout、nonzero exit、invalid JSON、provider failure、output truncation、termination cleanup。

Logic tests：Omega→Top、Top→Omega、replay deterministic、error does not become false、execution result does not auto-create evidence。

---

# 42. 完成定義

v0.1 成功條件：公開 Viewer 可部署；Viewer 無本地執行能力；Viewer 無 provider credential；使用者程式只在 managed sandbox 執行；Sandbox job 顯式 network deny；執行後 teardown；raw output 不直接進 DOM；schema-invalid result fail closed；dynamic logic state 可以 live 更新；replay 與 live state 可區分；provider 可以被 adapter 替換；EveGlyph 不再是 production execution dependency。

---

# 43. 風險聲明

本架構降低 attack surface，但不構成形式化安全證明。Managed Sandbox 仍是一個外部信任依賴。

因此：

$$
\boxed{
\text{Risk Transfer}
\neq
\text{Risk Elimination}.
}
$$

真正策略是：即使某個 execution provider 出現漏洞，也不要讓它天然取得 Viewer、本地工作站、公司內網與長期 secret 的完整權限。

---

# 44. 最終架構

```text
AI / User / ACO
      │ source/request
      ▼
Thin Control Plane
 validate / quota
      │ provider adapter
      ▼
Managed Sandbox
untrusted execution
      │ raw result
      ▼
Canonicalizer
schema / provenance
      │ safe event
      ▼
Live Logic Viewer
 no execution power
```

---

# 45. 結論

本白皮書最核心的決策可以壓縮成三句：Viewer 不執行不可信程式；不可信程式只進 Managed Sandbox；Sandbox 回來的只能先成為資料，不能直接成為瀏覽器能力。

因此真正的 Live Logic 系統是：

$$
\boxed{
\text{Browser}
\rightarrow
\text{Request}
\rightarrow
\text{Managed Execution}
\rightarrow
\text{Validated Event}
\rightarrow
\text{Dynamic Projection}.
}
$$

這讓「論文會動」與「程式可以執行」同時成立，卻不需要讓公開 Viewer 變成另一個高權限 IDE。

---

# 參考資料（官方文件）

1. Cloudflare Sandbox SDK — https://developers.cloudflare.com/sandbox/
2. Cloudflare Sandbox Security — https://developers.cloudflare.com/sandbox/concepts/security/
3. Cloudflare Sandbox Outbound Traffic — https://developers.cloudflare.com/sandbox/guides/outbound-traffic/
4. Cloudflare Sandbox Commands — https://developers.cloudflare.com/sandbox/api/commands/
5. Deno Sandbox — https://docs.deno.com/sandbox/
6. Deno Sandbox Create — https://docs.deno.com/sandbox/create/
7. Deno Sandbox Security — https://docs.deno.com/sandbox/security/
8. Modal Sandboxes — https://modal.com/docs/guide/sandboxes
9. Modal Networking and Security — https://modal.com/docs/guide/sandbox-networking
10. E2B Documentation — https://e2b.dev/docs
