import { useMemo, useState } from 'react'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../context/auth'
import { useI18n } from '../../i18n'

type FaqItem = { q: string; a: string }
type FaqCategory = { id: string; label: string; icon: string; items: FaqItem[] }

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'akun',
    label: 'Akun & Login',
    icon: 'manage_accounts',
    items: [
      {
        q: 'Bagaimana cara mendaftar akun HealthSync?',
        a: 'Buka halaman utama lalu pilih "Daftar". Masukkan nama lengkap, email aktif, dan kata sandi yang kuat (minimal 8 karakter). Setelah menekan tombol Daftar, kami mengirim tautan verifikasi ke email Anda. Klik tautan tersebut untuk mengaktifkan akun, lalu lengkapi data onboarding (tinggi badan, zona waktu, mode aksesibilitas). Jika email verifikasi tidak masuk, periksa folder spam atau gunakan fitur "Kirim ulang tautan" di halaman login.',
      },
      {
        q: 'Bagaimana cara masuk (login) ke aplikasi?',
        a: 'Pada halaman utama pilih "Masuk", masukkan email dan kata sandi Anda, lalu tekan tombol Masuk. Sesi Anda disimpan secara aman sehingga tidak perlu login berulang. Jika lupa kata sandi, klik "Lupa kata sandi?" dan ikuti tautan yang dikirim ke email. Untuk keamanan, selalu logout dari perangkat umum melalui menu pengguna di kanan atas.',
      },
      {
        q: 'Bagaimana cara mereset kata sandi saya?',
        a: 'Klik "Lupa kata sandi?" di halaman login, atau buka menu pengguna di kanan atas lalu pilih "Reset Password". Masukkan email terdaftar dan kami akan mengirim tautan reset. Buka tautan tersebut (berlaku 60 menit), buat kata sandi baru, lalu konfirmasi. Setelah berhasil, gunakan kata sandi baru untuk login. Pastikan kata sandi baru berbeda dan cukup kuat.',
      },
      {
        q: 'Bagaimana cara menghapus akun saya secara permanen?',
        a: 'Buka Settings > Profile, gulir ke bagian paling bawah lalu pilih "Hapus Akun". Anda akan diminta mengetikkan email sebagai konfirmasi dan memasukkan kata sandi. Penghapusan bersifat permanen: seluruh data pengukuran, laporan, dan riwayat dihapus dari server kami dalam 30 hari. Sebelum menghapus, disarankan mengekspor data Anda terlebih dahulu melalui menu Data Export. Tindakan ini tidak dapat dibatalkan.',
      },
      {
        q: 'Apakah akun saya bisa digunakan di banyak perangkat?',
        a: 'Ya. Akun yang sama dapat digunakan di ponsel, tablet, dan komputer. Data disinkronkan otomatis ke cloud setiap kali perangkat terhubung internet. Untuk keamanan, hanya satu sesi aktif per perangkat; login di perangkat baru akan mempertahankan sesi lama tetapi sebaiknya logout dari perangkat yang tidak dipakai lagi.',
      },
    ],
  },
  {
    id: 'pengukuran',
    label: 'Pengukuran & Kesehatan',
    icon: 'monitor_heart',
    items: [
      {
        q: 'Bagaimana cara mengukur tekanan darah dengan benar?',
        a: 'Duduk tenang selama 5 menit, jangan berbicara, sandarkan punggung dengan kaki rata di lantai. Pasang manset pada lengan kiri 2-3 cm di atas lipatan siku, dengan posisi manset sejantung jantung. Tekan tombol start pada tensimeter dan jangan bergerak hingga hasil muncul. Catat angka sistolik (atas), diastolik (bawah), dan denyut. Di aplikasi, pilih New Measurement > Blood Pressure, lalu masukkan nilai atau foto layar tensimeter. Hindari kafein dan olahraga 30 menit sebelum mengukur.',
      },
      {
        q: 'Apa itu SpO2 dan bagaimana cara mengukurnya?',
        a: 'SpO2 adalah saturasi oksigen dalam darah, menunjukkan persentase oksigen yang terikat hemoglobin. Normalnya 95-100%. Ukur dengan oksimeter jari: tempelkan ke ujung jari telunjuk, diamkan hingga angka stabil (10-20 detik). Pilih New Measurement > SpO2 di aplikasi lalu masukkan nilainya. Nilai di bawah 92% atau menurun drastis sebaiknya segera dikonsultasikan ke dokter.',
      },
      {
        q: 'Bagaimana cara mencatat gula darah (glukosa)?',
        a: 'Gunakan glukometer (mis. Sinocare). Cuci tangan, tusuk ujung jari dengan lancet, teteskan darah ke strip. Masukkan strip ke glukometer dan tunggu hasil. Di aplikasi pilih New Measurement > Glucose, masukkan nilai (mg/dL atau mmol/L) dan catat apakah puasa atau sesudah makan. Mencatat waktu dan kondisi membantu dokter menafsirkan pola gula darah Anda.',
      },
      {
        q: 'Bagaimana cara mengukur suhu tubuh?',
        a: 'Gunakan termometer digital. Untuk ketiak: tempelkan ujung termometer ke lipatan ketiak, rapatkan lengan, tunggu bunyi (sekitar 60 detik). Untuk telinga: masukkan probe lembut ke liang telinga dan tekan tombol. Normal 36,1-37,2°C. Di aplikasi pilih New Measurement > Temperature lalu masukkan nilai. Suhu di atas 38°C termasuk demam; konsultasikan ke tenaga medis bila berkepanjangan.',
      },
      {
        q: 'Bagaimana cara mencatat berat badan?',
        a: 'Letakkan timbangan di permukaan datar dan keras (bukan karpet). Berdiri tegak dengan berat terdistribusi merata pada kedua kaki, tanpa alas kaki. Tunggu hingga angka stabil lalu catat. Pilih New Measurement > Weight di aplikasi dan masukkan nilai dalam kilogram. Untuk konsistensi, timbang diri pada waktu yang sama setiap hari (idealnya pagi setelah bangun, sebelum makan).',
      },
    ],
  },
  {
    id: 'pelacakan',
    label: 'Pelacakan Harian',
    icon: 'water_drop',
    items: [
      {
        q: 'Bagaimana cara menggunakan hydration tracker (pelacak hidrasi)?',
        a: 'Buka menu Hydration. Setiap kali Anda minum, ketuk tombol "Tambah Air" dan pilih ukuran gelas (default 250 ml). Aplikasi menjumlahkan total asupan harian dan membandingkannya dengan target (umumnya 2000 ml, dapat disesuaikan di Hydration Settings). Anda juga dapat mengatur pengingat setiap beberapa jam agar tidak lupa minum. Progres harian ditampilkan dengan progress bar dan grafik mingguan.',
      },
      {
        q: 'Bagaimana cara kerja cycle tracking (pelacakan siklus)?',
        a: 'Fitur Cycle membantu mencatat siklus menstruasi, ovulasi, dan gejala terkait. Masukkan tanggal mulai haid setiap bulan; aplikasi memperkirakan siklus rata-rata, hari subur, dan jadwal berikutnya. Anda juga dapat mencatat gejala (kram, mood, keputihan) yang tampil di grafik pola. Catatan: perkiraan bersifat indikatif, bukan alat kontrasepsi. Konsultasikan dokter untuk evaluasi medis.',
      },
      {
        q: 'Bagaimana cara mencatat gejala (symptom logger)?',
        a: 'Pilih menu Symptoms > "Tambah Gejala". Pilih jenis gejala (mis. sakit kepala, lelah, mual), tentukan tingkat keparahan menggunakan Visual Analog Scale (VAS) dengan menggeser slider 0-10 (0 = tidak ada, 10 = sangat berat). Tambahkan catatan opsional dan waktu kejadian. Data tampil di riwayat gejala dan dapat dipetakan bersama pengukuran lain untuk mengidentifikasi pola.',
      },
      {
        q: 'Apa itu VAS (Visual Analog Scale)?',
        a: 'VAS adalah skala penilaian 0-10 untuk mengukur intensitas gejala atau nyeri yang Anda rasakan. Geser slider ke kiri (0, tidak ada keluhan) atau ke kanan (10, sangat berat). Skala ini dipakai luas di dunia medis karena sederhana namun konsisten antar waktu. Mencatat VAS setiap hari memungkinkan Anda dan dokter melihat apakah gejala membaik atau memburuk.',
      },
    ],
  },
  {
    id: 'fitur',
    label: 'Fitur & Alat Bantu',
    icon: 'psychology',
    items: [
      {
        q: 'Apa itu AI Assistant dan bagaimana cara menggunakannya?',
        a: 'AI Assistant adalah asisten cerdas yang menjawab pertanyaan kesehatan berdasarkan data pengukuran Anda. Buka menu AI Assistant, ketik pertanyaan seperti "Bagaimana tren tekanan darah saya minggu ini?" atau "Apakah hidrasi saya sudah cukup?". AI menganalisis data Anda dan memberikan ringkasan serta saran umum. AI tidak menggantikan diagnosis dokter; untuk keputusan klinis selalu konsultasikan ke tenaga medis profesional.',
      },
      {
        q: 'Bagaimana cara menggunakan timer puasa (fasting timer)?',
        a: 'Buka menu Fasting Timer lalu pilih pola puasa (mis. 16:8, 18:6) atau atur durasi kustom. Ketuk "Mulai Puasa" saat mulai berpuasa; timer berjalan mundur dan menampilkan jam tersisa serta status metabolisme (mis. glikogen habis, mulai ketosis). Ketuk "Akhiri Puasa" untuk menyelesaikan. Riwayat puasa tersimpan dan dapat ditinjau kapan saja.',
      },
      {
        q: 'Bagaimana cara mengelola pengingat (reminders) dan obat (medications)?',
        a: 'Di menu Reminders, tambahkan jadwal pengingat untuk minum obat, mengukur tekanan darah, atau minum air. Atur waktu, frekuensi, dan notifikasi. Di menu Medications, catat daftar obat Anda beserta dosis dan jadwal. Pengingat terintegrasi dengan Telegram bila diaktifkan, sehingga notifikasi juga dikirim ke bot Telegram Anda.',
      },
      {
        q: 'Bagaimana cara menggunakan fitur Patterns (pola)?',
        a: 'Menu Patterns menganalisis data pengukuran, gejala, dan kebiasaan Anda untuk menemukan korelasi, misalnya hubungan antara kurang tidur dengan naiknya tekanan darah, atau pengaruh hidrasi terhadap energi. Buka Patterns dan pilih rentang waktu. AI menyoroti pola signifikan dalam bentuk grafik dan kartu insight. Temuan ini berguna untuk dibawa ke konsultasi dokter.',
      },
    ],
  },
  {
    id: 'laporan',
    label: 'Laporan & Data',
    icon: 'assessment',
    items: [
      {
        q: 'Bagaimana cara menggunakan laporan (reports)?',
        a: 'Ada empat jenis laporan: Harian (ringkasan satu hari), Mingguan (tren 7 hari), Bulanan (rekap 30 hari), dan Laporan Dokter (format profesional siap cetak). Buka menu Reports lalu pilih jenis. Setiap laporan menampilkan grafik, ringkasan, dan catatan penting. Laporan Dokter dapat diunduh sebagai PDF untuk dibawa ke janji temu medis. Laporan Bulanan dan Dokter tersedia untuk pengguna Premium.',
      },
      {
        q: 'Bagaimana cara mengekspor data saya?',
        a: 'Buka Settings > Profile lalu pilih "Export Data". Data diekspor dalam format CSV/JSON berisi seluruh riwayat pengukuran, gejala, hidrasi, siklus, dan catatan Anda. File dikirim ke email terdaftar atau dapat diunduh langsung. Ekspor sebaiknya dilakukan secara berkala sebagai cadangan. Data Anda sepenuhnya milik Anda dan dapat dihapus kapan saja.',
      },
      {
        q: 'Bagaimana cara mengakses halaman Knowledge Base?',
        a: 'Knowledge Base berisi panduan terperinci untuk setiap perangkat pengukuran (tensimeter, oksimeter, glukometer, termometer, timbangan). Buka menu Education > Knowledge Base. Pilih artikel perangkat untuk membaca langkah persiapan, cara pakai, tips foto, interpretasi hasil, dan kapan harus menghubungi dokter. Panduan ini membantu memastikan pengukuran konsisten dan akurat.',
      },
    ],
  },
  {
    id: 'keluarga',
    label: 'Keluarga & Keamanan',
    icon: 'family_restroom',
    items: [
      {
        q: 'Bagaimana akses keluarga/caregiver bekerja?',
        a: 'Fitur Family/Caregiver memungkinkan anggota keluarga atau pengasuh memantau data kesehatan Anda. Buka menu Family > "Tambah Anggota", masukkan email mereka. Mereka menerima undangan untuk membuat akun caregiver dengan akses lihat-saja ke data Anda (pengukuran, laporan, pengingat). Caregiver dapat melihat Dashboard tersendiri di menu Caregiver. Fitur ini tersedia untuk pengguna Premium dan membantu koordinasi perawatan keluarga.',
      },
      {
        q: 'Apa yang harus dilakukan dalam keadaan darurat?',
        a: 'Fitur Emergency Contacts memungkinkan menyimpan kontak darurat (keluarga, dokter, ambulans 119). Buka menu Emergency Contacts > "Tambah Kontak". Saat darurat, gunakan tombol SOS untuk menghubungi kontak darurat utama dengan satu ketukan. Pastikan kontak darurat selalu diperbarui. Untuk kegawatdaruratan medis (nyeri dada hebat, sesak napas berat, pingsan), hubungi 119 atau ke IGD terdekat — aplikasi ini BUKAN pengganti layanan medis darurat.',
      },
      {
        q: 'Bagaimana cara mengatur integrasi Telegram?',
        a: 'Buka menu Settings > Telegram (atau melalui Profile). Anda akan diarahkan untuk menghubungkan bot Telegram. Klik tautan yang diberikan untuk membuka Telegram, lalu tekan /start di bot. Setelah terhubung, Anda dapat menerima notifikasi pengingat obat, pengukuran, dan laporan harian langsung di Telegram. Pastikan aplikasi Telegram terpasang dan akun Anda aktif. Fitur ini tersedia untuk pengguna Premium.',
      },
    ],
  },
  {
    id: 'privasi',
    label: 'Privasi & Keamanan',
    icon: 'shield_lock',
    items: [
      {
        q: 'Apakah data kesehatan saya aman dan terenkripsi?',
        a: 'Ya. Semua data dikirim melalui koneksi HTTPS terenkripsi dan disimpan di server dengan enkripsi at-rest. Akses ke data hanya dengan kredensial akun Anda. Kami menerapkan audit keamanan berkala dan mematuhi praktik perlindungan data. Anda memiliki kendali penuh: dapat melihat, mengekspor, dan menghapus data kapan saja. Kami tidak pernah menjual data Anda ke pihak ketiga.',
      },
      {
        q: 'Untuk apa data saya digunakan dan siapa yang dapat melihatnya?',
        a: 'Data digunakan semata-mata untuk menyediakan layanan kepada Anda: menampilkan riwayat, menghasilkan laporan, memberikan insight AI, dan mengirim pengingat. Hanya Anda yang dapat melihat data, kecuali Anda secara eksplisit berbagi akses caregiver ke keluarga atau mengirim laporan ke dokter. Anda mengatur izin di menu Settings > Consent. Kami tidak membagikan data ke pengiklan atau pihak ketiga tanpa persetujuan.',
      },
    ],
  },
  {
    id: 'langganan',
    label: 'Langganan & Premium',
    icon: 'workspace_premium',
    items: [
      {
        q: 'Bagaimana cara upgrade ke Premium?',
        a: 'Buka menu Settings > Billing atau pilih "Upgrade" di mana pun ikon PRO muncul. Halaman Premium menampilkan perbandingan paket dan harga. Pilih paket (bulanan/tahunan), lalu lanjutkan ke checkout. Setelah pembayaran berhasil, fitur Premium (Laporan Dokter, Cycle Tracking, Family/Caregiver, Telegram, AI Memory, Unified Timeline) langsung aktif. Anda dapat membatalkan kapan saja; akses tetap berlaku hingga akhir periode yang sudah dibayar.',
      },
      {
        q: 'Apa saja fitur yang eksklusif untuk Premium?',
        a: 'Pengguna Premium mendapatkan: Laporan Dokter profesional siap cetak, pelacakan siklus menstruasi (Cycle Tracking), akses Family/Caregiver untuk pengasuh, integrasi notifikasi Telegram, AI Memory (asisten mengingat konteks percakapan sebelumnya), Unified Health Timeline yang menggabungkan semua data dalam satu linimasa, dan Patterns lanjutan. Pengguna gratis tetap dapat mengukur dan mencatat semua metrik dasar serta melihat laporan harian dan mingguan.',
      },
    ],
  },
]

export function FaqPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const toast = useToast()
  const { user } = useAuth()
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const categories = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return FAQ_CATEGORIES
    return FAQ_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter((it) => it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q)),
    })).filter((cat) => cat.items.length > 0)
  }, [query])

  const visibleCategories = activeCategory === 'all' ? categories : categories.filter((c) => c.id === activeCategory)
  const totalItems = FAQ_CATEGORIES.reduce((n, c) => n + c.items.length, 0)

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id))
  }

  function handleNavigate(path: string) {
    if (onNavigate) {
      onNavigate(path)
    } else {
      window.location.href = path
    }
  }

  return (
    <div className="kb-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('kb.faqEyebrow')}</p>
          <h2>{t('kb.faqTitle')}</h2>
          <p>
            {t('kb.helloName')}{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}. {t('kb.faqSubtitle')}
          </p>
        </div>
        <span className="status-chip">{totalItems} {t('kb.faqCount')}</span>
      </div>

      <div className="settings-panel">
        <div className="card" style={{ padding: 16 }}>
          <label className="input-field" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 0, border: 0, background: 'transparent' }}>
            <span className="material-symbols-outlined" aria-hidden="true">search</span>
            <input
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('kb.searchFaq')}
              type="search"
              value={query}
              style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', font: 'inherit', color: 'inherit' }}
            />
          </label>
        </div>

        <div className="kb-chips" role="list" aria-label="Kategori FAQ" style={{ border: 0, padding: '8px 0', background: 'transparent' }}>
          <button
            className={activeCategory === 'all' ? 'active' : ''}
            key="all"
            onClick={() => setActiveCategory('all')}
            type="button"
          >
            {t('kb.all')}
          </button>
          {FAQ_CATEGORIES.map((cat) => (
            <button
              className={activeCategory === cat.id ? 'active' : ''}
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              type="button"
            >
              {cat.label}
            </button>
          ))}
        </div>

        {visibleCategories.length === 0 ? (
          <p className="form-message warning">{t('kb.noResults')} "{query}". {t('kb.tryOther')}</p>
        ) : null}

        {visibleCategories.map((cat) => (
          <section key={cat.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--colorBorderSoft)' }}>
              <span className="material-symbols-outlined" aria-hidden="true" style={{ color: 'var(--colorPrimary)' }}>{cat.icon}</span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{cat.label}</h3>
              <span className="status-chip" style={{ marginLeft: 'auto' }}>{cat.items.length}</span>
            </header>
            <div>
              {cat.items.map((item, idx) => {
                const itemId = `${cat.id}-${idx}`
                const isOpen = openId === itemId
                return (
                  <div key={itemId} style={{ borderBottom: '1px solid var(--colorBorderSoft)' }}>
                    <button
                      aria-controls={`faq-panel-${itemId}`}
                      aria-expanded={isOpen}
                      className="btn-secondary"
                      onClick={() => toggle(itemId)}
                      style={{
                        width: '100%',
                        justifyContent: 'space-between',
                        border: 0,
                        borderRadius: 0,
                        background: 'transparent',
                        padding: '14px 20px',
                        textAlign: 'left',
                        font: 'inherit',
                        fontWeight: 600,
                      }}
                      type="button"
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 20, color: 'var(--colorPrimary)' }}>
                          {isOpen ? 'help' : 'quiz'}
                        </span>
                        {item.q}
                      </span>
                      <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 20 }}>
                        {isOpen ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>
                    {isOpen ? (
                      <div id={`faq-panel-${itemId}`} style={{ padding: '0 20px 16px 52px' }}>
                        <p style={{ margin: 0, color: 'var(--colorTextSecondary)', lineHeight: 1.6 }}>{item.a}</p>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="settings-panel">
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 32, color: 'var(--colorPrimary)' }}>support_agent</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('kb.stillNeedHelp')}</h3>
            <p style={{ margin: 0, color: 'var(--colorTextSecondary)', fontSize: 14 }}>
              {t('kb.stillNeedHelpDesc')}
            </p>
          </div>
          <button className="btn-secondary" onClick={() => { toast.show(t('kb.openingKb'), 'info'); handleNavigate('/kb') }} type="button">
            <span className="material-symbols-outlined" aria-hidden="true">menu_book</span>
            {t('kb.kbButton')}
          </button>
          <button className="btn-primary" onClick={() => { toast.show(t('kb.openingManual'), 'info'); handleNavigate('/manual') }} type="button">
            <span className="material-symbols-outlined" aria-hidden="true">description</span>
            {t('kb.manualButton')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default FaqPage
