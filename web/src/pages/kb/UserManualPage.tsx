import { useMemo, useState } from 'react'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../context/auth'
import { useI18n } from '../../i18n/useI18n'

type ManualStep = { text: string }
type ManualSection = {
  id: string
  icon: string
  title: string
  intro: string
  steps: ManualStep[]
  tips?: string[]
}

const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: 'dashboard',
    icon: 'dashboard',
    title: 'Dashboard',
    intro: 'Dashboard adalah layar utama yang menampilkan ringkasan kesehatan harian, metrik terbaru, dan akses cepat ke fitur utama. Tersedia dalam tampilan Harian, Mingguan, dan Bulanan.',
    steps: [
      { text: 'Setelah login, Anda langsung berada di Dashboard "Today" yang menampilkan ringkasan tekanan darah, SpO2, gula darah, suhu, berat badan, dan hidrasi terbaru.' },
      { text: 'Gunakan menu Dashboard > Weekly View untuk melihat tren 7 hari, atau Monthly Summary untuk rekap 30 hari.' },
      { text: 'Kartu metrik menampilkan nilai terbaru dan perubahan dibanding hari sebelumnya (panah naik/turun dengan warna).' },
      { text: 'Klik kartu metrik mana pun untuk melihat riwayat detail dan grafik tren.' },
    ],
    tips: ['Pesan kustom akan muncul bila ada nilai di luar rentang normal — perhatikan kartu yang berwarna kuning atau merah.'],
  },
  {
    id: 'measurements',
    icon: 'monitor_heart',
    title: 'Pengukuran (Measurements)',
    intro: 'Catat lima jenis pengukuran kesehatan: tekanan darah, SpO2 (saturasi oksigen), gula darah, suhu tubuh, dan berat badan. Setiap metrik dapat dimasukkan manual atau melalui foto layar alat.',
    steps: [
      { text: 'Pilih menu Measurements > New Measurement untuk memilih jenis metrik yang akan dicatat.' },
      { text: 'Untuk tekanan darah: masukkan nilai sistolik, diastolik, dan denyut (atau foto layar tensimeter).' },
      { text: 'Untuk SpO2: masukkan persentase saturasi dan denyut dari oksimeter jari.' },
      { text: 'Untuk gula darah: masukkan nilai mg/dL atau mmol/L, lalu tandai kondisi (puasa / sesudah makan).' },
      { text: 'Untuk suhu: masukkan nilai dalam °C dari termometer digital.' },
      { text: 'Untuk berat badan: masukkan nilai kg dari timbangan.' },
      { text: 'Tekan "Simpan". Data langsung tersinkron ke cloud dan tampil di Dashboard serta riwayat.' },
    ],
    tips: ['Ukurlah pada waktu yang sama setiap hari untuk hasil paling konsisten.', 'Lihat Measurement History untuk membandingkan nilai dari waktu ke waktu.'],
  },
  {
    id: 'symptoms',
    icon: 'sick',
    title: 'Pencatat Gejala (Symptom Logger)',
    intro: 'Catat gejala yang Anda alami beserta tingkat keparahan menggunakan Visual Analog Scale (VAS). Data gejala dapat dipetakan bersama pengukuran untuk menemukan pola.',
    steps: [
      { text: 'Pilih menu Symptoms > "Tambah Gejala".' },
      { text: 'Pilih jenis gejala dari daftar (mis. sakit kepala, lelah, mual, nyeri sendi, gangguan tidur).' },
      { text: 'Geser slider VAS 0-10 untuk menilai tingkat keparahan (0 = tidak ada, 10 = sangat berat).' },
      { text: 'Tambahkan catatan opsional dan waktu kejadian bila berbeda dari sekarang.' },
      { text: 'Tekan "Simpan". Gejala tampil di riwayat dan dapat dianalisis di menu Patterns.' },
    ],
    tips: ['Catat gejala segera setelah muncul agar tidak lupa detailnya.', 'VAS membantu dokter melihat apakah gejala membaik atau memburuk dari waktu ke waktu.'],
  },
  {
    id: 'hydration',
    icon: 'water_drop',
    title: 'Pelacak Hidrasi (Hydration Tracker)',
    intro: 'Pantau asupan cairan harian agar tetap terhidrasi dengan baik. Target harian dapat disesuaikan dan pengingat dapat diatur.',
    steps: [
      { text: 'Buka menu Hydration untuk melihat progres asupan air hari ini.' },
      { text: 'Setiap kali minum, ketuk "Tambah Air" dan pilih ukuran gelas (default 250 ml).' },
      { text: 'Aplikasi menjumlahkan total dan membandingkannya dengan target harian (default 2000 ml).' },
      { text: 'Buka Hydration Settings untuk mengubah target harian, jadwal pengingat, dan ukuran gelas.' },
      { text: 'Lihat Hydration History untuk grafik asupan mingguan dan bulanan.' },
    ],
    tips: ['Warna urine pucat menandakan hidrasi baik; kuning pekat berarti perlu minum lebih banyak.'],
  },
  {
    id: 'cycle',
    icon: 'cycle',
    title: 'Pelacakan Siklus (Cycle Tracking)',
    intro: 'Catat siklus menstruasi, ovulasi, dan gejala terkait. Aplikasi memperkirakan siklus berikutnya dan hari subur. Fitur Premium.',
    steps: [
      { text: 'Buka menu Cycle Tracking (tersedia untuk pengguna Premium).' },
      { text: 'Masukkan tanggal mulai haid setiap bulan; aplikasi menghitung panjang siklus rata-rata.' },
      { text: 'Aplikasi menampilkan perkiraan hari subur dan tanggal siklus berikutnya.' },
      { text: 'Catat gejala terkait (kram, mood, keputihan, aliran) untuk melihat pola antar siklus.' },
      { text: 'Grafik siklus menunjukkan riwayat dan tren dari waktu ke waktu.' },
    ],
    tips: ['Perkiraan bersifat indikatif dan bukan alat kontrasepsi.', 'Konsultasikan ke dokter bila siklus sangat tidak teratur.'],
  },
  {
    id: 'reports',
    icon: 'assessment',
    title: 'Laporan (Reports)',
    intro: 'Empat jenis laporan: Harian, Mingguan, Bulanan, dan Laporan Dokter. Laporan Bulanan dan Dokter tersedia untuk pengguna Premium.',
    steps: [
      { text: 'Buka menu Reports lalu pilih jenis laporan.' },
      { text: 'Daily Report: ringkasan satu hari berisi semua metrik dan catatan.' },
      { text: 'Weekly Report: tren 7 hari dengan grafik dan ringkasan perubahan.' },
      { text: 'Monthly Report: rekap 30 hari dengan analisis pola (Premium).' },
      { text: 'Doctor Report: format profesional siap cetak PDF untuk dibawa ke dokter (Premium).' },
      { text: 'Gunakan tombol "Unduh" untuk menyimpan laporan sebagai file.' },
    ],
    tips: ['Bawa Laporan Dokter ke setiap janji temu medis agar dokter memiliki konteks lengkap.'],
  },
  {
    id: 'ai-assistant',
    icon: 'smart_toy',
    title: 'AI Assistant',
    intro: 'Asisten AI menjawab pertanyaan kesehatan berdasarkan data pengukuran Anda, memberikan ringkasan dan saran umum. Bukan pengganti diagnosis dokter.',
    steps: [
      { text: 'Buka menu AI Assistant.' },
      { text: 'Ketik pertanyaan, mis. "Bagaimana tren tekanan darah saya minggu ini?" atau "Apakah hidrasi saya sudah cukup?".' },
      { text: 'AI menganalisis data Anda dan memberikan jawaban beserta grafik/angka pendukung.' },
      { text: 'Untuk pengguna Premium dengan AI Memory, asisten mengingat konteks percakapan sebelumnya.' },
    ],
    tips: ['Semakin lengkap data yang Anda catat, semakin akurat jawaban AI.', 'Selalu validasi saran AI dengan konsultasi dokter untuk keputusan klinis.'],
  },
  {
    id: 'knowledge-base',
    icon: 'menu_book',
    title: 'Knowledge Base',
    intro: 'Panduan terperinci untuk setiap perangkat pengukuran: tensimeter, oksimeter, glukometer, termometer, dan timbangan. Termasuk langkah persiapan, cara pakai, tips foto, interpretasi hasil, dan kapan menghubungi dokter.',
    steps: [
      { text: 'Buka menu Education > Knowledge Base.' },
      { text: 'Pilih artikel perangkat yang ingin dipelajari.' },
      { text: 'Baca langkah persiapan, cara pengukuran, tips foto hasil, dan interpretasi nilai normal.' },
      { text: 'Gunakan tombol "Record with this device" untuk langsung mencatat pengukuran setelah membaca panduan.' },
    ],
  },
  {
    id: 'family',
    icon: 'family_restroom',
    title: 'Keluarga & Caregiver',
    intro: 'Bagikan akses lihat-saja kepada anggota keluarga atau pengasuh agar mereka dapat memantau data kesehatan Anda. Fitur Premium.',
    steps: [
      { text: 'Buka menu Family > "Tambah Anggota" (tersedia untuk pengguna Premium).' },
      { text: 'Masukkan email keluarga/pengasuh; mereka menerima undangan untuk membuat akun caregiver.' },
      { text: 'Caregiver dapat melihat Dashboard khusus di menu Caregiver, berisi data pengukuran, laporan, dan pengingat Anda.' },
      { text: 'Kelola atau cabut akses kapan saja melalui menu Family.' },
    ],
    tips: ['Akses caregiver bersifat lihat-saja; mereka tidak dapat mengubah data Anda.'],
  },
  {
    id: 'reminders',
    icon: 'alarm',
    title: 'Pengingat (Reminders)',
    intro: 'Atur pengingat untuk minum obat, mengukur tekanan darah, minum air, dan kebutuhan lain. Pengingat dapat dikirim sebagai notifikasi aplikasi dan Telegram.',
    steps: [
      { text: 'Buka menu Reminders > "Tambah Pengingat".' },
      { text: 'Pilih jenis (obat, pengukuran, hidrasi, kustom), waktu, dan frekuensi (harian, mingguan, tertentu).' },
      { text: 'Aktifkan notifikasi aplikasi dan (bila Premium) integrasi Telegram.' },
      { text: 'Simpan; pengingat muncul sesuai jadwal di ponsel Anda.' },
    ],
  },
  {
    id: 'medications',
    icon: 'medication',
    title: 'Obat (Medications)',
    intro: 'Catat daftar obat Anda beserta dosis, frekuensi, dan jadwal. Terintegrasi dengan Reminders dan dapat ditampilkan di Laporan Dokter.',
    steps: [
      { text: 'Buka menu Medications > "Tambah Obat".' },
      { text: 'Masukkan nama obat, dosis (mis. 500 mg), frekuensi (mis. 2x sehari), dan waktu konsumsi.' },
      { text: 'Tambahkan catatan opsional (mis. "setelah makan", "hindari susu").' },
      { text: 'Simpan; obat tampil di daftar dan dapat dikaitkan dengan pengingat otomatis.' },
    ],
    tips: ['Selalu perbarui daftar obat bila ada perubahan resep dari dokter.'],
  },
  {
    id: 'fasting',
    icon: 'timer',
    title: 'Timer Puasa (Fasting Timer)',
    intro: 'Pantau durasi puasa dengan berbagai pola (16:8, 18:6, kustom). Timer menampilkan jam tersisa dan fase metabolisme.',
    steps: [
      { text: 'Buka menu Fasting Timer.' },
      { text: 'Pilih pola puasa (16:8, 18:6, 24 jam, atau kustom).' },
      { text: 'Ketuk "Mulai Puasa" saat mulai; timer berjalan dan menampilkan jam tersisa serta status (glikogen, ketosis).' },
      { text: 'Ketuk "Akhiri Puasa" untuk menyelesaikan sesi.' },
      { text: 'Riwayat puasa tersimpan dan dapat ditinjau.' },
    ],
  },
  {
    id: 'patterns',
    icon: 'insights',
    title: 'Pola (Patterns)',
    intro: 'AI menganalisis data pengukuran, gejala, dan kebiasaan untuk menemukan korelasi, mis. hubungan kurang tidur dengan tekanan darah tinggi.',
    steps: [
      { text: 'Buka menu Patterns dan pilih rentang waktu (mingguan, bulanan).' },
      { text: 'AI menyoroti pola signifikan dalam bentuk kartu insight dan grafik korelasi.' },
      { text: 'Baca penjelasan setiap pola dan tindakan yang disarankan.' },
      { text: 'Bawa temuan ini ke konsultasi dokter untuk evaluasi medis.' },
    ],
  },
  {
    id: 'emergency',
    icon: 'emergency',
    title: 'Kontak Darurat (Emergency Contacts)',
    intro: 'Simpan kontak darurat (keluarga, dokter, ambulans 119) dan gunakan tombol SOS untuk menghubungi dengan satu ketukan.',
    steps: [
      { text: 'Buka menu Emergency Contacts > "Tambah Kontak".' },
      { text: 'Masukkan nama, nomor telepon, dan hubungan (keluarga, dokter, lainnya).' },
      { text: 'Tandai satu kontak sebagai "Utama" untuk tombol SOS.' },
      { text: 'Saat darurat, tekan tombol SOS untuk menghubungi kontak utama.' },
    ],
    tips: ['Untuk kegawatdaruratan medis (nyeri dada hebat, sesak napas, pingsan) hubungi 119 atau IGD terdekat — aplikasi BUKAN pengganti layanan medis darurat.'],
  },
  {
    id: 'telegram',
    icon: 'send',
    title: 'Integrasi Telegram',
    intro: 'Terima notifikasi pengingat obat, pengukuran, dan laporan harian langsung di Telegram. Fitur Premium.',
    steps: [
      { text: 'Buka menu Settings > Telegram (atau melalui Profile).' },
      { text: 'Klik tautan untuk membuka bot Telegram, lalu tekan /start di bot.' },
      { text: 'Setelah terhubung, notifikasi pengingat terkirim ke Telegram Anda.' },
      { text: 'Kelola jenis notifikasi yang dikirim melalui pengaturan Telegram.' },
    ],
    tips: ['Pastikan aplikasi Telegram terpasang dan akun aktif agar notifikasi tersampaikan.'],
  },
  {
    id: 'settings',
    icon: 'settings',
    title: 'Pengaturan (Settings)',
    intro: 'Kelola profil, tema, mode aksesibilitas, langganan/billing, persetujuan (consent), dan ekspor data. Termasuk penghapusan akun.',
    steps: [
      { text: 'Profile: ubah nama, foto, tinggi badan, zona waktu, tema (light/warm/dark), dan mode aksesibilitas (normal/senior/highContrast).' },
      { text: 'Billing: lihat paket saat ini, riwayat pembayaran, dan kelola langganan Premium.' },
      { text: 'Consent: atur izin penggunaan data, berbagi caregiver, dan komunikasi.' },
      { text: 'Data Export: unduh seluruh data dalam format CSV/JSON sebagai cadangan.' },
      { text: 'Delete Account: hapus akun secara permanen (tidak dapat dibatalkan).' },
    ],
    tips: ['Ekspor data secara berkala sebagai cadangan.', 'Mode Senior memperbesar teks dan tombol untuk kemudahan pengguna lansia.'],
  },
]

export function UserManualPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const toast = useToast()
  const { user } = useAuth()
  const { t } = useI18n()
  const [activeId, setActiveId] = useState<string>(MANUAL_SECTIONS[0].id)

  const toc = useMemo(() => MANUAL_SECTIONS.map((s) => ({ id: s.id, title: s.title, icon: s.icon })), [])

  function handleNavigate(path: string) {
    if (onNavigate) {
      onNavigate(path)
    } else {
      window.location.href = path
    }
  }

  function jumpTo(id: string) {
    setActiveId(id)
    const el = document.getElementById(`section-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="kb-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('kb.manualEyebrow')}</p>
          <h2>{t('kb.manualTitle')}</h2>
          <p>
            {t('kb.welcomeName')}{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}. {t('kb.manualSubtitle')}
          </p>
        </div>
        <span className="status-chip">{MANUAL_SECTIONS.length} {t('kb.manualSections')}</span>
      </div>

      <div className="kb-shell" style={{ gridTemplateColumns: 'minmax(240px, 300px) minmax(0, 1fr)' }}>
        <aside className="kb-directory" aria-label="Daftar isi">
          <div className="kb-chips" style={{ borderBottom: '1px solid var(--colorBorderSoft)', background: 'var(--colorSurfaceContainer)' }}>
            <strong style={{ font: 'var(--typLabelMd)', padding: '4px 0' }}>{t('kb.tableOfContents')}</strong>
          </div>
          <div className="kb-list">
            {toc.map((item) => (
              <button
                className={activeId === item.id ? 'kb-list-card active' : 'kb-list-card'}
                key={item.id}
                onClick={() => jumpTo(item.id)}
                type="button"
              >
                <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
                <span>
                  <strong>{item.title}</strong>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <article className="kb-reader" aria-labelledby="manual-title" style={{ overflowY: 'auto', padding: '24px 32px' }}>
          <h3 id="manual-title" style={{ margin: '0 0 8px', fontSize: 22 }}>{t('kb.manualTitle')}</h3>
          <p style={{ color: 'var(--colorTextSecondary)', marginBottom: 24 }}>
            {t('kb.manualIntro')}
          </p>

          {MANUAL_SECTIONS.map((section) => (
            <section
              id={`section-${section.id}`}
              key={section.id}
              className="kb-guide-section"
              style={{ marginBottom: 32, scrollMarginTop: 16 }}
            >
              <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span
                  className="material-symbols-outlined"
                  aria-hidden="true"
                  style={{ fontSize: 28, color: 'var(--colorPrimary)' }}
                >
                  {section.icon}
                </span>
                <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{section.title}</h4>
              </header>
              <p style={{ color: 'var(--colorTextSecondary)', lineHeight: 1.6, marginTop: 0 }}>{section.intro}</p>

              <ol style={{ paddingLeft: 22, margin: '12px 0', lineHeight: 1.7 }}>
                {section.steps.map((step, idx) => (
                  <li key={idx} style={{ marginBottom: 6 }}>{step.text}</li>
                ))}
              </ol>

              {section.tips && section.tips.length > 0 ? (
                <div
                  className="form-message"
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    background: 'color-mix(in srgb, var(--colorPrimary) 6%, var(--colorSurface))',
                    border: '1px solid color-mix(in srgb, var(--colorPrimary) 22%, var(--colorBorder))',
                    borderRadius: 'var(--radiusLg)',
                    padding: '12px 16px',
                  }}
                >
                  <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 20, color: 'var(--colorPrimary)', flexShrink: 0 }}>
                    lightbulb
                  </span>
                  <div>
                    <strong style={{ display: 'block', marginBottom: 4 }}>{t('kb.tips')}</strong>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {section.tips.map((tip, idx) => (
                        <li key={idx}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </section>
          ))}

          <div className="kb-contact-footer">
            <span className="material-symbols-outlined">contact_phone</span>
            <div>
              <strong>{t('kb.needMoreHelp')}</strong>
              <p>
                {t('kb.needMoreHelpDesc')}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <button className="btn-secondary" onClick={() => { toast.show(t('kb.openingFaq'), 'info'); handleNavigate('/faq') }} type="button">
              <span className="material-symbols-outlined" aria-hidden="true">quiz</span>
              {t('kb.viewFaq')}
            </button>
            <button className="btn-primary" onClick={() => { toast.show(t('kb.openingKb'), 'info'); handleNavigate('/kb') }} type="button">
              <span className="material-symbols-outlined" aria-hidden="true">menu_book</span>
              {t('kb.kbButton')}
            </button>
          </div>
        </article>
      </div>
    </div>
  )
}

export default UserManualPage
