import os

# Base layout components derived exactly from Sprint 1-4 master-layout.html
TAILWIND_CONFIG = """
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">
<script>
  tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        "colors": {
          "on-surface-variant": "#424656", "inverse-surface": "#2d3133", "secondary-fixed": "#d3e4fe",
          "tertiary": "#005c85", "surface-container-lowest": "#ffffff", "surface-container": "#eceef0",
          "surface-variant": "#e0e3e5", "on-primary": "#ffffff", "primary-container": "#0061ff",
          "surface-container-highest": "#e0e3e5", "tertiary-container": "#0076a9", "surface-bright": "#f7f9fb",
          "on-tertiary": "#ffffff", "background": "#f7f9fb", "outline": "#737687", "outline-variant": "#c2c6d9",
          "on-secondary-container": "#54647a", "error-container": "#ffdad6", "surface-dim": "#d8dadc",
          "primary": "#004bca", "surface-container-low": "#f2f4f6", "error": "#ba1a1a",
          "secondary-fixed-dim": "#b7c8e1", "on-secondary": "#ffffff", "on-error-container": "#93000a",
          "tertiary-fixed-dim": "#89ceff", "on-tertiary-container": "#eaf4ff", "on-secondary-fixed": "#0b1c30",
          "secondary": "#505f76", "surface-container-high": "#e6e8ea", "on-tertiary-fixed": "#001e2f",
          "inverse-on-surface": "#eff1f3", "primary-fixed-dim": "#b4c5ff", "on-tertiary-fixed-variant": "#004c6e",
          "on-secondary-fixed-variant": "#38485d", "on-primary-container": "#f1f2ff", "primary-fixed": "#dbe1ff",
          "inverse-primary": "#b4c5ff", "surface-tint": "#0052dc", "on-surface": "#191c1e",
          "on-primary-fixed-variant": "#003ea8", "on-background": "#191c1e", "on-error": "#ffffff",
          "on-primary-fixed": "#00174b", "tertiary-fixed": "#c9e6ff", "secondary-container": "#d0e1fb",
          "surface": "#f7f9fb",
          "status-critical": "#ba1a1a",
          "status-normal": "#10b981",
          "status-warning": "#f59e0b"
        },
        "spacing": {
          "sidebar-width": "280px"
        },
        "fontFamily": { "sans": ["Inter", "sans-serif"] }
      }
    }
  }
</script>
<style>
  body { font-family: 'Inter', sans-serif; }
  .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
  .material-symbols-outlined.fill { font-variation-settings: 'FILL' 1; }
  
  /* Sidebar scrollbar styling */
  .sidebar-scroll::-webkit-scrollbar { width: 6px; }
  .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
  .sidebar-scroll::-webkit-scrollbar-thumb { background: #c2c6d9; border-radius: 4px; }
  .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: #737687; }
</style>
"""

def generate_html(filename, title, active_nav, page_header, content):
    # Sidebar HTML mirroring master-layout.html exactly
    sidebar = f"""
<aside class="w-sidebar-width h-screen fixed left-0 top-0 hidden lg:flex flex-col border-r border-outline-variant bg-surface-container-low z-50">
    <div class="flex-1 overflow-y-auto py-4 sidebar-scroll">
        <div class="p-6 border-b border-outline-variant">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center text-on-primary">
                    <span class="material-symbols-outlined fill">local_hospital</span>
                </div>
                <div>
                    <h1 class="text-xl font-bold text-primary leading-tight">HealthSync Pro</h1>
                    <p class="text-xs text-outline font-medium tracking-wide">Enterprise Health</p>
                </div>
            </div>
            <div class="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 flex items-center gap-2 mt-4">
                <span class="material-symbols-outlined text-[16px] text-primary">shield</span>
                <span class="text-xs font-bold text-primary">Admin Access</span>
            </div>
        </div>
        
        <nav class="flex-1 flex flex-col gap-1 px-3 py-4">
            <p class="px-3 pt-2 pb-1 text-[11px] font-bold text-outline uppercase tracking-wider">User Area</p>
            <a href="#" class="flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors">
                <span class="material-symbols-outlined text-[20px]">dashboard</span> Dashboard
            </a>
            
            <div class="mt-4 mb-2">
                <div class="h-px bg-outline-variant mx-3 relative">
                    <div class="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-surface-container-low px-2">
                        <span class="text-[10px] font-bold text-outline uppercase tracking-widest">Admin Area</span>
                    </div>
                </div>
            </div>

            <a href="admin_dashboard.html" class="flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-medium {'bg-primary/10 text-primary border-l-4 border-primary font-bold' if active_nav == 'dashboard' else 'text-on-surface-variant hover:bg-surface-container transition-colors'}">
                <span class="material-symbols-outlined text-[20px] {'fill' if active_nav == 'dashboard' else ''}">dashboard_customize</span> Admin Dashboard
            </a>
            <a href="admin_users_roles.html" class="flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-medium {'bg-primary/10 text-primary border-l-4 border-primary font-bold' if active_nav == 'users' else 'text-on-surface-variant hover:bg-surface-container transition-colors'}">
                <span class="material-symbols-outlined text-[20px] {'fill' if active_nav == 'users' else ''}">manage_accounts</span> Users & Roles
            </a>
            <a href="admin_plans_subscriptions.html" class="flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-medium {'bg-primary/10 text-primary border-l-4 border-primary font-bold' if active_nav == 'plans' else 'text-on-surface-variant hover:bg-surface-container transition-colors'}">
                <span class="material-symbols-outlined text-[20px] {'fill' if active_nav == 'plans' else ''}">workspace_premium</span> Plans & Subscriptions
            </a>
            <a href="admin_ai_config.html" class="flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-medium {'bg-primary/10 text-primary border-l-4 border-primary font-bold' if active_nav == 'ai' else 'text-on-surface-variant hover:bg-surface-container transition-colors'}">
                <span class="material-symbols-outlined text-[20px] {'fill' if active_nav == 'ai' else ''}">model_training</span> AI Configuration
            </a>
            <a href="admin_system_config.html" class="flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-medium {'bg-primary/10 text-primary border-l-4 border-primary font-bold' if active_nav == 'system' else 'text-on-surface-variant hover:bg-surface-container transition-colors'}">
                <span class="material-symbols-outlined text-[20px] {'fill' if active_nav == 'system' else ''}">tune</span> System Config
            </a>
            <a href="admin_audit_logs.html" class="flex items-center gap-4 px-3 py-2.5 rounded-lg text-sm font-medium {'bg-primary/10 text-primary border-l-4 border-primary font-bold' if active_nav == 'audit' else 'text-on-surface-variant hover:bg-surface-container transition-colors'}">
                <span class="material-symbols-outlined text-[20px] {'fill' if active_nav == 'audit' else ''}">fact_check</span> Audit Logs
            </a>
        </nav>
    </div>
</aside>
"""

    topbar = """
<header class="sticky top-0 z-40 flex items-center justify-between h-[64px] px-8 bg-surface border-b border-outline-variant shadow-sm">
    <div class="flex items-center gap-4">
        <div class="relative w-96 hidden lg:block">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
            <input type="text" placeholder="Cari user, config, atau log..." class="w-full h-10 pl-10 pr-4 bg-surface-container-lowest border border-outline-variant rounded-full text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all">
        </div>
    </div>
    <div class="flex items-center gap-4">
        <button class="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors relative">
            <span class="material-symbols-outlined text-[22px]">notifications</span>
            <span class="absolute top-2 right-2 w-2 h-2 rounded-full bg-status-critical border-2 border-surface"></span>
        </button>
        <div class="h-8 w-px bg-outline-variant mx-1"></div>
        <button class="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-surface-container transition-colors">
            <div class="text-right hidden md:block">
                <p class="text-sm font-bold text-on-surface leading-tight">Super Admin</p>
                <p class="text-[11px] text-on-surface-variant">admin@hl.id</p>
            </div>
            <div class="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary font-bold text-sm">
                SA
            </div>
        </button>
    </div>
</header>
"""

    html = f"""<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    {TAILWIND_CONFIG}
</head>
<body class="bg-background text-on-surface antialiased min-h-screen flex">
    {sidebar}
    <main class="flex-1 lg:ml-[280px] flex flex-col min-h-screen relative w-full">
        {topbar}
        <div class="flex-1 p-4 md:p-8 overflow-x-hidden">
            <div class="max-w-[1440px] mx-auto">
                <div class="mb-8">
                    <h1 class="text-3xl font-bold text-on-surface mb-2">{page_header['title']}</h1>
                    <p class="text-on-surface-variant text-base">{page_header['subtitle']}</p>
                </div>
                {content}
            </div>
        </div>
    </main>
</body>
</html>"""

    with open(f"c:/codex/health/docs_sprint5/Frontend/{filename}", "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Generated {filename}")

def main():
    # 1. admin_dashboard.html
    generate_html(
        "admin_dashboard.html",
        "Admin Dashboard - HealthSync Pro",
        "dashboard",
        {"title": "Admin Dashboard", "subtitle": "Ringkasan sistem, kesehatan platform, dan aktivitas terkini."},
        """
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div class="flex justify-between items-start mb-4">
                    <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <span class="material-symbols-outlined text-[24px]">group</span>
                    </div>
                    <span class="bg-status-normal/10 text-status-normal text-xs font-bold px-2 py-1 rounded-full">+12%</span>
                </div>
                <p class="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Total Users</p>
                <h3 class="text-3xl font-bold text-on-surface">1,284</h3>
            </div>
            <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div class="flex justify-between items-start mb-4">
                    <div class="w-12 h-12 rounded-lg bg-tertiary-container/10 flex items-center justify-center text-tertiary-container">
                        <span class="material-symbols-outlined text-[24px]">workspace_premium</span>
                    </div>
                    <span class="bg-status-normal/10 text-status-normal text-xs font-bold px-2 py-1 rounded-full">+5%</span>
                </div>
                <p class="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Active Premium</p>
                <h3 class="text-3xl font-bold text-on-surface">387</h3>
            </div>
            <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div class="flex justify-between items-start mb-4">
                    <div class="w-12 h-12 rounded-lg bg-status-normal/10 flex items-center justify-center text-status-normal">
                        <span class="material-symbols-outlined text-[24px]">payments</span>
                    </div>
                    <span class="bg-status-normal/10 text-status-normal text-xs font-bold px-2 py-1 rounded-full">+8.2%</span>
                </div>
                <p class="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-1">MRR (Premium)</p>
                <h3 class="text-3xl font-bold text-on-surface">Rp 15.4M</h3>
            </div>
            <div class="bg-surface-container-lowest border border-status-critical/30 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                <div class="absolute top-0 left-0 w-1 h-full bg-status-critical"></div>
                <div class="flex justify-between items-start mb-4">
                    <div class="w-12 h-12 rounded-lg bg-status-critical/10 flex items-center justify-center text-status-critical">
                        <span class="material-symbols-outlined text-[24px]">warning</span>
                    </div>
                    <span class="bg-status-critical text-on-error text-xs font-bold px-2 py-1 rounded-full animate-pulse">Action Required</span>
                </div>
                <p class="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Red Flags Today</p>
                <h3 class="text-3xl font-bold text-on-surface">3</h3>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div class="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-bright">
                    <h2 class="text-lg font-bold text-on-surface">Recent Audit Logs</h2>
                    <a href="admin_audit_logs.html" class="text-primary font-semibold text-sm hover:underline">Lihat Semua →</a>
                </div>
                <div class="overflow-x-auto flex-1">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider">
                                <th class="px-6 py-4 font-bold border-b border-outline-variant">Waktu</th>
                                <th class="px-6 py-4 font-bold border-b border-outline-variant">Aktor</th>
                                <th class="px-6 py-4 font-bold border-b border-outline-variant">Aksi</th>
                                <th class="px-6 py-4 font-bold border-b border-outline-variant">Target</th>
                                <th class="px-6 py-4 font-bold border-b border-outline-variant">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-outline-variant text-sm">
                            <tr class="hover:bg-surface-container-low/50 transition-colors">
                                <td class="px-6 py-4 whitespace-nowrap text-on-surface-variant">14:28</td>
                                <td class="px-6 py-4 whitespace-nowrap font-medium text-on-surface">admin@hl.id</td>
                                <td class="px-6 py-4">Update System Config</td>
                                <td class="px-6 py-4 text-on-surface-variant">aiExtractTimeoutMs → 7000ms</td>
                                <td class="px-6 py-4"><span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-status-normal/10 text-status-normal border border-status-normal/20"><span class="w-1.5 h-1.5 rounded-full bg-status-normal"></span> Success</span></td>
                            </tr>
                            <tr class="hover:bg-surface-container-low/50 transition-colors">
                                <td class="px-6 py-4 whitespace-nowrap text-on-surface-variant">14:15</td>
                                <td class="px-6 py-4 whitespace-nowrap font-medium text-on-surface">superadmin</td>
                                <td class="px-6 py-4">Assign Role</td>
                                <td class="px-6 py-4 text-on-surface-variant">user@gmail.com → billingAdmin</td>
                                <td class="px-6 py-4"><span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-status-normal/10 text-status-normal border border-status-normal/20"><span class="w-1.5 h-1.5 rounded-full bg-status-normal"></span> Success</span></td>
                            </tr>
                            <tr class="hover:bg-surface-container-low/50 transition-colors">
                                <td class="px-6 py-4 whitespace-nowrap text-on-surface-variant">13:22</td>
                                <td class="px-6 py-4 whitespace-nowrap font-medium text-on-surface">admin@hl.id</td>
                                <td class="px-6 py-4">Update Plan</td>
                                <td class="px-6 py-4 text-on-surface-variant">premiumMonthly price → Rp 49.000</td>
                                <td class="px-6 py-4"><span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-status-normal/10 text-status-normal border border-status-normal/20"><span class="w-1.5 h-1.5 rounded-full bg-status-normal"></span> Success</span></td>
                            </tr>
                            <tr class="hover:bg-surface-container-low/50 transition-colors">
                                <td class="px-6 py-4 whitespace-nowrap text-on-surface-variant">12:30</td>
                                <td class="px-6 py-4 whitespace-nowrap font-medium text-on-surface">superadmin</td>
                                <td class="px-6 py-4">Revoke Role</td>
                                <td class="px-6 py-4 text-on-surface-variant">user@test.com</td>
                                <td class="px-6 py-4"><span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-status-warning/10 text-status-warning border border-status-warning/20"><span class="w-1.5 h-1.5 rounded-full bg-status-warning"></span> Warning</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="flex flex-col gap-6">
                <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
                    <h2 class="text-lg font-bold text-on-surface mb-4">System Health</h2>
                    <div class="space-y-4">
                        <div class="flex items-center justify-between p-3 rounded-lg border border-outline-variant bg-surface-bright">
                            <div class="flex items-center gap-3">
                                <span class="material-symbols-outlined text-primary text-[20px]">database</span>
                                <div>
                                    <p class="text-sm font-bold text-on-surface leading-tight">D1 Database</p>
                                    <p class="text-[11px] text-on-surface-variant">Latency: 12ms</p>
                                </div>
                            </div>
                            <span class="px-2 py-1 bg-status-normal/10 text-status-normal text-[10px] font-bold uppercase rounded border border-status-normal/20">Healthy</span>
                        </div>
                        <div class="flex items-center justify-between p-3 rounded-lg border border-outline-variant bg-surface-bright">
                            <div class="flex items-center gap-3">
                                <span class="material-symbols-outlined text-primary text-[20px]">cloud</span>
                                <div>
                                    <p class="text-sm font-bold text-on-surface leading-tight">R2 Storage</p>
                                    <p class="text-[11px] text-on-surface-variant">1.2 GB / 10 GB</p>
                                </div>
                            </div>
                            <span class="px-2 py-1 bg-status-normal/10 text-status-normal text-[10px] font-bold uppercase rounded border border-status-normal/20">Healthy</span>
                        </div>
                        <div class="flex items-center justify-between p-3 rounded-lg border border-outline-variant bg-surface-bright">
                            <div class="flex items-center gap-3">
                                <span class="material-symbols-outlined text-primary text-[20px]">smart_toy</span>
                                <div>
                                    <p class="text-sm font-bold text-on-surface leading-tight">AI Vision</p>
                                    <p class="text-[11px] text-on-surface-variant">Avg response: 2.4s</p>
                                </div>
                            </div>
                            <span class="px-2 py-1 bg-status-normal/10 text-status-normal text-[10px] font-bold uppercase rounded border border-status-normal/20">Healthy</span>
                        </div>
                        <div class="flex items-center justify-between p-3 rounded-lg border border-status-warning/30 bg-status-warning/5">
                            <div class="flex items-center gap-3">
                                <span class="material-symbols-outlined text-status-warning text-[20px]">conveyor_belt</span>
                                <div>
                                    <p class="text-sm font-bold text-on-surface leading-tight">Queue Worker</p>
                                    <p class="text-[11px] text-status-warning">3 jobs pending</p>
                                </div>
                            </div>
                            <span class="px-2 py-1 bg-status-warning/10 text-status-warning text-[10px] font-bold uppercase rounded border border-status-warning/20">Degraded</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        """
    )

    # 2. admin_ai_config.html
    generate_html(
        "admin_ai_config.html",
        "AI Configuration - Admin - HealthSync Pro",
        "ai",
        {"title": "AI Configuration", "subtitle": "Kelola parameter prompt, limitasi, dan model AI yang digunakan oleh platform."},
        """
        <div class="grid lg:grid-cols-3 gap-8">
            <div class="lg:col-span-2 space-y-6">
                <!-- AI Vision Config -->
                <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
                    <div class="flex justify-between items-center mb-6">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                <span class="material-symbols-outlined">document_scanner</span>
                            </div>
                            <div>
                                <h2 class="text-lg font-bold text-on-surface">AI Vision Extraction</h2>
                                <p class="text-sm text-on-surface-variant">Konfigurasi OCR dan Ekstraksi Pengukuran</p>
                            </div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" value="" class="sr-only peer" checked>
                          <div class="w-11 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-on-surface mb-1">Model Engine</label>
                            <select class="w-full h-11 px-3 bg-surface border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                                <option>Gemini 1.5 Flash (Fastest)</option>
                                <option>Gemini 1.5 Pro (High Accuracy)</option>
                                <option>Claude 3.5 Sonnet</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-on-surface mb-1">System Prompt Template</label>
                            <textarea rows="4" class="w-full p-3 bg-surface border border-outline-variant rounded-lg text-sm font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none text-on-surface-variant">You are an expert medical data extractor. Extract only the numerical values for the requested metric. If not found, return null. Format as JSON.</textarea>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-semibold text-on-surface mb-1">Temperature</label>
                                <input type="number" step="0.1" value="0.0" class="w-full h-11 px-3 bg-surface border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                            </div>
                            <div>
                                <label class="block text-sm font-semibold text-on-surface mb-1">Max Tokens</label>
                                <input type="number" value="150" class="w-full h-11 px-3 bg-surface border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                            </div>
                        </div>
                        <div class="pt-2 flex justify-end">
                            <button class="px-5 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm">Simpan Perubahan</button>
                        </div>
                    </div>
                </div>

                <!-- AI Assistant Config -->
                <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
                    <div class="flex justify-between items-center mb-6">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-tertiary-container/10 flex items-center justify-center text-tertiary-container">
                                <span class="material-symbols-outlined">smart_toy</span>
                            </div>
                            <div>
                                <h2 class="text-lg font-bold text-on-surface">AI Health Assistant</h2>
                                <p class="text-sm text-on-surface-variant">Konfigurasi asisten virtual interaktif</p>
                            </div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" value="" class="sr-only peer" checked>
                          <div class="w-11 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-on-surface mb-1">Model Engine</label>
                            <select class="w-full h-11 px-3 bg-surface border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                                <option>Claude 3.5 Sonnet (Recommended)</option>
                                <option>Gemini 1.5 Pro</option>
                                <option>GPT-4o</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-on-surface mb-1">Base System Prompt</label>
                            <textarea rows="6" class="w-full p-3 bg-surface border border-outline-variant rounded-lg text-sm font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none text-on-surface-variant">Anda adalah asisten kesehatan profesional dari HealthSync Pro. Anda TIDAK BOLEH mendiagnosis atau memberikan saran pengobatan. Selalu sarankan untuk berkonsultasi dengan dokter untuk gejala serius. Gunakan bahasa Indonesia yang ramah, empati, dan profesional.</textarea>
                        </div>
                        <div class="pt-2 flex justify-end">
                            <button class="px-5 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm">Simpan Perubahan</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Side Panel -->
            <div class="space-y-6">
                <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
                    <h2 class="text-base font-bold text-on-surface mb-4">Statistik Penggunaan AI</h2>
                    <div class="space-y-4">
                        <div class="flex justify-between items-center py-2 border-b border-outline-variant">
                            <span class="text-sm text-on-surface-variant">Vision Request (Hari ini)</span>
                            <span class="text-sm font-bold text-on-surface">1,452</span>
                        </div>
                        <div class="flex justify-between items-center py-2 border-b border-outline-variant">
                            <span class="text-sm text-on-surface-variant">Assistant Chat (Hari ini)</span>
                            <span class="text-sm font-bold text-on-surface">3,204</span>
                        </div>
                        <div class="flex justify-between items-center py-2 border-b border-outline-variant">
                            <span class="text-sm text-on-surface-variant">Avg Vision Latency</span>
                            <span class="text-sm font-bold text-on-surface">2.4s</span>
                        </div>
                        <div class="flex justify-between items-center py-2">
                            <span class="text-sm text-on-surface-variant">Avg Chat Latency</span>
                            <span class="text-sm font-bold text-on-surface">3.8s</span>
                        </div>
                    </div>
                </div>

                <div class="bg-primary/5 border border-primary/20 rounded-xl p-5">
                    <div class="flex items-start gap-3">
                        <span class="material-symbols-outlined text-primary mt-0.5">info</span>
                        <div>
                            <h3 class="text-sm font-bold text-primary mb-1">Catatan Keselamatan</h3>
                            <p class="text-xs text-on-surface-variant leading-relaxed">Perubahan pada System Prompt akan langsung berlaku untuk semua interaksi AI berikutnya. Pastikan instruksi keselamatan (disclaimer medis) tidak terhapus.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        """
    )
    
    # 3. admin_audit_logs.html
    generate_html(
        "admin_audit_logs.html",
        "Audit Logs - Admin - HealthSync Pro",
        "audit",
        {"title": "Audit Logs", "subtitle": "Riwayat aktivitas sensitif, perubahan role, dan akses data sistem."},
        """
        <div class="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col h-[700px]">
            <div class="p-6 border-b border-outline-variant bg-surface-bright flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="flex gap-3 w-full md:w-auto">
                    <div class="relative flex-1 md:w-64">
                        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                        <input type="text" placeholder="Cari aktor, IP, atau target..." class="w-full h-10 pl-10 pr-4 bg-surface border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                    </div>
                    <select class="h-10 px-3 bg-surface border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-primary">
                        <option>Semua Aksi</option>
                        <option>Role Update</option>
                        <option>Config Update</option>
                        <option>User Login</option>
                    </select>
                </div>
                <button class="flex items-center justify-center gap-2 px-4 py-2 border border-outline-variant rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
                    <span class="material-symbols-outlined text-[18px]">download</span> Export CSV
                </button>
            </div>
            
            <div class="overflow-x-auto flex-1 bg-surface-container-lowest">
                <table class="w-full text-left border-collapse">
                    <thead class="sticky top-0 bg-surface-container-low shadow-[0_1px_0_var(--color-outline-variant)]">
                        <tr class="text-on-surface-variant text-xs uppercase tracking-wider">
                            <th class="px-6 py-4 font-bold">Timestamp</th>
                            <th class="px-6 py-4 font-bold">Aktor / IP</th>
                            <th class="px-6 py-4 font-bold">Aksi</th>
                            <th class="px-6 py-4 font-bold">Detail Metadata</th>
                            <th class="px-6 py-4 font-bold">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-outline-variant text-sm">
                        <!-- Log 1 -->
                        <tr class="hover:bg-surface-container-low/30 transition-colors">
                            <td class="px-6 py-4 whitespace-nowrap text-on-surface-variant">
                                <div>24 Jun 2026</div>
                                <div class="text-xs mt-0.5">14:28:45 WIB</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="font-bold text-on-surface">admin@hl.id</div>
                                <div class="text-xs text-on-surface-variant mt-0.5">103.22.44.1</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="bg-surface-container px-2 py-1 rounded text-xs font-semibold font-mono border border-outline-variant">CONFIG_UPDATE</span>
                            </td>
                            <td class="px-6 py-4">
                                <div class="font-mono text-xs text-on-surface-variant bg-surface-container-low p-2 rounded border border-outline-variant break-all">
                                    {"key":"aiExtractTimeoutMs","old":"5000","new":"7000"}
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-status-normal/10 text-status-normal border border-status-normal/20">Success</span>
                            </td>
                        </tr>
                        <!-- Log 2 -->
                        <tr class="hover:bg-surface-container-low/30 transition-colors">
                            <td class="px-6 py-4 whitespace-nowrap text-on-surface-variant">
                                <div>24 Jun 2026</div>
                                <div class="text-xs mt-0.5">13:15:10 WIB</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="font-bold text-on-surface">superadmin</div>
                                <div class="text-xs text-on-surface-variant mt-0.5">114.12.99.3</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="bg-surface-container px-2 py-1 rounded text-xs font-semibold font-mono border border-outline-variant">ROLE_GRANT</span>
                            </td>
                            <td class="px-6 py-4">
                                <div class="font-mono text-xs text-on-surface-variant bg-surface-container-low p-2 rounded border border-outline-variant break-all">
                                    {"target_user":"doctor1@hl.id","role":"medical_reviewer"}
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-status-normal/10 text-status-normal border border-status-normal/20">Success</span>
                            </td>
                        </tr>
                        <!-- Log 3 -->
                        <tr class="hover:bg-surface-container-low/30 transition-colors">
                            <td class="px-6 py-4 whitespace-nowrap text-on-surface-variant">
                                <div>24 Jun 2026</div>
                                <div class="text-xs mt-0.5">12:30:05 WIB</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="font-bold text-on-surface">system_cron</div>
                                <div class="text-xs text-on-surface-variant mt-0.5">internal</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="bg-surface-container px-2 py-1 rounded text-xs font-semibold font-mono border border-outline-variant">SUBSCRIPTION_RENEWAL_FAIL</span>
                            </td>
                            <td class="px-6 py-4">
                                <div class="font-mono text-xs text-on-surface-variant bg-surface-container-low p-2 rounded border border-outline-variant break-all">
                                    {"target_user":"user123@gmail.com","reason":"card_declined"}
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-status-critical/10 text-status-critical border border-status-critical/20">Failed</span>
                            </td>
                        </tr>
                        <!-- Log 4 -->
                        <tr class="hover:bg-surface-container-low/30 transition-colors">
                            <td class="px-6 py-4 whitespace-nowrap text-on-surface-variant">
                                <div>24 Jun 2026</div>
                                <div class="text-xs mt-0.5">11:05:22 WIB</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="font-bold text-on-surface">admin@hl.id</div>
                                <div class="text-xs text-on-surface-variant mt-0.5">103.22.44.1</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="bg-surface-container px-2 py-1 rounded text-xs font-semibold font-mono border border-outline-variant">PLAN_UPDATE</span>
                            </td>
                            <td class="px-6 py-4">
                                <div class="font-mono text-xs text-on-surface-variant bg-surface-container-low p-2 rounded border border-outline-variant break-all">
                                    {"planId":"premiumMonthly","price_update":{"old":39000,"new":49000}}
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-status-normal/10 text-status-normal border border-status-normal/20">Success</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="p-4 border-t border-outline-variant flex justify-between items-center text-sm bg-surface-bright">
                <span class="text-on-surface-variant">Menampilkan 4 dari 12,458 logs</span>
                <div class="flex gap-2">
                    <button class="px-3 py-1.5 border border-outline-variant rounded-md text-on-surface-variant hover:bg-surface-container disabled:opacity-50" disabled>Sebelumnya</button>
                    <button class="px-3 py-1.5 border border-outline-variant rounded-md text-on-surface hover:bg-surface-container font-semibold">Selanjutnya</button>
                </div>
            </div>
        </div>
        """
    )
    
    # 4. admin_system_config.html
    generate_html(
        "admin_system_config.html",
        "System Config - Admin - HealthSync Pro",
        "system",
        {"title": "System Configuration", "subtitle": "Kelola konfigurasi sistem global. Perubahan akan segera diterapkan pada Worker."},
        """
        <div class="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
            <div class="p-6 border-b border-outline-variant bg-surface-bright flex justify-between items-center">
                <h2 class="text-lg font-bold text-on-surface">Global Constants</h2>
                <button class="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-bold hover:bg-primary/90 shadow-sm transition-colors">
                    <span class="material-symbols-outlined text-[18px]">add</span> Tambah Config
                </button>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead class="bg-surface-container-low text-on-surface-variant text-xs uppercase tracking-wider">
                        <tr>
                            <th class="px-6 py-4 font-bold border-b border-outline-variant w-1/4">Key</th>
                            <th class="px-6 py-4 font-bold border-b border-outline-variant w-1/4">Value</th>
                            <th class="px-6 py-4 font-bold border-b border-outline-variant w-1/6">Type</th>
                            <th class="px-6 py-4 font-bold border-b border-outline-variant w-1/4">Description</th>
                            <th class="px-6 py-4 font-bold border-b border-outline-variant w-24">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-outline-variant text-sm">
                        <!-- Row 1 -->
                        <tr class="hover:bg-surface-container-low/30 group">
                            <td class="px-6 py-4">
                                <div class="font-mono font-bold text-on-surface">aiExtractTimeoutMs</div>
                            </td>
                            <td class="px-6 py-4">
                                <div class="flex items-center gap-2">
                                    <input type="text" value="5000" class="w-full h-8 px-2 bg-transparent border border-transparent group-hover:border-outline-variant group-hover:bg-surface rounded focus:outline-none focus:border-primary focus:bg-surface transition-all font-mono">
                                </div>
                            </td>
                            <td class="px-6 py-4">
                                <span class="bg-surface-container px-2 py-1 rounded text-xs text-on-surface-variant font-mono">number</span>
                            </td>
                            <td class="px-6 py-4 text-on-surface-variant text-xs">
                                Timeout in milliseconds for AI Vision extraction
                            </td>
                            <td class="px-6 py-4">
                                <button class="text-primary hover:text-primary-container font-semibold text-sm">Simpan</button>
                            </td>
                        </tr>
                        <!-- Row 2 -->
                        <tr class="hover:bg-surface-container-low/30 group">
                            <td class="px-6 py-4">
                                <div class="font-mono font-bold text-on-surface">maxUploadSizeBytes</div>
                            </td>
                            <td class="px-6 py-4">
                                <div class="flex items-center gap-2">
                                    <input type="text" value="2097152" class="w-full h-8 px-2 bg-transparent border border-transparent group-hover:border-outline-variant group-hover:bg-surface rounded focus:outline-none focus:border-primary focus:bg-surface transition-all font-mono">
                                </div>
                            </td>
                            <td class="px-6 py-4">
                                <span class="bg-surface-container px-2 py-1 rounded text-xs text-on-surface-variant font-mono">number</span>
                            </td>
                            <td class="px-6 py-4 text-on-surface-variant text-xs">
                                Maximum file size for uploads in bytes (2MB)
                            </td>
                            <td class="px-6 py-4">
                                <button class="text-primary hover:text-primary-container font-semibold text-sm">Simpan</button>
                            </td>
                        </tr>
                        <!-- Row 3 -->
                        <tr class="hover:bg-surface-container-low/30 group">
                            <td class="px-6 py-4">
                                <div class="font-mono font-bold text-on-surface">telegramBotActive</div>
                            </td>
                            <td class="px-6 py-4">
                                <select class="w-full h-8 px-2 bg-transparent border border-transparent group-hover:border-outline-variant group-hover:bg-surface rounded focus:outline-none focus:border-primary focus:bg-surface transition-all font-mono">
                                    <option value="true" selected>true</option>
                                    <option value="false">false</option>
                                </select>
                            </td>
                            <td class="px-6 py-4">
                                <span class="bg-surface-container px-2 py-1 rounded text-xs text-on-surface-variant font-mono">boolean</span>
                            </td>
                            <td class="px-6 py-4 text-on-surface-variant text-xs">
                                Global toggle to enable/disable Telegram bot
                            </td>
                            <td class="px-6 py-4">
                                <button class="text-primary hover:text-primary-container font-semibold text-sm">Simpan</button>
                            </td>
                        </tr>
                        <!-- Row 4 -->
                        <tr class="hover:bg-surface-container-low/30 group">
                            <td class="px-6 py-4">
                                <div class="font-mono font-bold text-on-surface">loginRateLimitMaxReq</div>
                            </td>
                            <td class="px-6 py-4">
                                <div class="flex items-center gap-2">
                                    <input type="text" value="10" class="w-full h-8 px-2 bg-transparent border border-transparent group-hover:border-outline-variant group-hover:bg-surface rounded focus:outline-none focus:border-primary focus:bg-surface transition-all font-mono">
                                </div>
                            </td>
                            <td class="px-6 py-4">
                                <span class="bg-surface-container px-2 py-1 rounded text-xs text-on-surface-variant font-mono">number</span>
                            </td>
                            <td class="px-6 py-4 text-on-surface-variant text-xs">
                                Max login requests per window
                            </td>
                            <td class="px-6 py-4">
                                <button class="text-primary hover:text-primary-container font-semibold text-sm">Simpan</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="p-5 bg-surface-container-low border-t border-outline-variant text-sm text-on-surface-variant flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">info</span>
                Setelah disimpan, cache di Worker akan di-invalidate secara otomatis dan value baru akan langsung aktif.
            </div>
        </div>
        """
    )
    
    # 5. admin_plans_subscriptions.html
    generate_html(
        "admin_plans_subscriptions.html",
        "Plans & Subscriptions - Admin - HealthSync Pro",
        "plans",
        {"title": "Plans & Subscriptions", "subtitle": "Kelola paket berlangganan, harga, dan fitur (RBAC) yang tersedia."},
        """
        <div class="grid lg:grid-cols-3 gap-6">
            <!-- Free Plan -->
            <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm flex flex-col">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-bold text-on-surface">Free Tier</h2>
                    <span class="bg-surface-container text-on-surface-variant text-xs font-bold px-2.5 py-1 rounded-md border border-outline-variant">Aktif</span>
                </div>
                <div class="mb-6 pb-6 border-b border-outline-variant">
                    <p class="text-3xl font-bold text-on-surface mb-1">Rp 0</p>
                    <p class="text-sm text-on-surface-variant">Default plan untuk semua user baru</p>
                </div>
                <div class="flex-1 space-y-4 mb-6">
                    <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider">Features & Limits</h3>
                    <div class="space-y-3 text-sm">
                        <div class="flex justify-between items-center">
                            <span class="text-on-surface-variant">AI Assistant Limit</span>
                            <span class="font-mono font-bold text-on-surface">10 / bln</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-on-surface-variant">AI Vision Limit</span>
                            <span class="font-mono font-bold text-on-surface">5 / hari</span>
                        </div>
                        <div class="flex items-center gap-2 text-on-surface-variant">
                            <span class="material-symbols-outlined text-[16px] text-status-critical">close</span> AI Memory
                        </div>
                        <div class="flex items-center gap-2 text-on-surface-variant">
                            <span class="material-symbols-outlined text-[16px] text-status-critical">close</span> Caregiver Access
                        </div>
                    </div>
                </div>
                <button class="w-full py-2.5 border border-outline-variant rounded-lg text-sm font-bold text-on-surface hover:bg-surface-container transition-colors">Edit Config</button>
            </div>

            <!-- Premium Monthly -->
            <div class="bg-surface-container-lowest border-2 border-primary rounded-xl p-6 shadow-md flex flex-col relative overflow-hidden">
                <div class="absolute top-0 right-0 bg-primary text-on-primary text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">Populer</div>
                <div class="flex justify-between items-center mb-4 mt-2">
                    <h2 class="text-xl font-bold text-on-surface">Premium Monthly</h2>
                    <span class="bg-status-normal/10 text-status-normal border border-status-normal/20 text-xs font-bold px-2.5 py-1 rounded-md">145 Users</span>
                </div>
                <div class="mb-6 pb-6 border-b border-outline-variant">
                    <div class="flex items-end gap-2 mb-1">
                        <p class="text-3xl font-bold text-on-surface">Rp 49.000</p>
                        <p class="text-sm text-on-surface-variant pb-1">/ bulan</p>
                    </div>
                    <p class="text-sm text-on-surface-variant">Langganan bulanan auto-renew</p>
                </div>
                <div class="flex-1 space-y-4 mb-6">
                    <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider">Features & Limits</h3>
                    <div class="space-y-3 text-sm">
                        <div class="flex justify-between items-center">
                            <span class="text-on-surface-variant">AI Assistant Limit</span>
                            <span class="font-mono font-bold text-on-surface">200 / bln</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-on-surface-variant">AI Vision Limit</span>
                            <span class="font-mono font-bold text-on-surface">Unlimited</span>
                        </div>
                        <div class="flex items-center gap-2 text-on-surface">
                            <span class="material-symbols-outlined text-[16px] text-status-normal">check</span> AI Memory Active
                        </div>
                        <div class="flex items-center gap-2 text-on-surface">
                            <span class="material-symbols-outlined text-[16px] text-status-normal">check</span> Caregiver Access (1)
                        </div>
                    </div>
                </div>
                <button class="w-full py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm">Edit Config & Harga</button>
            </div>

            <!-- Premium Yearly -->
            <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm flex flex-col">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-bold text-on-surface">Premium Yearly</h2>
                    <span class="bg-status-normal/10 text-status-normal border border-status-normal/20 text-xs font-bold px-2.5 py-1 rounded-md">112 Users</span>
                </div>
                <div class="mb-6 pb-6 border-b border-outline-variant">
                    <div class="flex items-end gap-2 mb-1">
                        <p class="text-3xl font-bold text-on-surface">Rp 449.000</p>
                        <p class="text-sm text-on-surface-variant pb-1">/ tahun</p>
                    </div>
                    <p class="text-sm text-on-surface-variant text-status-normal font-semibold">Hemat Rp 139.000 (23%)</p>
                </div>
                <div class="flex-1 space-y-4 mb-6">
                    <h3 class="text-sm font-bold text-on-surface uppercase tracking-wider">Features & Limits</h3>
                    <div class="space-y-3 text-sm">
                        <div class="flex items-center gap-2 text-on-surface">
                            <span class="material-symbols-outlined text-[16px] text-status-normal">check</span> All Premium Monthly Features
                        </div>
                        <div class="flex justify-between items-center border-t border-outline-variant pt-3 mt-1">
                            <span class="text-on-surface-variant">Caregiver Access</span>
                            <span class="font-mono font-bold text-on-surface">Up to 3</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-on-surface-variant">Data Export</span>
                            <span class="font-mono font-bold text-on-surface">PDF & Excel</span>
                        </div>
                    </div>
                </div>
                <button class="w-full py-2.5 border border-outline-variant rounded-lg text-sm font-bold text-on-surface hover:bg-surface-container transition-colors">Edit Config & Harga</button>
            </div>
        </div>
        """
    )
    
    # 6. admin_users_roles.html
    generate_html(
        "admin_users_roles.html",
        "Users & Roles - Admin - HealthSync Pro",
        "users",
        {"title": "User Management", "subtitle": "Kelola akun pengguna, reset password, dan tetapkan role khusus."},
        """
        <div class="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col h-[700px]">
            <div class="p-6 border-b border-outline-variant bg-surface-bright flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="flex gap-3 w-full md:w-auto">
                    <div class="relative flex-1 md:w-64">
                        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                        <input type="text" placeholder="Cari nama atau email..." class="w-full h-10 pl-10 pr-4 bg-surface border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                    </div>
                    <select class="h-10 px-3 bg-surface border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-primary">
                        <option>Semua Role</option>
                        <option>User</option>
                        <option>Admin</option>
                        <option>Medical Reviewer</option>
                    </select>
                    <select class="h-10 px-3 bg-surface border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-primary">
                        <option>Semua Plan</option>
                        <option>Free</option>
                        <option>Premium</option>
                    </select>
                </div>
                <button class="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm">
                    <span class="material-symbols-outlined text-[18px]">person_add</span> Tambah User
                </button>
            </div>
            
            <div class="overflow-x-auto flex-1 bg-surface-container-lowest">
                <table class="w-full text-left border-collapse">
                    <thead class="sticky top-0 bg-surface-container-low shadow-[0_1px_0_var(--color-outline-variant)]">
                        <tr class="text-on-surface-variant text-xs uppercase tracking-wider">
                            <th class="px-6 py-4 font-bold">User Info</th>
                            <th class="px-6 py-4 font-bold">Role</th>
                            <th class="px-6 py-4 font-bold">Plan</th>
                            <th class="px-6 py-4 font-bold">Terakhir Login</th>
                            <th class="px-6 py-4 font-bold text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-outline-variant text-sm">
                        <!-- User 1 -->
                        <tr class="hover:bg-surface-container-low/30 transition-colors">
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm">AS</div>
                                    <div>
                                        <div class="font-bold text-on-surface">Andi Saputra</div>
                                        <div class="text-xs text-on-surface-variant">andi.saputra@email.com</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="bg-surface-container px-2.5 py-1 rounded-md text-xs font-semibold text-on-surface border border-outline-variant">User</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="inline-flex items-center gap-1 bg-tertiary-container/10 text-tertiary-container border border-tertiary-container/20 px-2 py-0.5 rounded text-xs font-bold"><span class="material-symbols-outlined text-[12px]">star</span> Premium</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-on-surface-variant text-xs">
                                Hari ini, 10:45
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right">
                                <button class="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded transition-colors" title="Edit Role"><span class="material-symbols-outlined text-[20px]">manage_accounts</span></button>
                                <button class="p-1.5 text-on-surface-variant hover:text-status-critical hover:bg-status-critical/10 rounded transition-colors ml-1" title="Blokir User"><span class="material-symbols-outlined text-[20px]">block</span></button>
                            </td>
                        </tr>
                        <!-- User 2 -->
                        <tr class="hover:bg-surface-container-low/30 transition-colors">
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-sm">DR</div>
                                    <div>
                                        <div class="font-bold text-on-surface flex items-center gap-1.5">Dr. Ratna Sari <span class="material-symbols-outlined text-[14px] text-primary" title="Verified">verified</span></div>
                                        <div class="text-xs text-on-surface-variant">ratna.med@hl.id</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="bg-primary/10 text-primary px-2.5 py-1 rounded-md text-xs font-bold border border-primary/20">Medical Reviewer</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="text-on-surface-variant text-xs font-semibold">Free</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-on-surface-variant text-xs">
                                Kemarin, 16:20
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right">
                                <button class="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded transition-colors" title="Edit Role"><span class="material-symbols-outlined text-[20px]">manage_accounts</span></button>
                                <button class="p-1.5 text-on-surface-variant hover:text-status-critical hover:bg-status-critical/10 rounded transition-colors ml-1" title="Blokir User"><span class="material-symbols-outlined text-[20px]">block</span></button>
                            </td>
                        </tr>
                        <!-- User 3 -->
                        <tr class="hover:bg-surface-container-low/30 transition-colors bg-surface-container-low/30">
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full bg-status-critical/10 text-status-critical flex items-center justify-center font-bold text-sm">BP</div>
                                    <div>
                                        <div class="font-bold text-on-surface line-through opacity-70">Budi Pratama</div>
                                        <div class="text-xs text-status-critical">Banned Account</div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="bg-surface-container px-2.5 py-1 rounded-md text-xs font-semibold text-on-surface border border-outline-variant opacity-70">User</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="text-on-surface-variant text-xs font-semibold opacity-70">Free</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-on-surface-variant text-xs opacity-70">
                                12 Mei 2026
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-right">
                                <button class="p-1.5 text-on-surface-variant hover:text-status-normal hover:bg-status-normal/10 rounded transition-colors" title="Unblock User"><span class="material-symbols-outlined text-[20px]">how_to_reg</span></button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="p-4 border-t border-outline-variant flex justify-between items-center text-sm bg-surface-bright">
                <span class="text-on-surface-variant">Menampilkan 1-3 dari 1,284 users</span>
                <div class="flex gap-2">
                    <button class="px-3 py-1.5 border border-outline-variant rounded-md text-on-surface-variant hover:bg-surface-container disabled:opacity-50" disabled>Sebelumnya</button>
                    <button class="px-3 py-1.5 border border-outline-variant rounded-md text-on-surface hover:bg-surface-container font-semibold">Selanjutnya</button>
                </div>
            </div>
        </div>
        """
    )
    
    # 7. education_card_modal.html and premium_upgrade.html for regular users
    # These should use the user app layout, but maybe they are standalone mockups?
    # I'll create them as full-page standalone views so the user can see them easily.
    
    generate_html(
        "education_card_modal.html",
        "Education Insight - HealthSync Pro",
        "dashboard",
        {"title": "Mengenal Hipertensi", "subtitle": "Informasi medis yang divalidasi oleh dokter spesialis."},
        """
        <div class="max-w-2xl mx-auto bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xl overflow-hidden mt-8">
            <div class="h-48 bg-primary-container relative overflow-hidden">
                <div class="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIj48L3JlY3Q+CjxwYXRoIGQ9Ik0wIDBMOCA4Wk04IDBMMCA4WiIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjEiPjwvcGF0aD4KPC9zdmc+')]"></div>
                <div class="absolute inset-0 flex flex-col justify-end p-8 bg-gradient-to-t from-primary-container/90 to-transparent text-on-primary">
                    <span class="bg-on-primary/20 backdrop-blur-sm border border-on-primary/30 w-fit px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">Kesehatan Jantung</span>
                    <h2 class="text-3xl font-bold leading-tight">Tekanan Darah Tinggi: The Silent Killer</h2>
                </div>
            </div>
            
            <div class="p-8 space-y-6">
                <div class="flex items-center gap-3 p-4 bg-surface-bright rounded-xl border border-outline-variant">
                    <span class="material-symbols-outlined text-primary text-[28px]">verified</span>
                    <div>
                        <p class="text-sm font-bold text-on-surface">Divalidasi secara medis</p>
                        <p class="text-xs text-on-surface-variant">Terakhir diperbarui: 12 Juni 2026 oleh Dr. Ratna Sari, Sp.PD</p>
                    </div>
                </div>

                <div class="prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-on-surface prose-p:text-on-surface-variant prose-p:leading-relaxed">
                    <h3 class="text-lg font-bold text-on-surface mb-2">Apa itu Hipertensi?</h3>
                    <p class="text-on-surface-variant leading-relaxed mb-4">Hipertensi atau tekanan darah tinggi sering disebut "silent killer" karena pada sebagian besar kasus tidak menunjukkan gejala yang jelas, namun secara perlahan merusak organ vital seperti jantung, otak, dan ginjal.</p>
                    
                    <h3 class="text-lg font-bold text-on-surface mb-2 mt-6">Kategori Tekanan Darah</h3>
                    <ul class="space-y-3 mb-6 bg-surface-container-low p-5 rounded-xl border border-outline-variant">
                        <li class="flex items-start gap-3">
                            <span class="w-3 h-3 rounded-full bg-status-normal mt-1.5 shrink-0"></span>
                            <div>
                                <strong class="text-on-surface">Normal:</strong> 
                                <span class="text-on-surface-variant">Di bawah 120/80 mmHg</span>
                            </div>
                        </li>
                        <li class="flex items-start gap-3">
                            <span class="w-3 h-3 rounded-full bg-status-warning mt-1.5 shrink-0"></span>
                            <div>
                                <strong class="text-on-surface">Pra-hipertensi (Elevated):</strong> 
                                <span class="text-on-surface-variant">Sistolik 120-129 dan diastolik < 80 mmHg</span>
                            </div>
                        </li>
                        <li class="flex items-start gap-3">
                            <span class="w-3 h-3 rounded-full bg-status-critical mt-1.5 shrink-0"></span>
                            <div>
                                <strong class="text-on-surface">Hipertensi Tahap 1:</strong> 
                                <span class="text-on-surface-variant">Sistolik 130-139 atau diastolik 80-89 mmHg</span>
                            </div>
                        </li>
                    </ul>

                    <h3 class="text-lg font-bold text-on-surface mb-2 mt-6">Tindakan Pencegahan</h3>
                    <p class="text-on-surface-variant leading-relaxed mb-4">Meskipun faktor genetik berperan, gaya hidup sehat sangat efektif menurunkan tekanan darah:</p>
                    <div class="grid grid-cols-2 gap-4 mt-4">
                        <div class="p-4 border border-outline-variant rounded-xl text-center flex flex-col items-center">
                            <span class="material-symbols-outlined text-[32px] text-primary mb-2">salt</span>
                            <span class="text-sm font-semibold text-on-surface">Kurangi Garam</span>
                        </div>
                        <div class="p-4 border border-outline-variant rounded-xl text-center flex flex-col items-center">
                            <span class="material-symbols-outlined text-[32px] text-primary mb-2">directions_run</span>
                            <span class="text-sm font-semibold text-on-surface">Aktif Bergerak</span>
                        </div>
                        <div class="p-4 border border-outline-variant rounded-xl text-center flex flex-col items-center">
                            <span class="material-symbols-outlined text-[32px] text-primary mb-2">monitor_weight</span>
                            <span class="text-sm font-semibold text-on-surface">Jaga Berat Badan</span>
                        </div>
                        <div class="p-4 border border-outline-variant rounded-xl text-center flex flex-col items-center">
                            <span class="material-symbols-outlined text-[32px] text-primary mb-2">self_improvement</span>
                            <span class="text-sm font-semibold text-on-surface">Kelola Stres</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="p-6 border-t border-outline-variant bg-surface-bright flex justify-between items-center">
                <button class="text-on-surface-variant font-semibold text-sm hover:text-on-surface transition-colors">Tutup</button>
                <button class="px-5 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm">Catat Tekanan Darah Sekarang</button>
            </div>
        </div>
        """
    )
    
    generate_html(
        "premium_upgrade.html",
        "Upgrade Premium - HealthSync Pro",
        "dashboard",
        {"title": "Tingkatkan Pengalaman Anda", "subtitle": "Dapatkan fitur AI pintar, tracking lengkap, dan akses keluarga dengan HealthSync Pro Premium."},
        """
        <div class="max-w-4xl mx-auto py-8">
            <div class="text-center mb-12">
                <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-tertiary-container/10 text-tertiary-container mb-6 shadow-sm border border-tertiary-container/20">
                    <span class="material-symbols-outlined text-[40px]">workspace_premium</span>
                </div>
                <h2 class="text-4xl font-extrabold text-on-surface mb-4">Pilih Paket Terbaik Untuk Anda</h2>
                <p class="text-lg text-on-surface-variant max-w-2xl mx-auto">Dari sekadar pencatat biasa menjadi asisten kesehatan pintar yang mendampingi Anda 24/7.</p>
            </div>
            
            <div class="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
                <!-- Free Plan -->
                <div class="bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 flex flex-col shadow-sm">
                    <h3 class="text-2xl font-bold text-on-surface mb-2">Basic</h3>
                    <p class="text-on-surface-variant text-sm mb-6 h-10">Pencatatan kesehatan esensial untuk personal.</p>
                    
                    <div class="text-4xl font-bold text-on-surface mb-8">Rp 0<span class="text-base font-normal text-on-surface-variant">/selamanya</span></div>
                    
                    <ul class="space-y-4 mb-8 flex-1">
                        <li class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-status-normal text-[20px]">check_circle</span>
                            <span class="text-sm text-on-surface">Pencatatan Metrik Dasar</span>
                        </li>
                        <li class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-status-normal text-[20px]">check_circle</span>
                            <span class="text-sm text-on-surface">Grafik Trend Sederhana</span>
                        </li>
                        <li class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-status-normal text-[20px]">check_circle</span>
                            <span class="text-sm text-on-surface">AI Vision Ekstraksi (5x/hari)</span>
                        </li>
                        <li class="flex items-start gap-3 opacity-50">
                            <span class="material-symbols-outlined text-outline text-[20px]">cancel</span>
                            <span class="text-sm text-on-surface-variant">AI Health Assistant & Memory</span>
                        </li>
                        <li class="flex items-start gap-3 opacity-50">
                            <span class="material-symbols-outlined text-outline text-[20px]">cancel</span>
                            <span class="text-sm text-on-surface-variant">Akses Caregiver / Keluarga</span>
                        </li>
                    </ul>
                    
                    <button class="w-full py-3.5 bg-surface-container text-on-surface-variant rounded-xl font-bold text-sm cursor-default" disabled>Paket Saat Ini</button>
                </div>

                <!-- Premium Plan -->
                <div class="bg-surface-container-lowest border-2 border-primary rounded-2xl p-8 flex flex-col shadow-xl relative transform md:-translate-y-4 bg-white">
                    <div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-on-primary text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider shadow-sm whitespace-nowrap">Paling Populer</div>
                    
                    <h3 class="text-2xl font-bold text-on-surface mb-2">Pro Premium</h3>
                    <p class="text-on-surface-variant text-sm mb-6 h-10">Kecerdasan buatan penuh untuk mengawasi kesehatan Anda.</p>
                    
                    <div class="text-4xl font-bold text-on-surface mb-2">Rp 49.000<span class="text-base font-normal text-on-surface-variant">/bln</span></div>
                    <p class="text-sm text-status-normal font-semibold mb-6">Atau hemat 23% dengan Rp 449.000/thn</p>
                    
                    <ul class="space-y-4 mb-8 flex-1">
                        <li class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                            <span class="text-sm font-semibold text-on-surface">Semua fitur Basic</span>
                        </li>
                        <li class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-primary text-[20px]">smart_toy</span>
                            <span class="text-sm font-semibold text-on-surface">AI Assistant Interaktif (200x)</span>
                        </li>
                        <li class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-primary text-[20px]">psychology</span>
                            <span class="text-sm font-semibold text-on-surface">AI Memory & Pola Personalisasi</span>
                        </li>
                        <li class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-primary text-[20px]">family_restroom</span>
                            <span class="text-sm font-semibold text-on-surface">Akses untuk 1 Caregiver</span>
                        </li>
                        <li class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-primary text-[20px]">document_scanner</span>
                            <span class="text-sm font-semibold text-on-surface">Unlimited AI Vision Scanner</span>
                        </li>
                    </ul>
                    
                    <button class="w-full py-3.5 bg-primary text-on-primary rounded-xl font-bold text-sm shadow-md hover:bg-primary/90 hover:shadow-lg transition-all transform hover:-translate-y-0.5">Mulai Uji Coba 7 Hari Gratis</button>
                    <p class="text-xs text-center text-on-surface-variant mt-4">Batalkan kapan saja. Bebas komitmen.</p>
                </div>
            </div>
        </div>
        """
    )

if __name__ == "__main__":
    main()
