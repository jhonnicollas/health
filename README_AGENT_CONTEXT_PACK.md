# Sprint 5 Compact Agent Context Pack

Isi paket:

```text
AGENTS.md
HANDOFF.md
WORK_LOG.md
```

Tujuan:

```text
- Mengurangi konteks yang harus dibaca agent AI.
- Mencegah halusinasi table/endpoint/permission.
- Menjaga agent tetap 1 task per cycle.
- Membuat pekerjaan bisa dilanjutkan setelah timeout/token habis.
- Mencegah kebocoran secret/token/API key/log sensitif.
```

Cara pakai:

```text
1. Backup AGENTS.md/HANDOFF.md/WORK_LOG.md lama jika masih dibutuhkan.
2. Copy 3 file ini ke root project.
3. Jalankan agent dengan prompt resume dari AGENTS.md.
4. Agent mulai dari HANDOFF.md Current Task.
```

File ini tidak menggantikan PRD/API/SQL/Test Plan. File ini hanya aturan eksekusi compact.
