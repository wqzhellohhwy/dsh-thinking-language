import type { Context } from '@deepseek-ai/cordis'

/** 插件名。 */
export declare const name = 'dsh-thinking-language'

/** 服务闸门：只有挂了 system 提示词注册表才激活。 */
export declare const inject: ['systemPrompt']

/** 插件的可选配置。缺省即「简体中文 + order -900」。 */
export interface Config {
  /** 设为 `false` 时完全不注册（默认 `true`）。 */
  enabled?: boolean
  /**
   * 目标语言。可给语言标识（`zh-CN` / `en` / `ja` …）或自由文本
   * （如 `Português (Brasil)`）。默认 `zh-CN`。
   */
  language?: string
  /** 自定义整段约束文本；给了就完全覆盖内置模板。 */
  text?: string
  /** system 提示词里的段名。默认 `lang:thinking-language`。 */
  section?: string
  /** 段的顺序值。默认 `-900`（紧跟 order -1000 的 harness 身份）。 */
  order?: number
}

/** 注册语言约束段。 */
export declare function apply(ctx: Context, config?: Config): void
