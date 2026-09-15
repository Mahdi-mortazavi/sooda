import i18n from './index'
import en from './sheets/en.json'
import fa from './sheets/fa.json'

/*
 * Strings that only ever appear inside a lazily-loaded sheet. Every lazy sheet
 * imports this module, so Rollup puts these translations in a shared chunk that
 * is fetched with the first sheet the user opens and never on first paint.
 * Both languages live here so switching language with a sheet open just works.
 */
i18n.addResourceBundle('en', 'translation', en, true, true)
i18n.addResourceBundle('fa', 'translation', fa, true, true)
