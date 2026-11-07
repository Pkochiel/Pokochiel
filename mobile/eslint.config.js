// eslint-config-expo の README にある flat config の形。
// これを置かないと、ESLint がリポジトリ直下の Next.js 用の設定まで遡って読み込む。
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'ios/*', 'android/*'],
  },
])
