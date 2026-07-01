# PRD — iSehat Public Website, Landing Page, Blog & Growth Funnel

```text
Product: iSehat Public Website + Blog
Domain: isehat.biz.id
App Domain: app.isehat.biz.id
Backend/API Domain: api.isehat.biz.id, if separated
Document Type: Product Requirements Document (PRD)
Version: 2.0 — Production Capability-Aligned
Status: Ready for AI Agent Execution
Primary Scope: Public marketing website, landing page, blog, SEO, content funnel, lead capture, brand/trust layer
App Feature Coverage: Must represent existing iSehat / HL Health Companion production capabilities and Sprint 5 roadmap without creating fake claims
Out of Scope: Main app implementation, user dashboard implementation, D1 app schema changes, R2 upload flow, AI medical chatbot, diagnosis, consultation booking, payment backend
```

---

## 1. Executive Summary

This PRD defines the public website project for `isehat.biz.id`. The site is not the health app itself. It is the public-facing product, brand, education, SEO, and sales layer for the existing iSehat / HL Health Companion SaaS.

The public site must:

```text
1. Explain iSehat clearly as a daily health companion SaaS.
2. Communicate all production app capabilities accurately.
3. Convert visitors into free signups at app.isehat.biz.id.
4. Build trust through education, safety, privacy, and transparent medical disclaimers.
5. Support SEO growth via a static MDX blog.
6. Support SaaS sales through pricing, feature comparison, use-case pages, and conversion CTAs.
7. Provide a modern enterprise SaaS UI with light, dark, and warm themes.
8. Avoid medical overclaiming, AI doctor claims, diagnosis claims, prescription claims, and emergency authority claims.
```

The public site must be implemented as a separate deployable project from the health app.

Recommended monorepo placement:

```text
project-root/
├── web/       → existing app.isehat.biz.id project
├── worker/    → existing API/backend project
└── site/      → new isehat.biz.id public website + blog project
```

---

## 2. Background and Source Product Capabilities

The public website must reflect the production app features and roadmap already defined in the iSehat / HL Health Companion PRDs and user stories.

Production/core app capabilities to represent on the public website:

```text
1. Multi-user account and onboarding.
2. Health profile: display name, sex, birth date, height, timezone, theme/accessibility mode.
3. Measurement checklist for multiple health devices and metrics.
4. Photo/upload attachment for supported health devices.
5. Client-side image compression.
6. Final watermarked attachment storage in app flow.
7. AI Vision extraction with 5-second timeout and manual fallback.
8. Manual override before saving AI-read values.
9. Physical range validation and rule-based status interpretation.
10. BMI auto calculation from height and weight.
11. Measurement session storage and history.
12. D1 app database and R2 evidence storage in app backend.
13. Telegram notification after submit.
14. Dashboard Today.
15. Weekly and monthly dashboards.
16. Daily, weekly, and monthly reports.
17. Doctor-ready PDF report.
18. Knowledge base for supported health devices.
19. Family/caregiver linking and role permission.
20. Emergency alert based on deterministic rule severity.
21. Medication tracker.
22. Reminder and browser notification foundation.
23. Fasting timer.
24. Gamification, streak, and badge with safety guard.
25. Pattern detection / correlation insight, not causal diagnosis.
26. Senior/accessibility mode.
27. Installable PWA and offline shell.
28. CSV/export and data deletion request flow.
29. Sprint 5 commercial foundation: RBAC, plans, entitlement, quota, admin, audit, config.
30. Sprint 5A Daily Health Hub, education layer, symptom log, red flag deterministic guardrail.
31. Sprint 5B hydration tracker.
32. Sprint 5C AI Clinical Infrastructure and Vectorize foundation.
33. Sprint 5D cycle tracking with privacy and contraception guardrail.
34. Sprint 5E Telegram inline hydration quick action.
35. Sprint 6A AI Clinical Copilot foundation: Safety Runtime v2 (13 detectors), operating mode governance, model router.
36. Sprint 6B AI Platform: AI Gateway (9router), Vectorize hardening, KV namespace.
37. Sprint 6C Vectorize memory pipeline: per-user namespace, 500 vector limit, upsert/query flows.
38. Sprint 6D Context package assembly: clinical context, metric history, active medications, symptom log.
39. Sprint 6E Web runtime: clinical chat UI, emergency card, first aid card, AI session management.
40. Sprint 6F Emergency engine: emergency guidance (template-only, no LLM freeform), 6 data retention cron jobs.
41. Sprint 6G WhatsApp AI: health chat via WhatsApp, OTP, emergency guidance delivery, unlinked retention 30 days.
42. Sprint 6H Governance: 16 admin governance endpoints, AI audit logs, operating mode management, medical reviewer workflow.
43. Sprint 6I Hardening + release gate: 65 safety tests, 100 prompt injection tests, 100 red flag tests, eval dataset, closed beta.
```

The public site must not expose internal credentials, tokens, chat IDs, database IDs, private production identifiers, or sensitive operational details.

---

## 3. Product Positioning

### 3.1 Public Positioning

```text
iSehat adalah aplikasi pendamping kesehatan harian untuk mencatat, memahami, memantau, dan membagikan data kesehatan dari alat kesehatan rumahan secara aman, edukatif, dan mudah digunakan.
```

### 3.2 Core Promise

```text
Catat kesehatan harian. Pahami tren. Siapkan laporan untuk dokter.
```

### 3.3 Main Value Proposition

```text
iSehat membantu pengguna mencatat hasil tensi, gula darah, SpO2, berat badan, suhu tubuh, obat, hidrasi, puasa, keluhan harian, dan data keluarga dalam satu sistem yang rapi, aman, dan siap dibawa ke dokter.
```

### 3.4 Primary Audience

```text
1. Pengguna rumahan yang memiliki tensimeter, oximeter, alat gula darah, termometer, atau timbangan.
2. Keluarga yang ingin memantau orang tua dari jarak jauh.
3. Caregiver informal.
4. Pengguna dengan kebutuhan pencatatan tekanan darah, gula darah, SpO2, obat, hidrasi, berat badan, dan keluhan harian.
5. Pengguna yang ingin membuat laporan 30 hari untuk konsultasi dokter.
```

### 3.5 Secondary Audience

```text
1. Dokter/tenaga kesehatan yang menerima laporan dari pasien.
2. Klinik kecil.
3. Apotek.
4. Toko alat kesehatan.
5. Komunitas hipertensi/diabetes/wellness.
6. Potential B2B and partnership stakeholders.
```

---

## 4. Non-Negotiable Marketing and Safety Rules

### 4.1 Rule-First, AI-Assisted Messaging

The public site must clearly state that iSehat uses rule-based interpretation and AI assistance, not AI-first diagnosis.

Allowed copy:

```text
AI membantu membaca angka dari foto alat kesehatan.
User tetap memverifikasi angka sebelum disimpan.
Status kesehatan ditentukan oleh rule/aturan yang terstruktur.
AI dapat membantu membuat insight/narasi aman.
```

Not allowed copy:

```text
AI mendiagnosis penyakit Anda.
AI dokter pribadi.
AI menentukan kondisi darurat.
AI memberikan resep obat.
AI mengatur dosis obat.
AI menggantikan dokter.
```

### 4.2 Medical Safety

The public site must include clear disclaimer on relevant pages:

```text
iSehat bukan pengganti dokter, bukan alat diagnosis, dan tidak memberikan resep obat. Informasi di website ini hanya untuk edukasi umum dan pendamping pencatatan. Jika mengalami gejala berat seperti nyeri dada, sesak napas, pingsan, kelemahan satu sisi tubuh, kebingungan berat, atau kondisi darurat lainnya, segera cari bantuan medis.
```

### 4.3 Privacy and Consent

The public site must communicate:

```text
1. Data kesehatan adalah data sensitif.
2. Caregiver/family monitoring harus berbasis consent.
3. Public website tidak mengumpulkan data kesehatan personal.
4. Contact/newsletter form tidak boleh meminta data medis sensitif.
5. App data lives in the protected app environment, not in the public marketing site.
```

### 4.4 No Fake Trust

The site must not invent:

```text
1. Fake doctors.
2. Fake medical reviewers.
3. Fake testimonials.
4. Fake certifications.
5. Fake hospital/clinic partnerships.
6. Fake user numbers.
```

If social proof is unavailable, use neutral trust statements and product screenshots/mockups.

---

## 5. Project Architecture

### 5.1 Recommended Tech Stack

```text
Framework: Astro
Language: TypeScript
Styling: Tailwind CSS + CSS variables
Content: MDX static files
Search: client-side search using MiniSearch or Fuse.js
Icons: Lucide Icons
Deployment: Cloudflare Pages
Database: none for MVP
Storage: none for MVP
Analytics: optional Cloudflare Web Analytics or privacy-friendly analytics later
```

### 5.2 Why No D1/R2 for Public Site MVP

```text
1. Landing page and blog are static-first.
2. Articles are stored as MDX files in Git.
3. No user health data is collected.
4. No media upload CMS is required initially.
5. This reduces risk of mixing public content with sensitive app data.
```

Future D1/R2 may be added only if:

```text
D1: CMS, editorial workflow, comments, dynamic lead capture, content admin.
R2: large media library, lead magnet PDFs, CMS uploads.
```

### 5.3 Deployment Boundaries

```text
site/   → isehat.biz.id
web/    → app.isehat.biz.id
worker/ → api.isehat.biz.id or app worker backend
```

The site project must not import app backend code or app private env bindings.

---

## 6. Required Routes and Sitemap

### 6.1 Core Routes

| Route | Purpose | Priority |
|---|---|---|
| `/` | Main landing page | P0 |
| `/features` | Full feature overview | P0 |
| `/pricing` | SaaS pricing and plan comparison | P0 |
| `/blog` | Blog index | P0 |
| `/blog/[slug]` | Blog article detail | P0 |
| `/blog/category/[category]` | Category archive | P1 |
| `/use-cases/keluarga` | Family monitoring use case | P0 |
| `/use-cases/caregiver` | Caregiver use case | P1 |
| `/use-cases/tekanan-darah` | Blood pressure use case | P1 |
| `/use-cases/gula-darah` | Blood glucose use case | P1 |
| `/use-cases/laporan-dokter` | Doctor report use case | P1 |
| `/use-cases/ai-clinical-companion` | AI Clinical Copilot use case | P0 |
| `/use-cases/whatsapp-kesehatan` | WhatsApp AI health use case | P0 |
| `/about` | About iSehat | P1 |
| `/contact` | Contact / partnership / support direction | P1 |
| `/privacy` | Privacy policy | P0 |
| `/terms` | Terms of service | P0 |
| `/disclaimer` | Medical disclaimer | P0 |
| `/robots.txt` | Search engine rules | P0 |
| `/sitemap.xml` | Sitemap | P0 |

### 6.2 App CTA Destinations

```text
Signup CTA: https://app.isehat.biz.id/register
Login CTA:  https://app.isehat.biz.id/login
Dashboard CTA after login: https://app.isehat.biz.id/dashboard
```

---

## 7. Homepage PRD

### 7.1 Objective

The homepage must sell the SaaS product clearly, communicate trust and safety, and push visitors to sign up or explore feature/use-case pages.

### 7.2 Homepage Mandatory Section Order

```text
1. Header / navigation
2. Hero section
3. Trust indicators
4. Problem section
5. Product workflow section
6. Production capability preview section
7. Feature grid
8. Device and metric support section
9. Dashboard and report preview section
10. Family/caregiver section
11. Safety and medical disclaimer section
12. Pricing teaser
13. Blog/education preview
14. Newsletter/lead capture section
15. FAQ
16. Final CTA
17. Footer
```

### 7.3 Header Requirements

Header must include:

```text
Logo iSehat
Navigation: Fitur, Harga, Blog, Use Case, Tentang, Kontak
CTA: Masuk
CTA primary: Daftar Gratis
Theme toggle: Light, Dark, Warm
Mobile hamburger menu
Sticky behavior with background blur after scroll
```

### 7.4 Hero Section Requirements

Hero must include:

```text
Headline
Subheadline
Primary CTA
Secondary CTA
Trust microcopy
Dashboard mockup visual
Metric preview cards
Report preview mini card
```

Recommended headline:

```text
Catatan kesehatan harian yang rapi, mudah dipahami, dan siap dibawa ke dokter.
```

Recommended subheadline:

```text
iSehat membantu Anda mencatat hasil tensi, gula darah, SpO2, berat badan, obat, hidrasi, puasa, dan keluhan harian dalam satu dashboard keluarga yang aman.
```

Primary CTA:

```text
Mulai Gratis
```

Secondary CTA:

```text
Lihat Cara Kerja
```

Trust microcopy:

```text
Bukan pengganti dokter. AI hanya membantu. Anda tetap memverifikasi data sebelum disimpan.
```

### 7.5 Product Workflow Section

Must show this flow:

```text
1. Pilih jenis pengukuran.
2. Foto/upload alat atau input manual.
3. AI membantu membaca angka maksimal 5 detik.
4. User verifikasi dan edit angka.
5. Rule engine menampilkan status dan interpretasi.
6. Data tersimpan di dashboard.
7. Telegram/reminder/report membantu pemantauan.
```

### 7.6 Production Capability Preview Section

Must represent all main production capabilities grouped by category:

```text
Core Capture:
- Multi-user account
- Onboarding health profile
- Measurement checklist
- Photo/upload
- AI Vision extraction
- Manual override
- Validation
- Final watermarked evidence

Health Intelligence:
- Rule-based interpretation
- Real-time suggestion / popup interpretation
- Daily, weekly, monthly reports
- Comparison vs 3 days and 7 days
- AI report analysis with safety disclaimer
- Knowledge base

Monitoring and Family:
- Telegram after submit
- Emergency alert
- Family/caregiver link
- Caregiver dashboard
- Alert acknowledgement

Daily Companion:
- Medication tracker
- Reminder
- Browser notification
- Fasting timer
- Hydration tracker
- Daily symptom log
- Red flag guardrail

Advanced:
- Doctor-ready PDF 30 days
- Pattern detection / correlation insight
- Gamification / streak / badge
- Accessibility / senior mode
- PWA installable
- Offline shell
- Export data

Commercial / Admin:
- Free/Premium/Family plan
- Entitlement
- Usage quota
- Admin dashboard
- Audit log
- AI config governance

AI Clinical Companion (Sprint 6):
- AI Clinical Copilot (3 operating modes: standard, proactive, super aktif)
- 13-detector Safety Runtime v2
- Vectorize AI memory per-user (500 vectors)
- Emergency guidance engine (template-only, no LLM freeform)
- Operating mode governance by Super Admin
- Medical reviewer approval for mode changes
- Automatic medical disclaimer on every AI output

WhatsApp Integration (Sprint 6):
- AI health chat via WhatsApp
- Emergency guidance delivery via WhatsApp
- OTP and notifications via WhatsApp
- Unlinked session retention 30 days
```

### 7.7 Device and Metric Section

Must show supported devices and metrics:

```text
Devices:
- Oximeter
- Tensimeter
- Sinocare GCU or glucose/cholesterol/uric acid device
- Thermometer
- Body scale
- Manual input

Metrics:
- SpO2
- Heart rate
- Systolic
- Diastolic
- Blood pressure pulse
- Fasting glucose
- Post-meal glucose
- Total cholesterol
- Uric acid
- Body weight
- BMI
- Waist circumference
- Body temperature
- Sleep duration
- Hydration
- Medication
- Symptom log
- Fasting session
- Cycle tracking, eligible users only
```

### 7.8 Safety Section

Must include:

```text
Rule-first interpretation
Manual verification
No AI diagnosis final
No prescription
No medication dosage changes
Emergency/red flag handled by deterministic guardrail
Caregiver access with consent
Health data is sensitive
```

### 7.9 Pricing Teaser

Must include at least:

```text
Free
Premium Monthly
Premium 3-Month
Premium Yearly
Family Premium
```

If actual price is not final, display:

```text
Harga segera diumumkan
```

Do not invent prices unless provided.

---

## 8. Feature Page PRD

### 8.1 Objective

The feature page must detail the full product capabilities without overwhelming users.

### 8.2 Feature Categories

Feature page must group capabilities into:

```text
1. Catatan Pengukuran
2. AI Vision Helper
3. Rule-Based Health Interpretation
4. Dashboard dan Tren
5. Report dan Doctor-Ready PDF
6. Family dan Caregiver Monitoring
7. Emergency Alert dan Red Flag Guardrail
8. Medication, Reminder, dan Fasting
9. Symptom Log dan Daily Health Hub
10. Hydration Tracker
11. Cycle Tracking dengan Privacy Guardrail
12. PWA, Offline, Export, dan Accessibility
12. PWA, Offline, Export, dan Accessibility
13. AI Clinical Copilot dan 13-Detector Safety Runtime
14. WhatsApp AI Kesehatan
15. Admin, Subscription, Entitlement, dan Audit
16. AI Governance dan Operating Mode Management
```

### 8.3 Feature Detail Card Requirements

Each feature card must include:

```text
Icon
Title
Short benefit
How it works
Safety note if relevant
CTA if relevant
```

---

## 9. Pricing Page PRD

### 9.1 Objective

Pricing page must explain plans, compare feature access, and drive signup.

### 9.2 Plan Cards

Required plans:

```text
Free
Premium Monthly
Premium 3-Month
Premium Yearly
Family Premium
```

### 9.3 Plan Feature Groups

Compare by:

```text
Measurement logging
AI Vision quota
History length
Daily/weekly/monthly dashboard
Doctor-ready PDF
Telegram reminder
Family/caregiver dashboard
Medication tracker
Fasting tracker
Hydration tracker
Cycle tracking
AI report / safe AI insight
AI memory / clinical infrastructure readiness
Export
Support level
```

### 9.4 Upgrade Prompt Copy

Allowed:

```text
Upgrade untuk membuka report lanjutan, reminder, dan fitur keluarga.
```

Not allowed:

```text
Upgrade untuk diagnosis AI.
Upgrade untuk resep obat.
Upgrade untuk kepastian kondisi Anda.
```

---

## 10. Blog PRD

### 10.1 Blog Objective

The blog must serve as:

```text
1. SEO engine.
2. Health education layer.
3. Trust builder.
4. Product education support.
5. Conversion funnel into free signup.
```

### 10.2 Blog Categories

Required categories:

```text
Tekanan Darah
Gula Darah
Oximeter / SpO2
Kolesterol
Asam Urat
Berat Badan & BMI
Suhu Tubuh
Tidur
Hidrasi
Obat dan Reminder
Puasa / Fasting
Keluhan Harian
Kesehatan Keluarga
Caregiver
Laporan Dokter
Panduan Alat Kesehatan
AI dan Kesehatan Digital
AI Clinical Copilot
WhatsApp AI
Privasi Data Kesehatan
```

### 10.3 Blog Index Requirements

Blog index must include:

```text
Blog hero
Search input
Category filter
Featured article
Latest articles grid
Popular categories
Newsletter CTA
Pagination or load more
```

### 10.4 Blog Detail Requirements

Each article page must include:

```text
Title
Description
Category
Tags
Published date
Updated date
Author
Reviewer optional, only if real
Reading time
Table of contents
Medical disclaimer near top
Article content
References section for medical claims
Inline CTA
Related articles
Newsletter CTA
Final CTA
```

### 10.5 Blog Frontmatter Schema

Each MDX article must use this frontmatter:

```yaml
---
title: "Cara Membaca Hasil Tensimeter Digital"
slug: "cara-membaca-hasil-tensimeter-digital"
description: "Panduan sederhana memahami angka sistolik, diastolik, dan denyut nadi dari tensimeter digital."
publishedAt: "2026-06-26"
updatedAt: "2026-06-26"
category: "Tekanan Darah"
tags:
  - tensimeter
  - tekanan darah
  - sistolik
  - diastolik
author: "Tim iSehat"
reviewedBy: ""
reviewStatus: "editorial"
featured: false
draft: false
coverImage: "/images/blog/tensimeter.webp"
seoTitle: "Cara Membaca Hasil Tensimeter Digital"
seoDescription: "Pelajari arti sistolik, diastolik, dan denyut nadi pada tensimeter digital."
references:
  - label: "Sumber rujukan 1"
    url: ""
---
```

### 10.6 Article Safety Rules

Articles must not:

```text
Give diagnosis final
Prescribe medication
Change medication dosage
Tell user to stop medication
Claim app replaces doctors
Delay emergency help
Use fear-based claims
Guarantee recovery
Use “pasti”, “jamin”, “sembuh total”, or “aman 100%” medical claims
```

Every medical article must include this disclaimer:

```text
Artikel ini hanya untuk edukasi umum dan tidak menggantikan konsultasi dengan dokter atau tenaga kesehatan profesional. Jika Anda mengalami gejala berat seperti nyeri dada, sesak napas, pingsan, kelemahan satu sisi tubuh, kebingungan berat, atau kondisi darurat lainnya, segera cari bantuan medis.
```

### 10.7 Seed Articles Required

AI agent must create at least these MDX placeholder articles:

```text
1. cara-membaca-hasil-tensimeter-digital
2. tekanan-darah-normal-dan-kapan-perlu-cek-ulang
3. arti-sistolik-dan-diastolik
4. cara-membaca-oximeter
5. spo2-normal-berapa
6. cara-mencatat-gula-darah-puasa
7. gula-darah-puasa-vs-dua-jam-setelah-makan
8. kolesterol-total-apa-artinya
9. asam-urat-tinggi-apa-yang-perlu-dicatat
10. apa-itu-bmi
11. kenapa-catatan-kesehatan-harian-penting
12. apa-yang-perlu-dibawa-saat-konsultasi-dokter
13. cara-membuat-laporan-kesehatan-30-hari
14. cara-mencatat-obat-harian
15. kenapa-keluhan-harian-perlu-dicatat
16. cara-mencatat-hidrasi-harian
17. apa-itu-fasting-timer-untuk-pemeriksaan-gula-darah
18. cara-keluarga-memantau-orang-tua-dari-jauh
19. apa-itu-ai-vision-untuk-membaca-alat-kesehatan
20. privasi-data-kesehatan-di-aplikasi-digital
21. apa-itu-ai-clinical-copilot-iSehat
22. cara-kerja-13-detector-safety-runtime-iSehat
23. whatsapp-ai-kesehatan-iSehat
24. emergency-guidance-di-aplikasi-kesehatan
```

---

## 11. Use Case Page PRD

### 11.1 `/use-cases/keluarga`

Must explain:

```text
Family monitoring
Caregiver permission
Emergency alert
Telegram notifications
Doctor-ready report
Consent-first access
```

### 11.2 `/use-cases/caregiver`

Must explain:

```text
Caregiver dashboard
Limited permission
Alert receive setting
Measurement visibility
Privacy boundaries
```

### 11.3 `/use-cases/tekanan-darah`

Must explain:

```text
Blood pressure input
AI Vision from tensimeter photo
Systolic/diastolic/pulse
Manual override
Rule-based interpretation
Trend dashboard
Doctor report
```

### 11.4 `/use-cases/gula-darah`

Must explain:

```text
Glucose fasting
Glucose post-meal
Sinocare/device photo reading
Manual verification
Trend
Doctor report
Fasting timer connection
```

### 11.5 `/use-cases/laporan-dokter`

Must explain:

```text
30-day doctor-ready PDF
Charts
Metric summaries
Medication log
Alert log
Symptom log
Evidence thumbnails if available in app
Disclaimer
Share link if available
```

---

## 12. Theme System PRD

### 12.1 Required Themes

Website must support:

```text
light
dark
warm
```

### 12.2 Theme Behavior

```text
1. Default theme: light.
2. User can change theme from desktop header.
3. User can change theme from mobile menu.
4. Theme preference persists in localStorage.
5. Theme applies before paint to avoid flash.
6. All components must use CSS variables/design tokens.
7. No hardcoded text/background colors in components.
```

### 12.3 Theme Tokens

Minimum CSS variables:

```css
:root {
  --color-bg: ;
  --color-bg-soft: ;
  --color-surface: ;
  --color-surface-soft: ;
  --color-text: ;
  --color-text-muted: ;
  --color-border: ;
  --color-primary: ;
  --color-primary-foreground: ;
  --color-accent: ;
  --color-success: ;
  --color-warning: ;
  --color-danger: ;
  --color-info: ;
  --color-ai: ;
  --shadow-card: ;
  --shadow-soft: ;
  --gradient-hero: ;
  --gradient-card: ;
}
```

### 12.4 Theme Visual Direction

Light:

```text
Off-white / very light blue background
Deep navy text
Teal/medical blue primary
Clean clinical SaaS feeling
```

Dark:

```text
Deep navy / charcoal background
Dark slate surfaces
Off-white text
Bright teal/sky blue primary
Premium high-tech feeling
```

Warm:

```text
Warm cream background
Ivory surface
Warm charcoal/brown text
Muted teal primary
Amber accent
Human, friendly, less clinical feeling
```

---

## 13. UI/UX PRD

### 13.1 Visual Direction

```text
Premium health-tech SaaS
Clean medical dashboard
Soft enterprise
Calm but powerful
Trust-first
Modern, not generic
Not hospital-old-style
Not childish
Not empty minimalist
```

### 13.2 Design System Components

Required components:

```text
Header
MobileMenu
Footer
ThemeToggle
SEOHead
Container
SectionHeader
Button
Badge
FeatureCard
MetricPreviewCard
DashboardMockup
ReportPreviewCard
TrustCard
ProblemCard
WorkflowStep
PricingCard
FeatureComparisonTable
BlogCard
BlogSearch
CategoryFilter
TableOfContents
MedicalDisclaimerBox
FAQAccordion
NewsletterForm
CTASection
UseCaseCard
SocialLinks
Breadcrumb
```

### 13.3 UI States

Every interactive section must support:

```text
Default
Hover
Focus
Active
Disabled
Loading where relevant
Error where relevant
Success where relevant
Empty state where relevant
```

### 13.4 Mobile UX

```text
1. Mobile-first at 360px width.
2. Header collapses to hamburger.
3. CTA visible in mobile menu.
4. Theme toggle accessible in mobile menu.
5. Hero stacks text first, visual second.
6. Cards become single column.
7. Pricing cards stack.
8. Blog cards single column.
9. Touch target minimum 44px.
```

### 13.5 Accessibility UX

```text
1. All interactive elements keyboard accessible.
2. Visible focus ring.
3. Icon-only buttons require aria-label.
4. Images require alt text.
5. Text contrast must pass WCAG AA.
6. Color cannot be the only status indicator.
7. FAQ accordion must be keyboard navigable.
8. Theme toggle must be screen-reader friendly.
```

---

## 14. SEO PRD

### 14.1 Required SEO Features

```text
Per-page title
Per-page meta description
Canonical URL
Open Graph metadata
Twitter card metadata
Sitemap.xml
Robots.txt
Article schema
FAQ schema if FAQ is present
Breadcrumb schema for blog pages
Organization schema
Website schema
```

### 14.2 URL Rules

Allowed:

```text
/blog/cara-membaca-oximeter
/blog/tekanan-darah-normal
/use-cases/keluarga
```

Not allowed:

```text
/blog/Article123
/blog/cara_membaca_oximeter
/blog/2026/06/26/post?id=1
```

### 14.3 Metadata Rules

```text
1. No empty title.
2. No duplicate title for different pages.
3. No empty description.
4. Description length target: 120–160 characters.
5. Every blog article must have seoTitle and seoDescription.
6. Every article should have updatedAt.
```

---

## 15. Newsletter and Lead Capture PRD

### 15.1 MVP Behavior

Newsletter form is allowed but must not fake backend success.

If no email provider exists:

```text
1. Validate email format client-side.
2. Show honest message:
   "Fitur newsletter sedang disiapkan. Untuk sementara, silakan hubungi kami melalui halaman kontak."
3. Do not claim email has been saved.
```

If email provider exists later:

```text
1. Use double opt-in if possible.
2. Include consent text.
3. Include unsubscribe policy.
4. Update privacy policy.
```

### 15.2 Lead Magnet Future Scope

Potential lead magnets:

```text
Template catatan tekanan darah 30 hari
Checklist konsultasi dokter
Panduan membaca tensimeter digital
Panduan membaca oximeter
Panduan laporan kesehatan keluarga
```

---

## 16. Social Media PRD

Footer must support social links config:

```ts
export const socialLinks = {
  instagram: "",
  facebook: "",
  telegram: "",
  linkedin: "",
  youtube: "",
}
```

Render only non-empty URLs.

Required social placeholders:

```text
Instagram
Facebook
Telegram
LinkedIn
YouTube optional
```

No fake social links.

---

## 17. Functional Requirements

### 17.1 Site Requirements

| ID | Requirement | Priority |
|---|---|---|
| SITE-FR-001 | Site must deploy at `isehat.biz.id`. | P0 |
| SITE-FR-002 | Homepage must include all mandatory sections. | P0 |
| SITE-FR-003 | Header must include navigation, login, signup CTA, and theme toggle. | P0 |
| SITE-FR-004 | Login CTA must link to `https://app.isehat.biz.id/login`. | P0 |
| SITE-FR-005 | Signup CTA must link to `https://app.isehat.biz.id/register`. | P0 |
| SITE-FR-006 | Site must support light, dark, and warm themes. | P0 |
| SITE-FR-007 | Theme selection must persist in localStorage. | P0 |
| SITE-FR-008 | Site must have `/features`. | P0 |
| SITE-FR-009 | Site must have `/pricing`. | P0 |
| SITE-FR-010 | Site must have `/privacy`. | P0 |
| SITE-FR-011 | Site must have `/terms`. | P0 |
| SITE-FR-012 | Site must have `/disclaimer`. | P0 |
| SITE-FR-013 | Site must have `/contact`. | P1 |
| SITE-FR-014 | Site must have use-case pages. | P1 |
| SITE-FR-015 | Site must show medical disclaimer on relevant pages. | P0 |
| SITE-FR-016 | Site must not show prohibited AI/diagnosis claims. | P0 |
| SITE-FR-017 | Site must have responsive mobile menu. | P0 |
| SITE-FR-018 | Footer must include legal, social, blog, app CTA, and disclaimer links. | P0 |
| SITE-FR-019 | Site must accurately represent existing app capabilities without exposing internal secrets. | P0 |

### 17.2 Blog Requirements

| ID | Requirement | Priority |
|---|---|---|
| BLOG-FR-001 | Blog index must be available at `/blog`. | P0 |
| BLOG-FR-002 | Blog detail must be available at `/blog/[slug]`. | P0 |
| BLOG-FR-003 | Articles must use MDX. | P0 |
| BLOG-FR-004 | Every article must use required frontmatter. | P0 |
| BLOG-FR-005 | Draft articles must not render in production listing. | P0 |
| BLOG-FR-006 | Blog index must have latest articles. | P0 |
| BLOG-FR-007 | Blog index must have category filter. | P0 |
| BLOG-FR-008 | Blog index should have client-side search. | P1 |
| BLOG-FR-009 | Blog detail should have table of contents. | P1 |
| BLOG-FR-010 | Blog detail must have medical disclaimer. | P0 |
| BLOG-FR-011 | Blog detail must have CTA to app or feature page. | P0 |
| BLOG-FR-012 | Blog detail must have related articles. | P1 |
| BLOG-FR-013 | Medical articles must include references section. | P0 |

### 17.3 SEO Requirements

| ID | Requirement | Priority |
|---|---|---|
| SEO-FR-001 | All pages must have title and meta description. | P0 |
| SEO-FR-002 | All pages must have canonical URL. | P0 |
| SEO-FR-003 | All pages must have Open Graph metadata. | P0 |
| SEO-FR-004 | Site must generate sitemap.xml. | P0 |
| SEO-FR-005 | Site must include robots.txt. | P0 |
| SEO-FR-006 | Blog detail must include Article schema. | P1 |
| SEO-FR-007 | FAQ section should include FAQ schema if safe. | P2 |
| SEO-FR-008 | Blog pages should include breadcrumb. | P1 |

### 17.4 Theme Requirements

| ID | Requirement | Priority |
|---|---|---|
| THEME-FR-001 | Theme toggle must support Light, Dark, Warm. | P0 |
| THEME-FR-002 | Theme preference must persist after refresh. | P0 |
| THEME-FR-003 | Theme must apply to all pages and components. | P0 |
| THEME-FR-004 | Theme must not cause unreadable contrast. | P0 |
| THEME-FR-005 | Theme should avoid flash during page load. | P1 |

---

## 18. Non-Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| NFR-001 | Site must be static-first and not require D1 on MVP. | P0 |
| NFR-002 | Site must not require R2 on MVP. | P0 |
| NFR-003 | Site must not collect health data. | P0 |
| NFR-004 | Site must not expose app secrets or internal IDs. | P0 |
| NFR-005 | Site must be mobile-first at 360px. | P0 |
| NFR-006 | Touch target minimum 44px. | P0 |
| NFR-007 | Lighthouse Performance target: 90+. | P1 |
| NFR-008 | Lighthouse Accessibility target: 90+. | P1 |
| NFR-009 | Lighthouse SEO target: 90+. | P1 |
| NFR-010 | Build must pass without TypeScript errors. | P0 |
| NFR-011 | No broken internal links. | P0 |
| NFR-012 | Images must be optimized and lazy-loaded except critical hero image. | P0 |
| NFR-013 | Site must remain readable with JS disabled except search/theme interactivity. | P1 |
| NFR-014 | External links must use HTTPS. | P0 |
| NFR-015 | No fake testimonials, fake doctors, or fake partnerships. | P0 |
| NFR-016 | Medical content must avoid diagnosis/prescription language. | P0 |
| NFR-017 | Animation must not reduce readability or accessibility. | P1 |
| NFR-018 | Dark/warm themes must meet contrast requirements for main text. | P0 |

---

## 19. Security and Privacy Requirements

```text
1. Public site must not have D1 app DB binding.
2. Public site must not have R2 app bucket binding.
3. Public site must not import worker secrets.
4. No token, bot token, chat ID, database ID, or secret in client bundle.
5. Contact form must include warning: Jangan mengirim data medis sensitif melalui form ini.
6. Newsletter form must include consent text.
7. Privacy page must explain that public website does not collect health measurement data.
8. Any analytics/pixel integration must be documented in privacy policy before production.
9. If social pixels are added, implement consent/privacy review first.
```

---

## 20. Recommended Folder Structure

```text
site/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── wrangler.toml
├── public/
│   ├── favicon.svg
│   ├── robots.txt
│   ├── images/
│   │   ├── og-default.png
│   │   ├── hero-dashboard.webp
│   │   ├── report-preview.webp
│   │   └── blog/
│   └── icons/
├── src/
│   ├── content/
│   │   └── blog/
│   ├── data/
│   │   ├── navigation.ts
│   │   ├── appFeatures.ts
│   │   ├── productionCapabilities.ts
│   │   ├── pricing.ts
│   │   ├── faq.ts
│   │   ├── blogCategories.ts
│   │   └── socialLinks.ts
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   ├── MarketingLayout.astro
│   │   └── BlogLayout.astro
│   ├── components/
│   │   ├── common/
│   │   ├── landing/
│   │   ├── blog/
│   │   ├── pricing/
│   │   └── use-cases/
│   ├── pages/
│   │   ├── index.astro
│   │   ├── features.astro
│   │   ├── pricing.astro
│   │   ├── about.astro
│   │   ├── contact.astro
│   │   ├── privacy.astro
│   │   ├── terms.astro
│   │   ├── disclaimer.astro
│   │   ├── use-cases/
│   │   └── blog/
│   ├── styles/
│   │   ├── global.css
│   │   └── themes.css
│   └── utils/
│       ├── seo.ts
│       ├── blog.ts
│       ├── date.ts
│       ├── readingTime.ts
│       └── theme.ts
```

---

## 21. Cloudflare/Wrangler Requirements

`site/wrangler.toml`:

```toml
name = "isehat-public-site"
compatibility_date = "2026-06-01"
pages_build_output_dir = "dist"
```

Do not add D1/R2/AI bindings in MVP:

```toml
# Do not add [[d1_databases]]
# Do not add [[r2_buckets]]
# Do not add [ai]
# Do not add Vectorize binding
# Do not add Queues binding
```

---

## 22. AI Agent Execution Rules

AI agent must follow:

```text
1. Only edit files inside /site unless explicitly instructed.
2. Do not modify /web app project.
3. Do not modify /worker API project.
4. Do not add D1, R2, Vectorize, Queue, or Workers AI binding to site MVP.
5. Do not create fake backend for newsletter/contact.
6. Do not claim newsletter emails are stored if no backend exists.
7. Do not expose production tokens, chat IDs, database IDs, or internal secrets.
8. Do not use medical diagnosis, prescription, or AI doctor claims.
9. Do not invent doctors, reviewers, testimonials, partnerships, or certifications.
10. Use placeholder mock data only for dashboards/reports.
11. Use CSS variables for all theme colors.
12. Keep visible public content in Indonesian.
13. Ensure build passes.
14. Ensure all core routes exist.
15. Ensure no broken internal links.
16. Ensure each MDX article has frontmatter.
17. Ensure draft articles are excluded from production list.
18. Ensure medical disclaimer appears on medical content.
```

---

## 23. Implementation Phases

### Phase 0 — Setup

Deliverables:

```text
Astro setup
Tailwind setup
BaseLayout
MarketingLayout
BlogLayout
Theme tokens
Theme toggle
Header
Footer
SEO component
```

Acceptance:

```text
[ ] Site runs locally.
[ ] Build passes.
[ ] Header/footer visible.
[ ] Light/dark/warm theme works.
[ ] No D1/R2 bindings added.
```

### Phase 1 — Homepage

Deliverables:

```text
Hero
Trust indicators
Problem section
Workflow section
Capability preview
Feature grid
Device/metric section
Dashboard/report preview
Family/caregiver section
Safety section
Pricing teaser
Blog preview
Newsletter placeholder
FAQ
Final CTA
```

Acceptance:

```text
[ ] Homepage complete.
[ ] All CTAs link correctly.
[ ] Mobile layout works.
[ ] No prohibited claims.
[ ] Themes apply to every section.
```

### Phase 2 — Core Pages

Deliverables:

```text
/features
/pricing
/about
/contact
/privacy
/terms
/disclaimer
/use-cases/keluarga
/use-cases/caregiver
/use-cases/tekanan-darah
/use-cases/gula-darah
/use-cases/laporan-dokter
```

Acceptance:

```text
[ ] Pages exist.
[ ] No 404 internal links.
[ ] Legal/disclaimer content present.
[ ] Pricing does not invent final prices.
```

### Phase 3 — Blog

Deliverables:

```text
/blog index
/blog/[slug]
Category filtering
Client-side search
Related articles
Table of contents
Medical disclaimer box
20 seed MDX articles
```

Acceptance:

```text
[ ] Blog index renders.
[ ] Blog detail renders.
[ ] Draft exclusion works.
[ ] Search/filter works.
[ ] Medical disclaimer appears.
```

### Phase 4 — SEO and Polish

Deliverables:

```text
sitemap.xml
robots.txt
canonical URLs
Open Graph metadata
Article schema
Breadcrumb schema
FAQ schema where relevant
Performance pass
Accessibility pass
Responsive polish
```

Acceptance:

```text
[ ] Lighthouse SEO target 90+.
[ ] Lighthouse Accessibility target 90+.
[ ] No missing metadata on key pages.
[ ] No visible theme contrast issue.
```

---

## 24. UAT Checklist

### Homepage

```text
[ ] Header navigation works.
[ ] Login goes to app login.
[ ] Signup goes to app register.
[ ] Hero explains product clearly.
[ ] Product capabilities match implemented app features.
[ ] Safety section visible.
[ ] Pricing teaser visible.
[ ] Blog preview visible.
[ ] Final CTA visible.
```

### Theme

```text
[ ] Light theme works.
[ ] Dark theme works.
[ ] Warm theme works.
[ ] Theme persists after refresh.
[ ] Theme works on all pages.
[ ] Mobile menu includes theme toggle.
```

### Blog

```text
[ ] Blog index works.
[ ] Blog detail works.
[ ] Category filter works.
[ ] Search works if implemented.
[ ] Article disclaimer visible.
[ ] Related articles visible.
[ ] Draft posts hidden.
```

### Safety

```text
[ ] No AI doctor claim.
[ ] No diagnosis final claim.
[ ] No prescription claim.
[ ] No emergency authority claim.
[ ] No fake doctor/testimonial/partner.
[ ] No private token/ID/secret visible.
```

### SEO

```text
[ ] sitemap.xml available.
[ ] robots.txt available.
[ ] Title and description exist.
[ ] OG metadata exists.
[ ] Canonical URL exists.
[ ] Blog article schema exists if implemented.
```

---

## 25. Final Done Criteria

Project is considered done when:

```text
[ ] Public site deploys successfully to Cloudflare Pages.
[ ] Homepage, feature, pricing, blog, use-case, legal pages exist.
[ ] Light/dark/warm themes work and persist.
[ ] Blog supports MDX articles with frontmatter.
[ ] At least 20 seed articles exist.
[ ] SEO metadata, sitemap, robots are implemented.
[ ] CTAs route to app domain correctly.
[ ] UI feels like modern enterprise health-tech SaaS.
[ ] Site accurately represents production app capabilities.
[ ] Site does not expose internal secrets or sensitive production data.
[ ] Site does not collect health data.
[ ] Site does not use prohibited medical/AI claims.
[ ] Build/typecheck pass.
[ ] Mobile 360px layout is usable.
```

---

## 26. Product Copy Guardrail Summary

Allowed:

```text
Catatan kesehatan harian
Dashboard tren
Laporan 30 hari untuk dokter
AI membantu membaca angka
Manual verification
Rule-based interpretation
Family monitoring with consent
Emergency alert berbasis aturan
Edukasi kesehatan umum
```

Forbidden:

```text
AI dokter
Diagnosis otomatis
Deteksi penyakit pasti
Resep obat
Ubah dosis obat
Pengganti dokter
Jaminan sembuh
Jaminan aman
Emergency AI authority
```

---

## 27. Notes for Future Version

Future version may add:

```text
D1 content CMS
R2 media library
Email marketing provider integration
Lead magnet download
Partner landing pages
Referral/coupon system
A/B testing
Analytics event dashboard
Content editorial workflow
Medical reviewer workflow if real reviewers exist
```

These are not required for MVP and must not be faked.
