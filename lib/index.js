/**
 * dsh-thinking-language — 锁定模型「用哪种语言思考」。
 *
 * ## 为什么需要它
 *
 * 把「必须用中文思考」写进 `AGENTS.md` **不够**。`AGENTS.md` 由
 * `dsh-agent-instructions` 收集，落地成一条 **user 角色的 `<system-reminder>`
 * 快照**——它是"建议"，不是"不变量"。实测：即便 `AGENTS.md` 里写明
 * 「任何思考和输出必须使用中文」，模型依旧整轮用英文推理。
 *
 * 「用哪种语言推理」是模型的底层行为，需要落在 **system 角色**里——那是模型
 * 最先读到、且每一轮都在场的那一层。本插件做的唯一一件事，就是往 system
 * 提示词注册 **一个** section。
 *
 * ## 它不动任何既有内容
 *
 * 纯追加：不读取、不替换、不改写任何已存在的 section。默认挂在 order `-900`
 * ——紧跟在固定的 harness 身份（`-1000`）之后、部署 persona 前缀（`0`）之前，
 * 因此它被读作一条全局前提，而不是又一条任务指导。
 *
 * ## 失败是"不生效"，不是"弄坏"
 *
 * 没有 `systemPrompt` 服务时插件根本不会激活（cordis 的 `inject` 闸门）；
 * 段注册本身不抛错。关掉它只需 `enabled: false`。
 *
 * @module dsh-thinking-language
 */

/** 插件名（与 package.json 的 name 一致）。 */
export const name = 'dsh-thinking-language'

/** 只有挂了 system 提示词注册表才可用。 */
export const inject = ['systemPrompt']

/** 默认段名。固定值，便于重挂载时替换而不是叠加。 */
const DEFAULT_SECTION = 'lang:thinking-language'

/** 默认顺序：紧跟 harness 身份（-1000），在所有其他段之前。 */
const DEFAULT_ORDER = -900

/** 默认语言：简体中文。 */
const DEFAULT_LANGUAGE = 'zh-CN'

/**
 * 语言标识 → 给模型看的措辞。
 *
 * 键统一小写比较；命中不了就原样使用调用方给的字符串（因此
 * `language: "Português (Brasil)"` 这类自由文本同样可用）。
 */
const LANGUAGE_LABELS = {
  zh: 'Simplified Chinese (简体中文)',
  'zh-cn': 'Simplified Chinese (简体中文)',
  'zh-hans': 'Simplified Chinese (简体中文)',
  'zh-sg': 'Simplified Chinese (简体中文)',
  'zh-tw': 'Traditional Chinese (繁體中文)',
  'zh-hant': 'Traditional Chinese (繁體中文)',
  'zh-hk': 'Traditional Chinese (繁體中文)',
  en: 'English',
  'en-us': 'English',
  'en-gb': 'English',
  ja: 'Japanese (日本語)',
  ko: 'Korean (한국어)',
  ru: 'Russian (Русский)',
  fr: 'French (Français)',
  de: 'German (Deutsch)',
  es: 'Spanish (Español)',
  pt: 'Portuguese (Português)',
  it: 'Italian (Italiano)',
  ar: 'Arabic (العربية)',
  hi: 'Hindi (हिन्दी)',
}

/**
 * 由语言标识生成约束文本。
 *
 * 目标是英文时刻意换一种措辞——"不要用英文"对英文目标没有意义。
 *
 * @param language - 语言标识或自由文本（如 `zh-CN`、`日本語`）。
 * @returns 一段可直接放进 system 提示词的英文约束。
 */
function buildText(language) {
  const raw = String(language ?? '').trim() || DEFAULT_LANGUAGE
  const label = LANGUAGE_LABELS[raw.toLowerCase()] ?? raw

  const head = /^en\b/i.test(raw)
    ? `Write your reasoning and your answers in ${label}.`
    : `Reason and answer in ${label}. Your internal reasoning, plans, intermediate notes and user-facing prose must be written in ${label}, not English.`

  return `${head} Keep code, identifiers, file paths, command names, config keys, and verbatim command or tool output in their original form.`
}

/**
 * 注册语言约束段，生命周期跟随本插件。
 *
 * @param ctx - 带 `systemPrompt` 服务的 cordis 上下文。
 * @param config - 见 README「配置」；缺省即「简体中文 + order -900」。
 */
export function apply(ctx, config = {}) {
  const cfg = config && typeof config === 'object' ? config : {}

  if (cfg.enabled === false) return

  const systemPrompt = ctx.systemPrompt ?? ctx.get?.('systemPrompt')
  if (systemPrompt === undefined || typeof systemPrompt.section !== 'function') return

  const section =
    typeof cfg.section === 'string' && cfg.section.trim() !== ''
      ? cfg.section.trim()
      : DEFAULT_SECTION

  const order = Number.isFinite(cfg.order) ? cfg.order : DEFAULT_ORDER

  const text =
    typeof cfg.text === 'string' && cfg.text.trim() !== ''
      ? cfg.text
      : buildText(cfg.language ?? DEFAULT_LANGUAGE)

  ctx.effect(
    () =>
      systemPrompt.section({
        name: section,
        order,
        text,
      }),
    'thinking-language.section()',
  )
}
