import { useTabStore } from '../../src/store/useTabStore';
import { themes, getTheme, type ThemeId } from '../../src/themes';

const themeIds: ThemeId[] = ['default', 'dark', 'forest', 'ocean', 'sunset', 'sakura'];

export default function SettingsView() {
  const currentTheme = useTabStore((state) => state.theme);
  const setTheme = useTabStore((state) => state.setTheme);
  const setCurrentView = useTabStore((state) => state.setCurrentView);
  const t = getTheme(currentTheme);

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: t.textPrimary }}>设置</h1>
        <p className="text-sm" style={{ color: t.textMuted }}>自定义 FreeTab 的外观</p>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4" style={{ color: t.textPrimary }}>更换皮肤</h2>
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
                  {theme.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        <button
          onClick={() => setCurrentView('home')}
          className="text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-2 rounded-md transition-colors"
        >
          ← 返回首页
        </button>
      </div>
    </div>
  );
}