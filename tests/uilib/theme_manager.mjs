/*
  Unit tests for lib/uilib/ThemeManager.js:
    node tests/uilib/theme_manager.mjs
*/

function makeStorage() {
    const m = new Map();
    return {
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => { m.set(k, String(v)); },
        removeItem: (k) => { m.delete(k); },
        clear: () => m.clear(),
    };
}

const storage = makeStorage();
const dataset = {};
let prefersDark = false;

globalThis.localStorage = storage;
globalThis.document = { documentElement: { dataset } };
globalThis.matchMedia = () => ({ matches: prefersDark });

const {
    THEME_STORAGE_KEY,
    initTheme,
    getTheme,
    getResolvedTheme,
    setTheme,
    cycleTheme,
    onThemeChange,
    themeLabel,
} = await import('../../lib/uilib/ThemeManager.js');

let failed = 0, checks = 0;
function check(ok, msg) {
    checks++;
    if (!ok) { failed++; console.log('FAILED:', msg); }
}

// 1. Default theme is 'light'
check(initTheme() === 'light', 'default theme is light');
check(getTheme() === 'light', 'getTheme returns light');
check(dataset.theme === 'light', 'dataset.theme set to light');
check(getResolvedTheme() === 'light', 'resolved default is light');

// 2. setTheme persists and fires listeners
const events = [];
const off = onThemeChange((mode, resolved) => events.push([mode, resolved]));
setTheme('dark');
check(getTheme() === 'dark', 'setTheme dark');
check(storage.getItem(THEME_STORAGE_KEY) === 'dark', 'persisted dark under symmhub_theme');
check(dataset.theme === 'dark', 'dataset.theme updated to dark');
check(getResolvedTheme() === 'dark', 'resolved dark is dark');
check(events.length === 1 && events[0][0] === 'dark' && events[0][1] === 'dark', 'listener notified once');

// Setting same value does not re-fire
setTheme('dark');
check(events.length === 1, 'setting unchanged mode does not re-fire listener');

// 3. system mode follows matchMedia
prefersDark = true;
setTheme('system');
check(getTheme() === 'system', 'setTheme system');
check(getResolvedTheme() === 'dark', 'system resolves to dark when OS prefers dark');
prefersDark = false;
check(getResolvedTheme() === 'light', 'system resolves to light when OS prefers light');

// 4. cycleTheme cycles light -> dark -> system -> light
setTheme('light');
check(cycleTheme() === 'dark', 'cycle light -> dark');
check(cycleTheme() === 'system', 'cycle dark -> system');
check(cycleTheme() === 'light', 'cycle system -> light');

// 5. Invalid mode falls back to 'light'
setTheme('neon-purple');
check(getTheme() === 'light', 'invalid mode falls back to light');

// 6. Unsubscribe works
const beforeOff = events.length;
off();
setTheme('dark');
check(events.length === beforeOff, 'unsubscribed listener is not called');

// 7. themeLabel returns expected metadata
check(themeLabel('light').label === 'Light', 'themeLabel light');
check(themeLabel('dark').label === 'Dark', 'themeLabel dark');
check(themeLabel('system').label === 'System', 'themeLabel system');

console.log(`${checks - failed} of ${checks} checks passed`);
if (failed) process.exit(1);
