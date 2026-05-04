export async function requestHostPermission(url: string): Promise<boolean> {
  try {
    const origin = new URL(url).origin + '/*';
    const hasPermission = await chrome.permissions.contains({ origins: [origin] });
    if (hasPermission) return true;
    return await chrome.permissions.request({ origins: [origin] });
  } catch (error) {
    console.error('Permission request error:', error);
    return false;
  }
}
