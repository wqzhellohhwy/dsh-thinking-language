# dsh-thinking-language

> 让 DeepSeek Harness 的模型**用你指定的语言思考**——不只是回答，而是连内部推理一起。
> 默认简体中文，可配置为任意语言。

一个极小的 DSH 插件：它做的唯一一件事，是往 **system 提示词**里注册**一段**语言约束。

---

## 为什么需要它

「让模型用中文思考」这件事，**写进 `AGENTS.md` 不管用**。

`AGENTS.md` 由 `@deepseek-ai/dsh-agent-instructions` 收集，落地成一条 **user 角色的
`<system-reminder>` 快照**——它的性质是"建议"，不是"不变量"。实测结论：

> 即便 `AGENTS.md` 里白纸黑字写着「**任何思考和输出必须使用中文**」，
> 模型依然整轮整轮地用英文推理。

原因在架构上：「用哪种语言推理」是模型的**底层行为**，而 DSH 里唯一能跨轮次持续
约束底层行为的位置是 **system 角色**——那是模型最先读到、且每一轮都在场的那一层。

所以本项目把它放进 system 提示词，而不是放进 `AGENTS.md`、也不指望每轮口述。

> 顺带一句：`AGENTS.md` 里值得保留的是**你个人的工作准则**（语气、红线、流程）。
> 语言这种"不变量"交给 system 层，两者并不冲突。

---

## 它做什么 / 不做什么

**做**

- 往 system 提示词注册**一个** section，content 是一段语言约束。
- 默认挂在 order `-900`：紧跟固定的 harness 身份（`-1000`）之后、部署 persona
  前缀（`0`）之前——读起来是一条**全局前提**，而不是又一条任务指导。
- 默认语言 `zh-CN`（简体中文）。

**不做**

- 不读取、不替换、不改写任何已存在的 section。
- 不碰工具面、不碰运行时上下文、不注册任何工具。
- 不翻译代码：标识符、路径、命令名、配置键、工具原始输出**一律保持原样**
  （这段保证写在约束文本里）。

---

## 安装

DSH 的插件装进某个 **profile**。先把本仓库取到本地，再选一种方式装进去。

### 方式 A：本地目录 link（推荐，改完即生效）

```powershell
git clone https://github.com/wqzhellohhwy/dsh-thinking-language.git D:\dsh-plugins\dsh-thinking-language
dsh plugin --profile web add "link:D:/dsh-plugins/dsh-thinking-language"
```

### 方式 B：直接从 GitHub 装

```powershell
dsh plugin --profile web add "github:wqzhellohhwy/dsh-thinking-language"
```

### 方式 C：用 dsh-super-injector 运行时注入（免重启）

装了 `dsh-super-injector` 的环境里，一条命令热装配：

```
dev_install_package  <本仓库绝对路径>  profile=<你的 profile>
```

### 装完之后

`dsh plugin add` 会把包写进 profile 的 `dependencies` **和** `dsh.profile.bundles`
（本包含 `dsh.bundle.patch` 声明，是合法 bundle）。**重启该实例**即可生效。

---

## 配置

配置写在**你 profile 的** `cordis.patch.yml`（`<DSH_HOME>/profiles/<profile>/cordis.patch.yml`），
**不要改仓库里的文件**。同 id 条目按「完整替换语义」覆盖 bundle 层。

```yaml
- id: thinking-language
  name: dsh-thinking-language
  config:
    language: ja
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `enabled` | boolean | `true` | 设 `false` 就完全不注册（依赖仍在） |
| `language` | string | `'zh-CN'` | 目标语言。可给语言标识（`zh-CN`/`zh-TW`/`en`/`ja` …），也可给自由文本（如 `Português (Brasil)`） |
| `text` | string | — | 自定义整段约束文本；给了就完全覆盖内置模板 |
| `section` | string | `'lang:thinking-language'` | system 提示词里的段名 |
| `order` | number | `-900` | 段的顺序值 |

内置措辞覆盖：`zh` `zh-CN/Hans/SG` `zh-TW/Hant/HK` `en` `ja` `ko` `ru` `fr` `de` `es` `pt` `it` `ar` `hi`；
未命中的标识**原样使用**，所以任何语言都能用，不需要改代码。

四个开箱可用的覆盖示例见
[`examples/profile-override.cordis.patch.yml`](examples/profile-override.cordis.patch.yml)。

---

## 验证它真的生效了

看**模型的 system 提示词**里有没有那段。两种查法：

**1）看段列表**（注入器环境下一行搞定）

```js
// dev_stage_add 一个只读探针，再 dev_stage_call
async function (args, ctx) {
  const sp = ctx.get('systemPrompt')
  const a = await sp.assemble()
  return (a.sections || []).map(s => s.name).join(' | ')
}
```

生效时应当能看到 `lang:thinking-language` 排在 `harness:identity` 之后：

```
harness:identity | lang:thinking-language | deployment:persona-prefix | ... | deployment:persona-suffix
```

**2）看会话日志**：DSH 把组装好的 system 提示词原样写进会话日志，导出即可逐字核对
（日志是**每行一个 zstd 帧**的多帧格式，需要按帧魔数 `28 B5 2F FD` 切帧逐帧解，
普通的 zstd 解压只会解出第一帧）。

---

## 原理

DSH 的 system 提示词不是一份静态文件，而是**运行时按 order 拼装**的：各插件往
`ctx.systemPrompt` 注册自己的段，按顺序值升序拼接后，作为 **system 角色消息**写进
会话历史。

本插件因此只需要一件事：

```js
ctx.effect(
  () => ctx.systemPrompt.section({ name: SECTION, order: ORDER, text: TEXT }),
  'thinking-language.section()',
)
```

`@deepseek-ai/dsh-system-prompt` 的 README 里有两句关键约定，本项目就是按它们设计的：

- 「外部贡献可以使用任意有限的顺序值」——所以 `-900` 是合法的；
- 「部署方编写的提示词文本只来自配置／组合；**不存在终端用户提示词编辑 API**」
  ——所以想改提示词，只能靠配置或插件，本项目选了"插件 + 可配置"这条路。

---

## 兼容性

| 项 | 要求 |
|---|---|
| Node | `>= 22.19`（DSH 自身的要求） |
| `@deepseek-ai/dsh-system-prompt` | `>= 0.1.0-rc.6 < 2`（peer，声明为 optional） |
| `@deepseek-ai/cordis` | `>= 4.0.0-rc < 5`（peer，声明为 optional） |
| DSH 版本 | 已在 **0.2.0-rc.2** 上实测生效；peer 范围刻意放宽，便于跨版本使用 |

---

## 常见问题

**Q：为什么我在 `AGENTS.md` 里写了没用？**
见上文「为什么需要它」——那不是提示词写得不够狠，而是**位置不对**。

**Q：装到哪个 profile？**
你实际在用的那个。桌面版（Electron）用的是 `desktop` profile，而
`dsh plugin --profile desktop` 会被 CLI 显式拒绝（该 profile 由 Electron 应用专属管理），
需要走桌面版自己的插件界面。

**Q：会拖慢请求吗？**
每轮多一小段文本，属于固定成本。它与 harness 身份、persona 一起处在提示词**最前面**，
前缀稳定，不破坏 KV 缓存的复用位置。

**Q：能只要"回答用中文"、不约束内部推理吗？**
可以。`text` 完全自定义，写你要的那句即可。

**Q：同一个 profile 装两次会怎样？**
**不要这么干。** `systemPrompt` 把段名当**唯一键**，同名重复注册会被直接拒绝并抛错：

```
prompt section "lang:thinking-language" is already registered
```

既不会静默覆盖，也不会叠加成两段。想换语言请**覆盖同 id 的 `config`**（见上文
[配置](#配置)），而不是再装一份。

**Q：改了配置 / 卸载了插件，为什么提示词里还留着旧的那段？**
`systemPrompt` 服务只有 `section()`，**没有移除 API**；一段文本的生命周期由注册它的
fiber 决定。所以配置变更或卸载之后，**重启该实例**才会彻底干净。重启后一切都按
当前的 `bundles` + `cordis.patch.yml` 重新装配，不会留下残留。

---

## 许可证

[MIT](LICENSE) © 2026 wqzhellohhwy
