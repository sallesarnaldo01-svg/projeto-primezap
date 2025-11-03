// neutralize old service workers and refresh clients
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', async () => {
  try {
    const regs = self.registration.getRegistrations ? await self.registration.getRegistrations() : [self.registration]
    for (const r of regs) { try { await r.unregister() } catch (_) {} }
    const clients = await self.clients.matchAll({includeUncontrolled:true})
    for (const c of clients) c.navigate(c.url)
  } catch (_) {}
})
