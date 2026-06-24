import os

base_template = """<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>__TITLE__</title>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <!-- Material Symbols -->
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />

  <!-- Tailwind CSS via CDN -->
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['Inter', 'sans-serif'] },
          colors: {
            "primary": "#000000",
            "on-primary": "#ffffff",
            "primary-container": "#131b2e",
            "on-primary-container": "#7c839b",
            "primary-fixed": "#dae2fd",
            "primary-fixed-dim": "#bec6e0",
            "on-primary-fixed": "#131b2e",
            "on-primary-fixed-variant": "#3f465c",
            "secondary": "#505f76",
            "on-secondary": "#ffffff",
            "secondary-container": "#d0e1fb",
            "on-secondary-container": "#54647a",
            "secondary-fixed": "#d3e4fe",
            "secondary-fixed-dim": "#b7c8e1",
            "on-secondary-fixed": "#0b1c30",
            "on-secondary-fixed-variant": "#38485d",
            "tertiary": "#000000",
            "on-tertiary": "#ffffff",
            "tertiary-container": "#271901",
            "on-tertiary-container": "#98805d",
            "tertiary-fixed": "#fcdeb5",
            "tertiary-fixed-dim": "#dec29a",
            "on-tertiary-fixed": "#271901",
            "on-tertiary-fixed-variant": "#574425",
            "background": "#fcf8fa",
            "on-background": "#1b1b1d",
            "surface": "#fcf8fa",
            "surface-dim": "#dcd9db",
            "surface-bright": "#fcf8fa",
            "surface-container-lowest": "#ffffff",
            "surface-container-low": "#f6f3f5",
            "surface-container": "#f0edef",
            "surface-container-high": "#eae7e9",
            "surface-container-highest": "#e4e2e4",
            "on-surface": "#1b1b1d",
            "on-surface-variant": "#45464d",
            "surface-variant": "#e4e2e4",
            "surface-tint": "#565e74",
            "inverse-surface": "#303032",
            "inverse-on-surface": "#f3f0f2",
            "inverse-primary": "#bec6e0",
            "outline": "#76777d",
            "outline-variant": "#c6c6cd",
            "error": "#ba1a1a",
            "on-error": "#ffffff",
            "error-container": "#ffdad6",
            "on-error-container": "#93000a",
            "semantic-period-red": "#ba1a1a",
            "semantic-fertile-blue": "#0369a1",
            "semantic-fertile-purple": "#7c3aed",
            "semantic-safe-green": "#10b981",
            "semantic-warning-amber": "#f59e0b",
            "medical-blue": "#0061FF",
            "normal-green": "#10B981",
            "warning-amber": "#F59E0B",
            "critical-red": "#EF4444"
          }
        }
      }
    }
  </script>

  <style>
    body { font-family: 'Inter', sans-serif; }
    .material-symbols-outlined {
      font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
      user-select: none;
    }
    /* Sidebar scroll */
    .sidebar-scroll::-webkit-scrollbar { width: 4px; }
    .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
    .sidebar-scroll::-webkit-scrollbar-thumb { background: #c6c6cd; border-radius: 4px; }
  </style>
</head>

<body class="bg-background text-on-surface flex min-h-screen font-sans">

  <!-- ============================================================
       SIDEBAR
  ============================================================ -->
  <nav class="hidden lg:flex flex-col fixed left-0 top-0 h-full w-[280px] z-50 bg-surface-container-low border-r border-outline-variant">

    <!-- Brand -->
    <div class="p-5 border-b border-outline-variant">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-inverse-primary text-[20px]" style="font-variation-settings:'FILL' 1">health_and_safety</span>
        </div>
        <div>
          <h1 class="text-[17px] font-bold text-on-surface leading-tight">HealthSync Pro</h1>
          <p class="text-[11px] text-on-surface-variant">Enterprise Health</p>
        </div>
      </div>
      <!-- Admin mode badge -->
      <div class="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
        <span class="material-symbols-outlined text-[15px] text-primary">shield</span>
        <span class="text-[11px] font-bold text-primary">Mode: Administrator</span>
      </div>
    </div>

    <!-- Scrollable nav -->
    <div class="flex-1 overflow-y-auto py-3 sidebar-scroll">
      <nav class="px-3 space-y-0.5">

        <!-- ===== USER NAV ===== -->
        <p class="px-3 pt-1 pb-1 text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Menu Utama</p>

        <a href="#" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all">
          <span class="material-symbols-outlined text-[20px]">dashboard</span>Dashboard
        </a>

        <!-- ============ ADMIN AREA SEPARATOR ============ -->
        <div class="pt-4 pb-2">
          <div class="mx-3 flex items-center gap-2">
            <div class="flex-1 h-px bg-outline-variant"></div>
            <div class="flex items-center gap-1.5 bg-primary text-on-primary rounded-full px-2.5 py-0.5">
              <span class="material-symbols-outlined text-[11px]">admin_panel_settings</span>
              <span class="text-[10px] font-bold uppercase tracking-widest">Admin Area</span>
            </div>
            <div class="flex-1 h-px bg-outline-variant"></div>
          </div>
        </div>

        <a href="admin_dashboard.html" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all">
          <span class="material-symbols-outlined text-[20px]">dashboard_customize</span>Admin Dashboard
        </a>
        <a href="admin_users_roles.html" class="__NAV_USERS__">
          <span class="material-symbols-outlined text-[20px]">manage_accounts</span>Users
        </a>
        <a href="admin_plans_subscriptions.html" class="__NAV_PLANS__">
          <span class="material-symbols-outlined text-[20px]">workspace_premium</span>Plans &amp; Features
        </a>
        <a href="admin_ai_config.html" class="__NAV_AI__">
          <span class="material-symbols-outlined text-[20px]">model_training</span>AI Configuration
        </a>
        <a href="admin_system_config.html" class="__NAV_SYSTEM__">
          <span class="material-symbols-outlined text-[20px]">tune</span>System Config
        </a>
        <a href="admin_audit_logs.html" class="__NAV_AUDIT__">
          <span class="material-symbols-outlined text-[20px]">fact_check</span>Audit Logs
        </a>

      </nav>
    </div>
  </nav>

  <!-- ============================================================
       MAIN CONTENT
  ============================================================ -->
  <main class="flex-1 lg:ml-[280px] flex flex-col min-h-screen">

    <!-- TOP BAR -->
    <header class="sticky top-0 z-40 flex items-center justify-between h-16 px-6 bg-surface border-b border-outline-variant">
      <!-- Search -->
      <div class="hidden lg:flex items-center bg-surface-container-low rounded-full px-4 py-2 border border-outline-variant w-80">
        <span class="material-symbols-outlined text-on-surface-variant mr-2 text-[18px]">search</span>
        <input class="bg-transparent border-none outline-none w-full text-sm text-on-surface placeholder:text-on-surface-variant" placeholder="Cari..." />
      </div>
      <!-- Right -->
      <div class="flex items-center gap-3 ml-auto">
        <div class="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-xs font-bold text-inverse-primary">SA</div>
      </div>
    </header>

    <!-- PAGE CONTENT -->
    <div class="flex-1 p-6 bg-background pb-24 lg:pb-8">

      <!-- ===== PAGE HEADER ===== -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold text-on-surface leading-tight">__PAGE_TITLE__</h1>
          <p class="text-sm text-on-surface-variant mt-0.5">__PAGE_SUBTITLE__</p>
        </div>
      </div>

      <!-- MAIN PAGE STUFF -->
      __PAGE_CONTENT__

    </div>
  </main>
</body>
</html>
"""

pages = {
    "admin_users_roles.html": {
        "title": "Users & Roles - Admin - HealthSync Pro",
        "page_title": "Manajemen User & Role",
        "page_subtitle": "Kelola pengguna, assign role, dan pantau status subscription",
        "nav_active": "users",
        "page_content": """
        <!-- Filter & Search -->
        <div class="flex gap-4 mb-6">
            <input type="text" placeholder="Cari user berdasarkan nama, email..." class="flex-1 rounded-lg border-outline-variant bg-surface-container-lowest text-sm">
            <select class="rounded-lg border-outline-variant bg-surface-container-lowest text-sm"><option>Semua Role</option></select>
            <select class="rounded-lg border-outline-variant bg-surface-container-lowest text-sm"><option>Semua Plan</option></select>
        </div>
        <!-- Table -->
        <div class="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <table class="w-full text-left text-sm">
                <thead class="bg-surface-container border-b border-outline-variant text-on-surface-variant">
                    <tr><th class="p-4">User</th><th class="p-4">Role</th><th class="p-4">Plan</th><th class="p-4">Status</th><th class="p-4">Aksi</th></tr>
                </thead>
                <tbody class="divide-y divide-outline-variant">
                    <tr class="hover:bg-surface-container-low">
                        <td class="p-4">Andi Saputra<br><span class="text-xs text-on-surface-variant">andi@gmail.com</span></td>
                        <td class="p-4"><span class="bg-primary/10 text-primary px-2 py-1 rounded text-xs">user</span></td>
                        <td class="p-4"><span class="bg-semantic-fertile-purple/10 text-semantic-fertile-purple px-2 py-1 rounded text-xs">Premium Yearly</span></td>
                        <td class="p-4"><span class="text-normal-green font-bold">Aktif</span></td>
                        <td class="p-4"><button class="text-medical-blue hover:underline">Edit Role</button></td>
                    </tr>
                    <tr class="hover:bg-surface-container-low">
                        <td class="p-4">Citra Dewi<br><span class="text-xs text-on-surface-variant">citra@dev.com</span></td>
                        <td class="p-4"><span class="bg-medical-blue/10 text-medical-blue px-2 py-1 rounded text-xs">medicalReviewer</span></td>
                        <td class="p-4">-</td>
                        <td class="p-4"><span class="text-normal-green font-bold">Aktif</span></td>
                        <td class="p-4"><button class="text-medical-blue hover:underline">Edit Role</button></td>
                    </tr>
                </tbody>
            </table>
        </div>
        """
    },
    "admin_plans_subscriptions.html": {
        "title": "Plans & Subscriptions - Admin - HealthSync Pro",
        "page_title": "Plans & Subscriptions",
        "page_subtitle": "Kelola plan berlangganan, fitur, harga, dan quota",
        "nav_active": "plans",
        "page_content": """
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Free Plan -->
            <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <div class="text-xs font-bold text-outline-variant mb-2">FREE</div>
                <div class="text-2xl font-bold mb-4">Rp 0 <span class="text-sm font-normal text-on-surface-variant">/ bulan</span></div>
                <ul class="text-sm space-y-2 mb-6">
                    <li>✅ Catat pengukuran kesehatan</li>
                    <li>✅ Riwayat 7 hari</li>
                    <li>❌ AI Assistant</li>
                </ul>
                <button class="w-full bg-surface-container py-2 rounded-lg text-sm font-bold">Edit Plan</button>
            </div>
            <!-- Premium Plan -->
            <div class="bg-surface-container-lowest border border-primary rounded-xl p-6 shadow-md relative">
                <div class="absolute top-0 right-0 bg-primary text-on-primary text-[10px] font-bold px-2 py-1 rounded-bl-lg rounded-tr-xl">POPULER</div>
                <div class="text-xs font-bold text-semantic-fertile-purple mb-2">PREMIUM MONTHLY</div>
                <div class="text-2xl font-bold mb-4">Rp 49.000 <span class="text-sm font-normal text-on-surface-variant">/ bulan</span></div>
                <ul class="text-sm space-y-2 mb-6">
                    <li>✅ Semua fitur Free</li>
                    <li>✅ AI Assistant 50 pesan/bulan</li>
                    <li>✅ Laporan Mingguan</li>
                </ul>
                <button class="w-full bg-primary text-on-primary py-2 rounded-lg text-sm font-bold">Edit Plan</button>
            </div>
        </div>
        """
    },
    "admin_ai_config.html": {
        "title": "AI Configuration - Admin - HealthSync Pro",
        "page_title": "Konfigurasi AI",
        "page_subtitle": "Kelola model, fallback, timeout, disclaimer, dan AI Memory.",
        "nav_active": "ai",
        "page_content": """
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <h2 class="font-bold mb-4">Model & Endpoint</h2>
                <label class="block text-sm mb-1">Default Model</label>
                <select class="w-full rounded-lg border-outline-variant mb-4"><option>claude-3.5-sonnet</option></select>
                <label class="block text-sm mb-1">Temperature (0.3)</label>
                <input type="range" class="w-full mb-4">
                <button class="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm">Simpan</button>
            </div>
            <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
                <h2 class="font-bold mb-4">API Keys / Secrets</h2>
                <div class="mb-4">
                    <label class="block text-sm mb-1">Anthropic API Key</label>
                    <div class="flex gap-2">
                        <input type="password" value="••••••••••••••••" disabled class="flex-1 rounded-lg border-outline-variant bg-surface-container">
                        <button class="bg-surface-container px-4 py-2 rounded-lg text-sm">Update</button>
                    </div>
                </div>
            </div>
        </div>
        """
    },
    "admin_system_config.html": {
        "title": "System Config - Admin - HealthSync Pro",
        "page_title": "System Configuration",
        "page_subtitle": "Konfigurasi sistem dinamis tanpa perlu deploy ulang. Semua perubahan dicatat di audit log.",
        "nav_active": "system",
        "page_content": """
        <div class="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <table class="w-full text-left text-sm">
                <thead class="bg-surface-container border-b border-outline-variant text-on-surface-variant">
                    <tr><th class="p-4">Config Key</th><th class="p-4">Nilai</th><th class="p-4">Deskripsi</th><th class="p-4">Aksi</th></tr>
                </thead>
                <tbody class="divide-y divide-outline-variant">
                    <tr class="hover:bg-surface-container-low">
                        <td class="p-4 font-mono text-xs">aiExtractTimeoutMs</td>
                        <td class="p-4">7000</td>
                        <td class="p-4 text-on-surface-variant">Timeout AI Vision (ms)</td>
                        <td class="p-4"><button class="text-medical-blue hover:underline">Edit</button></td>
                    </tr>
                    <tr class="hover:bg-surface-container-low">
                        <td class="p-4 font-mono text-xs">telegramBotActive</td>
                        <td class="p-4"><span class="bg-normal-green/10 text-normal-green px-2 py-1 rounded">true</span></td>
                        <td class="p-4 text-on-surface-variant">Toggle Telegram bot</td>
                        <td class="p-4"><button class="text-medical-blue hover:underline">Edit</button></td>
                    </tr>
                </tbody>
            </table>
        </div>
        """
    },
    "admin_audit_logs.html": {
        "title": "Audit Logs - Admin - HealthSync Pro",
        "page_title": "Audit Logs",
        "page_subtitle": "Catatan lengkap semua aksi sensitif sistem. Data ini tidak dapat diubah atau dihapus.",
        "nav_active": "audit",
        "page_content": """
        <div class="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <table class="w-full text-left text-sm font-mono text-xs">
                <thead class="bg-surface-container border-b border-outline-variant text-on-surface-variant text-sm font-sans">
                    <tr><th class="p-4">Waktu</th><th class="p-4">Aktor</th><th class="p-4">Aksi</th><th class="p-4">Target</th><th class="p-4">Severity</th></tr>
                </thead>
                <tbody class="divide-y divide-outline-variant">
                    <tr class="hover:bg-surface-container-low">
                        <td class="p-4">14:28:03</td>
                        <td class="p-4 text-primary font-sans">admin@hl.id</td>
                        <td class="p-4 text-medical-blue font-bold">UPDATE_SYSTEM_CONFIG</td>
                        <td class="p-4">aiExtractTimeoutMs</td>
                        <td class="p-4"><span class="bg-secondary/10 text-secondary px-2 py-1 rounded font-sans">info</span></td>
                    </tr>
                    <tr class="hover:bg-surface-container-low">
                        <td class="p-4">10:45:02</td>
                        <td class="p-4 text-primary font-sans">system</td>
                        <td class="p-4 text-critical-red font-bold">SECURITY_EVENT</td>
                        <td class="p-4">login_attempt</td>
                        <td class="p-4"><span class="bg-critical-red/10 text-critical-red px-2 py-1 rounded font-sans font-bold">critical</span></td>
                    </tr>
                </tbody>
            </table>
        </div>
        """
    },
    "premium_upgrade.html": {
        "title": "Upgrade ke Premium - HealthSync Pro",
        "page_title": "Upgrade ke HealthSync Pro Premium",
        "page_subtitle": "Dari pencatatan biasa menjadi pendamping kesehatan harian yang cerdas dan personal.",
        "nav_active": "none",
        "page_content": """
        <div class="flex flex-col items-center py-10">
            <span class="material-symbols-outlined text-[64px] text-semantic-fertile-purple mb-4" style="font-variation-settings:'FILL' 1">workspace_premium</span>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full mt-10">
                <div class="bg-surface-container border border-outline-variant rounded-xl p-8 text-center">
                    <h3 class="font-bold text-xl mb-2">Free</h3>
                    <p class="text-3xl font-bold mb-6">Rp 0</p>
                    <button class="w-full bg-outline-variant text-on-surface py-3 rounded-lg font-bold mb-6" disabled>Paket Saat Ini</button>
                </div>
                <div class="bg-surface-container-lowest border-2 border-semantic-fertile-purple rounded-xl p-8 text-center transform scale-105 shadow-xl relative">
                    <div class="absolute -top-4 left-1/2 -translate-x-1/2 bg-semantic-fertile-purple text-white text-xs font-bold px-4 py-1 rounded-full">PALING POPULER</div>
                    <h3 class="font-bold text-xl mb-2">Yearly Premium</h3>
                    <p class="text-3xl font-bold mb-6">Rp 449.000<span class="text-sm font-normal">/thn</span></p>
                    <button class="w-full bg-semantic-fertile-purple text-white py-3 rounded-lg font-bold mb-6 shadow-lg hover:bg-semantic-fertile-purple/90">Pilih Tahunan</button>
                    <ul class="text-sm text-left space-y-3">
                        <li>✅ AI Assistant (200 msg/bln)</li>
                        <li>✅ Unlimited AI Vision</li>
                        <li>✅ Cycle Tracking & AI Memory</li>
                    </ul>
                </div>
                <div class="bg-surface-container border border-outline-variant rounded-xl p-8 text-center">
                    <h3 class="font-bold text-xl mb-2">Monthly Premium</h3>
                    <p class="text-3xl font-bold mb-6">Rp 49.000<span class="text-sm font-normal">/bln</span></p>
                    <button class="w-full bg-primary text-on-primary py-3 rounded-lg font-bold mb-6 hover:bg-primary/90">Pilih Bulanan</button>
                </div>
            </div>
        </div>
        """
    },
    "education_card_modal.html": {
        "title": "Education Cards - HealthSync Pro",
        "page_title": "Education Cards",
        "page_subtitle": "Preview modal untuk kartu edukasi kesehatan.",
        "nav_active": "none",
        "page_content": """
        <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div class="bg-surface-container-lowest rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
                <div class="sticky top-0 bg-surface-container-lowest p-6 border-b border-outline-variant flex items-start justify-between z-10">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-full bg-medical-blue/10 flex items-center justify-center">
                            <span class="material-symbols-outlined text-medical-blue text-[24px]">monitor_heart</span>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-primary">Tekanan Darah</h2>
                            <p class="text-sm text-on-surface-variant">Panduan Pengukuran & Interpretasi</p>
                        </div>
                    </div>
                    <button class="p-2 hover:bg-surface-container rounded-full"><span class="material-symbols-outlined">close</span></button>
                </div>
                <div class="p-6 space-y-6">
                    <div>
                        <h3 class="font-bold mb-2">Apa itu Tekanan Darah?</h3>
                        <p class="text-sm text-on-surface-variant">Tekanan darah adalah gaya yang diberikan darah pada dinding pembuluh darah. Diukur dalam dua angka: Sistolik (saat jantung memompa) / Diastolik (saat jantung istirahat).</p>
                    </div>
                    <div>
                        <h3 class="font-bold mb-2">Angka Normal & Kategori</h3>
                        <table class="w-full text-left text-sm border border-outline-variant rounded-lg overflow-hidden">
                            <thead class="bg-surface-container">
                                <tr><th class="p-2">Kategori</th><th class="p-2">Sistolik</th><th class="p-2">Diastolik</th></tr>
                            </thead>
                            <tbody class="divide-y divide-outline-variant">
                                <tr><td class="p-2 text-normal-green font-bold">Normal</td><td class="p-2">&lt; 120</td><td class="p-2">&lt; 80</td></tr>
                                <tr><td class="p-2 text-critical-red font-bold">Krisis Hipertensi</td><td class="p-2">&gt; 180</td><td class="p-2">&gt; 120</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        """
    }
}

active_class = "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold text-primary bg-primary/8 border-l-4 border-primary transition-all"
inactive_class = "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all"

out_dir = r"c:\codex\health\docs\sprint5\Frontend"

for filename, data in pages.items():
    nav_users_cls = active_class if data["nav_active"] == "users" else inactive_class
    nav_plans_cls = active_class if data["nav_active"] == "plans" else inactive_class
    nav_ai_cls = active_class if data["nav_active"] == "ai" else inactive_class
    nav_system_cls = active_class if data["nav_active"] == "system" else inactive_class
    nav_audit_cls = active_class if data["nav_active"] == "audit" else inactive_class
    
    html = base_template.replace("__TITLE__", data["title"])
    html = html.replace("__PAGE_TITLE__", data["page_title"])
    html = html.replace("__PAGE_SUBTITLE__", data["page_subtitle"])
    html = html.replace("__PAGE_CONTENT__", data["page_content"])
    html = html.replace("__NAV_USERS__", nav_users_cls)
    html = html.replace("__NAV_PLANS__", nav_plans_cls)
    html = html.replace("__NAV_AI__", nav_ai_cls)
    html = html.replace("__NAV_SYSTEM__", nav_system_cls)
    html = html.replace("__NAV_AUDIT__", nav_audit_cls)
    
    with open(os.path.join(out_dir, filename), "w", encoding="utf-8") as f:
        f.write(html)
        
print("HTML generated successfully.")
