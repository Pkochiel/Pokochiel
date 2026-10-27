import { allowsPullToRefresh, decideNavigation, isAppPage } from './navigation-policy'

const APP = 'https://your-pwa-url.com'

describe('decideNavigation', () => {
  it.each([
    'https://your-pwa-url.com',
    'https://your-pwa-url.com/',
    'https://your-pwa-url.com/dashboard/',
    'https://your-pwa-url.com/btr/saccade/?from=session#top',
  ])('同じオリジンのページはアプリの中で開く: %s', (url) => {
    expect(decideNavigation(url, APP)).toBe('load')
  })

  it.each([
    ['別のサイト', 'https://example.com/'],
    // originWhitelist の前方一致ならここを通してしまう。
    ['名前の後ろに続けたドメイン', 'https://your-pwa-url.com.evil.test/'],
    ['サブドメイン', 'https://www.your-pwa-url.com/'],
    ['ポート違い', 'https://your-pwa-url.com:8443/'],
    ['http と https の違い', 'http://your-pwa-url.com/'],
  ])('オリジンが違えば外へ回す（%s）', (_label, url) => {
    expect(decideNavigation(url, APP)).toBe('open-externally')
  })

  it('blob: は同じ origin でも開かない', () => {
    // blob: の origin は作ったページの origin になる。origin だけを見ると 'load' になり、
    // バックアップの JSON が画面全体を置き換えてしまう。
    const blob = 'blob:https://your-pwa-url.com/0b6c1f0e-3c2a-4d0e-9f3e-8f1d2a7b9c11'
    expect(new URL(blob).origin).toBe(APP)
    expect(decideNavigation(blob, APP)).toBe('block')
  })

  it.each(['data:application/json,{}', 'javascript:void(0)', 'file:///etc/hosts'])(
    '画面を置き換えたり端末を覗いたりする URL は開かない: %s',
    (url) => {
      expect(decideNavigation(url, APP)).toBe('block')
    },
  )

  it('about:blank は通す（WebView が初期化で使う）', () => {
    expect(decideNavigation('about:blank', APP)).toBe('load')
  })

  it.each(['mailto:someone@example.com', 'tel:0120000000', 'sms:0120000000'])(
    'ほかのアプリが扱う URL はそちらに任せる: %s',
    (url) => {
      expect(decideNavigation(url, APP)).toBe('open-externally')
    },
  )

  it('URL として読めなければ開かない', () => {
    expect(decideNavigation('not a url', APP)).toBe('block')
    expect(decideNavigation('', APP)).toBe('block')
  })
})

describe('isAppPage', () => {
  it('同じオリジンの http(s) だけをアプリのページとみなす', () => {
    expect(isAppPage('https://your-pwa-url.com/progress/', APP)).toBe(true)
    expect(isAppPage('https://example.com/', APP)).toBe(false)
    expect(isAppPage('about:blank', APP)).toBe(false)
    expect(isAppPage('blob:https://your-pwa-url.com/x', APP)).toBe(false)
    expect(isAppPage('not a url', APP)).toBe(false)
  })
})

describe('allowsPullToRefresh', () => {
  it.each([
    'https://your-pwa-url.com/',
    'https://your-pwa-url.com/dashboard/',
    'https://your-pwa-url.com/progress/',
    'https://your-pwa-url.com/settings/',
    // 種目の一覧と、計測の説明だけの画面は消えて困るものがない。
    'https://your-pwa-url.com/btr/',
    'https://your-pwa-url.com/btr',
    'https://your-pwa-url.com/baseline/',
  ])('途中の状態を持たない画面では更新できる: %s', (url) => {
    expect(allowsPullToRefresh(url)).toBe(true)
  })

  it.each([
    'https://your-pwa-url.com/btr/saccade/',
    'https://your-pwa-url.com/btr/image-memory',
    'https://your-pwa-url.com/btr/session/90/',
    'https://your-pwa-url.com/baseline/read/',
    'https://your-pwa-url.com/recall/',
  ])('種目や計測の途中では更新させない: %s', (url) => {
    expect(allowsPullToRefresh(url)).toBe(false)
  })

  it('配信先のサブパスが付いていても見分ける', () => {
    // GitHub Pages ではリポジトリ名が頭に付く。
    expect(allowsPullToRefresh('https://pkochiel.github.io/Pokochiel/btr/saccade/')).toBe(false)
    expect(allowsPullToRefresh('https://pkochiel.github.io/Pokochiel/dashboard/')).toBe(true)
  })

  it('クエリやハッシュに紛れた文字列では判断しない', () => {
    expect(allowsPullToRefresh('https://your-pwa-url.com/dashboard/?next=/btr/saccade/')).toBe(true)
    expect(allowsPullToRefresh('https://your-pwa-url.com/dashboard/#/recall/')).toBe(true)
  })

  it('URL として読めなければ更新させない', () => {
    // 分からないときは、回が消えるほうを避ける。
    expect(allowsPullToRefresh('not a url')).toBe(false)
  })
})
