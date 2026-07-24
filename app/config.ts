import { version } from '../package.json'

export { version }

export const SITE_ENV = import.meta.dev ? 'development' : 'production'

// Site name
export const PROJECT_NAME = 'PixivNow'
export const PROJECT_TAGLINE = 'Enjoy Pixiv Now'
