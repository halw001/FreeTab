import { useState, useRef, useEffect } from 'react';
import { useTabStore } from '../../src/store/useTabStore';
import { themes, getTheme, type ThemeId } from '../../src/themes';
import { SUPPORTED_LOCALES, t, type Locale, type Translations } from '../../src/i18n';

const themeIds: ThemeId[] = ['default', 'dark', 'forest', 'ocean', 'sunset', 'sakura'];

const themeNameKeys: Record<ThemeId, keyof Translations> = {
  default: 'themeDefault',
  dark: 'themeDark',
  forest: 'themeForest',
  ocean: 'themeOcean',
  sunset: 'themeSunset',
  sakura: 'themeSakura',
};

export default function SettingsView() {
  const currentTheme = useTabStore((state) => state.theme);
  const setTheme = useTabStore((state) => state.setTheme);
  const currentLocale = useTabStore((state) => state.locale);
  const setLocale = useTabStore((state) => state.setLocale);
  const setCurrentView = useTabStore((state) => state.setCurrentView);
  const themeColors = getTheme(currentTheme);

  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLocaleInfo = SUPPORTED_LOCALES.find((l) => l.id === currentLocale) ?? SUPPORTED_LOCALES[0];

  const tr = (key: Parameters<typeof t>[1], params?: Record<string, string | number>) =>
    t(currentLocale, key, params);

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: themeColors.textPrimary }}>{tr('settings')}</h1>
        <p className="text-sm" style={{ color: themeColors.textMuted }}>{tr('customizeAppearance')}</p>
      </div>

      <div className="mb-12">
        <h2 className="text-lg font-semibold mb-4" style={{ color: themeColors.textPrimary }}>{tr('changeSkin')}</h2>
        <div className="grid grid-cols-3 gap-3">
          {themeIds.map((id) => {
            const theme = themes[id];
            const isActive = currentTheme === id;
            return (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
                  isActive
                    ? 'border-blue-500 shadow-md ring-1 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={{ backgroundColor: theme.cardBg }}
              >
                {isActive && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg
                      className="w-2.5 h-2.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
                <div className="flex gap-1">
                  <div
                    className="w-4 h-4 rounded-sm"
                    style={{ backgroundColor: theme.sidebarBg, border: `1px solid ${theme.sidebarBorder}` }}
                  />
                  <div
                    className="w-4 h-4 rounded-sm"
                    style={{ backgroundColor: theme.mainBg, border: `1px solid ${theme.headerBorder}` }}
                  />
                  <div
                    className="w-4 h-4 rounded-sm"
                    style={{ backgroundColor: theme.accent }}
                  />
                  <div
                    className="w-4 h-4 rounded-sm"
                    style={{ backgroundColor: theme.buttonPrimaryBg }}
                  />
                </div>
                <span
                  className="text-xs font-medium"
                  style={{ color: theme.textPrimary }}
                >
                  {tr(themeNameKeys[id])}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4" style={{ color: themeColors.textPrimary }}>{tr('language')}</h2>
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center justify-between w-56 px-3 py-2 text-sm border rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            style={{
              borderColor: themeColors.inputBorder,
              backgroundColor: themeColors.inputBg,
              color: themeColors.textPrimary,
            }}
          >
            <span>{currentLocaleInfo.nativeLabel}</span>
            <svg
              className={`w-3 h-3 transition-transform ${langOpen ? 'rotate-180' : ''}`}
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {langOpen && (
            <div
              className="absolute z-50 mt-1 w-56 border rounded-md shadow-lg overflow-y-auto"
              style={{
                maxHeight: '16rem',
                borderColor: themeColors.inputBorder,
                backgroundColor: themeColors.inputBg,
              }}
            >
              {SUPPORTED_LOCALES.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => {
                    setLocale(loc.id);
                    setLangOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    loc.id === currentLocale ? 'font-semibold' : ''
                  }`}
                  style={{
                    color: themeColors.textPrimary,
                    backgroundColor: loc.id === currentLocale ? themeColors.sidebarHoverBg : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (loc.id !== currentLocale) {
                      e.currentTarget.style.backgroundColor = themeColors.sidebarHoverBg;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (loc.id !== currentLocale) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {loc.nativeLabel}
                </button>
              ))}
            </div>
          )}
        </div>
        <a
          href="https://github.com/halw001/FreeTab"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors hover:bg-black/5 mt-3"
          style={{ color: themeColors.textMuted }}
          title="GitHub"
          aria-label="GitHub"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
        </a>
      </div>

      <div className="mt-8">
        <button
          onClick={() => setCurrentView('home')}
          className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-md transition-colors"
        >
          {tr('backToHome')}
        </button>
      </div>
    </div>
  );
}