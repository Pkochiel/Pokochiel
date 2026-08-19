import next from 'eslint-config-next'

/**
 * 追加ルール。flat config ではプラグインを宣言した config オブジェクト内でしか
 * そのプラグインのルールを指定できないため、eslint-config-next が
 * '@typescript-eslint' を宣言しているエントリにマージする。
 */
const EXTRA_TS_RULES = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/consistent-type-imports': 'error',
}

const withExtraRules = next.map((entry) =>
  entry.plugins && '@typescript-eslint' in entry.plugins
    ? { ...entry, rules: { ...entry.rules, ...EXTRA_TS_RULES } }
    : entry,
)

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  ...withExtraRules,
]

export default config
