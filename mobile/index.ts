import { registerRootComponent } from 'expo'
import App from './App'

// AppRegistry.registerComponent('main', () => App) にあたる。
// Expo Go でも自分でビルドしたアプリでも、同じ入口で起動できるようにしてくれる。
registerRootComponent(App)
