-- iSehat seed data for Cloudflare D1 / SQLite
-- Target existing database: multi_Ai_db
-- This file is idempotent and safe to run repeatedly.
-- Naming rules:
-- - Table names use HL_ prefix
-- - Field names use camelCase
-- - Original images are not stored; only final compressed watermarked attachments are stored in R2

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------
-- System Configurations
-- ---------------------------------------------------------
INSERT OR IGNORE INTO HL_systemConfigs (configKey, configValue, dataType, description)
VALUES 
('aiExtractTimeoutMs', '5000', 'number', 'Timeout in milliseconds for AI Vision extraction'),
('aiVisionModel', '@cf/meta/llama-3.2-11b-vision-instruct', 'string', 'Cloudflare Workers AI vision model used for device display extraction'),
('aiTextEndpoint', 'https://9router.krpmerch.biz.id/v1', 'string', 'OpenAI-compatible text AI base URL'),
('aiTextModels', '["oc/deepseek-v4-flash-free","oc/mimo-v2.5-free","openrouter/poolside/laguna-m.1:free"]', 'json', 'Ordered text AI model fallback list'),
('aiTextDefaultModel', 'oc/deepseek-v4-flash-free', 'string', 'Default text AI model for assistant and recommendations'),
('aiTextApiKey', '', 'string', 'Optional API key for OpenAI-compatible text AI endpoint'),
('maxUploadSizeBytes', '2097152', 'number', 'Maximum file size for uploads in bytes (default 2MB)'),
('loginRateLimitMaxReq', '10', 'number', 'Max login requests per window'),
('loginRateLimitWindowMin', '10', 'number', 'Login rate limit window in minutes'),
('ocrRateLimitMax', '10', 'number', 'Maximum AI vision extraction requests per user per OCR rate-limit window'),
('ocrRateLimitWindowMin', '5', 'number', 'OCR rate-limit window in minutes'),
('telegramBotToken', '', 'string', 'Telegram bot token managed from system config; leave empty until regenerated in BotFather'),
('telegramBotActive', 'true', 'boolean', 'Global toggle to enable/disable Telegram bot notifications'),
('aiVisionUseCustomEndpoint', 'false', 'boolean', 'When true, uses aiTextEndpoint for vision extraction instead of Cloudflare Workers AI');

-- Devices

-- Devices (generic names — no brand-specific labels)
INSERT OR IGNORE INTO HL_devices (deviceCode, deviceName, deviceType, brand, model, aiPromptKey, active)
VALUES
('yuwellYx106','Oximeter','oximeter','Generic','Pulse Oximeter','oximeter',1),
('omronHem7194t1fl','Tensimeter','bloodPressure','Generic','Digital Blood Pressure Monitor','bloodPressure',1),
('sinocareM101','Alat Tes GCU 3-in-1','gcu','Generic','GCU 3-in-1 Meter','sinocareGcu',1),
('thermometer','Termometer','thermometer','Generic','Thermometer','thermometer',1),
('bodyScale','Timbangan Badan','bodyScale','Generic','Body Scale','bodyScale',1),
('sleepTracker','Jam Tidur','sleepTracker','Generic','Sleep Tracker','sleepTracker',1);

-- Metric catalog

INSERT OR IGNORE INTO HL_metricCatalog
(metricCode, metricName, category, unit, inputType, requiresAttachment, requiresSex, requiresFasting, isCalculated, physicalMin, physicalMax, sortOrder, active)
VALUES
('spo2','Saturasi Oksigen','Oksigen','%','mixed',1,0,0,0,0,100,10,1),
('heartRate','Denyut Jantung','Detak Jantung','bpm','mixed',1,0,0,0,20,250,20,1),
('systolic','Tekanan Sistolik','Tekanan Darah','mmHg','mixed',1,0,0,0,50,300,30,1),
('diastolic','Tekanan Diastolik','Tekanan Darah','mmHg','mixed',1,0,0,0,30,200,40,1),
('bloodPressurePulse','Pulse Tensimeter','Tekanan Darah','bpm','mixed',1,0,0,0,20,250,50,1),
('glucoseFasting','Gula Darah Puasa','Metabolisme Glukosa','mg/dL','mixed',1,0,1,0,20,600,60,1),
('glucosePostMeal','Gula Darah 2 Jam PP','Metabolisme Glukosa','mg/dL','mixed',1,0,0,0,20,600,70,1),
('cholesterolTotal','Kolesterol Total','Profil Lipid','mg/dL','mixed',1,0,1,0,50,600,80,1),
('uricAcid','Asam Urat','Metabolisme Purin','mg/dL','mixed',1,1,0,0,0,20,90,1),
('bodyWeight','Berat Badan','Komposisi Tubuh','kg','mixed',1,0,0,0,1,300,100,1),
('bmi','Body Mass Index','Komposisi Tubuh','index','calculated',0,0,0,1,0,100,110,1),
('waistCircumference','Lingkar Perut','Komposisi Tubuh','cm','mixed',0,1,0,0,20,300,120,1),
('bodyTemperature','Suhu Tubuh','Suhu Tubuh','°C','mixed',1,0,0,0,30,45,130,1),
('sleepDuration','Durasi Tidur','Tidur','hour','manual',0,0,0,0,0,24,140,1),
('height','Tinggi Badan','Profil','cm','manual',0,0,0,0,30,250,150,1);

-- Device metrics

INSERT OR IGNORE INTO HL_deviceMetrics (deviceCode, metricCode, requiredMetric, sortOrder, active)
VALUES
('yuwellYx106','spo2',1,10,1),
('yuwellYx106','heartRate',1,20,1),
('omronHem7194t1fl','systolic',1,10,1),
('omronHem7194t1fl','diastolic',1,20,1),
('omronHem7194t1fl','bloodPressurePulse',1,30,1),
('sinocareM101','glucoseFasting',0,10,1),
('sinocareM101','glucosePostMeal',0,20,1),
('sinocareM101','cholesterolTotal',0,30,1),
('sinocareM101','uricAcid',0,40,1),
('thermometer','bodyTemperature',1,10,1),
('bodyScale','bodyWeight',1,10,1),
('bodyScale','bmi',0,20,1),
('bodyScale','waistCircumference',0,30,1),
('sleepTracker','sleepDuration',0,10,1);

-- Metric rules

INSERT OR IGNORE INTO HL_metricRules
(ruleCode, metricCode, sex, ageMin, ageMax, minValue, maxValue, unit, status, severity, popupTitle, popupMessage, recommendation, sourceLabel, emergencyLevel, rulePriority, active)
VALUES
('rule-spo2-normal','spo2','all',0,200,95,100,'%','Normal','normal','SpO2 Normal','Saturasi oksigen berada dalam rentang umum normal.','Pertahankan aktivitas ringan, pola napas baik, dan cek ulang sesuai kebutuhan.','CSV internal + clinical common threshold','none',10,1),
('rule-spo2-mild','spo2','all',0,200,90,94.9,'%','Hipoksemia Ringan','warning','SpO2 Agak Rendah','Saturasi oksigen agak rendah.','Istirahat, cek ulang posisi alat, hangatkan jari, dan ulangi pengukuran. Jika disertai sesak, hubungi tenaga medis.','CSV internal + clinical common threshold','watch',20,1),
('rule-spo2-severe','spo2','all',0,200,0,89.9,'%','Hipoksemia Berat','emergency','SpO2 Sangat Rendah','Saturasi oksigen berada pada nilai kritis.','Segera cek ulang. Jika ada sesak, nyeri dada, bibir kebiruan, kebingungan, atau lemas berat, cari bantuan medis darurat.','CSV internal + clinical common threshold','emergency',1,1),

('rule-heart-normal','heartRate','all',0,200,60,100,'bpm','Normal','normal','Denyut Jantung Normal','Denyut jantung berada dalam rentang umum normal saat istirahat.','Pertahankan pola aktivitas dan istirahat yang baik.','CSV internal','none',10,1),
('rule-heart-low','heartRate','all',0,200,20,59.9,'bpm','Bradikardia','warning','Denyut Jantung Rendah','Denyut jantung lebih rendah dari rentang umum.','Ulangi pengukuran saat duduk tenang. Jika pusing, lemas, nyeri dada, atau sesak, hubungi tenaga medis.','CSV internal','watch',20,1),
('rule-heart-high','heartRate','all',0,200,100.1,250,'bpm','Takikardia','warning','Denyut Jantung Cepat','Denyut jantung lebih cepat dari rentang umum saat istirahat.','Duduk santai, tenangkan diri, dan cek ulang. Jika berlanjut atau ada gejala, konsultasikan ke dokter.','CSV internal','watch',20,1),

('rule-sys-normal','systolic','all',0,200,90,119.9,'mmHg','Normal','normal','Sistolik Normal','Tekanan darah sistolik berada dalam rentang baik.','Pertahankan pola makan, aktivitas fisik, dan tidur yang cukup.','CSV internal + AHA/WHO reference','none',10,1),
('rule-sys-pre','systolic','all',0,200,120,129.9,'mmHg','Pra-Hipertensi','warning','Sistolik Mulai Meningkat','Tekanan sistolik mulai meningkat.','Batasi garam, kelola stres, dan biasakan aktivitas fisik ringan.','CSV internal + AHA reference','watch',20,1),
('rule-sys-stage1','systolic','all',0,200,130,139.9,'mmHg','Hipertensi Tahap 1','high','Sistolik Tinggi','Tekanan sistolik masuk kategori tinggi.','Ulangi pengukuran setelah istirahat. Jika sering tinggi, konsultasikan ke dokter.','CSV internal + AHA reference','watch',30,1),
('rule-sys-stage2','systolic','all',0,200,140,179.9,'mmHg','Hipertensi Tahap 2','high','Sistolik Sangat Tinggi','Tekanan sistolik tinggi dan perlu perhatian.','Ulangi pengukuran. Jika sering tinggi, buat janji evaluasi dengan dokter.','CSV internal + WHO/AHA reference','urgent',40,1),
('rule-sys-crisis','systolic','all',0,200,180,300,'mmHg','Krisis Hipertensi','emergency','Sistolik Kritis','Tekanan sistolik berada pada rentang krisis.','Cek ulang setelah istirahat. Jika tetap tinggi atau ada nyeri dada, sesak, kelemahan, bicara pelo, atau sakit kepala berat, segera cari bantuan medis.','CSV internal + AHA severe hypertension threshold','emergency',1,1),

('rule-dia-normal','diastolic','all',0,200,60,79.9,'mmHg','Normal','normal','Diastolik Normal','Tekanan darah diastolik berada dalam rentang baik.','Pertahankan gaya hidup sehat dan ukur rutin.','CSV internal + AHA/WHO reference','none',10,1),
('rule-dia-stage1','diastolic','all',0,200,80,89.9,'mmHg','Hipertensi Tahap 1','high','Diastolik Tinggi','Tekanan diastolik masuk kategori tinggi.','Kurangi stres, batasi garam, dan konsultasikan jika sering tinggi.','CSV internal + AHA reference','watch',30,1),
('rule-dia-stage2','diastolic','all',0,200,90,119.9,'mmHg','Hipertensi Tahap 2','high','Diastolik Sangat Tinggi','Tekanan diastolik tinggi dan perlu perhatian.','Ulangi pengukuran dan konsultasikan jika berulang.','CSV internal + WHO/AHA reference','urgent',40,1),
('rule-dia-crisis','diastolic','all',0,200,120,200,'mmHg','Krisis Hipertensi','emergency','Diastolik Kritis','Tekanan diastolik berada pada rentang krisis.','Cek ulang setelah istirahat. Jika tetap tinggi atau ada gejala berat, segera cari bantuan medis.','CSV internal + AHA severe hypertension threshold','emergency',1,1),

('rule-gfp-low','glucoseFasting','all',0,200,20,69.9,'mg/dL','Rendah','critical','Gula Darah Puasa Rendah','Gula darah puasa rendah.','Jika ada gemetar, berkeringat, lemas, atau bingung, segera ikuti arahan medis untuk hipoglikemia dan cari bantuan bila memburuk.','CSV internal + ADA reference','urgent',1,1),
('rule-gfp-normal','glucoseFasting','all',0,200,70,99.9,'mg/dL','Normal','normal','Gula Darah Puasa Normal','Gula darah puasa berada dalam rentang normal.','Pertahankan pola makan seimbang dan aktivitas fisik.','CSV internal + ADA reference','none',10,1),
('rule-gfp-prediabetes','glucoseFasting','all',0,200,100,125.9,'mg/dL','Prediabetes','warning','Gula Darah Puasa Prediabetes','Gula darah puasa berada pada rentang prediabetes.','Kurangi gula dan karbohidrat sederhana, tingkatkan aktivitas fisik, dan konsultasikan jika berulang.','CSV internal + ADA reference','watch',20,1),
('rule-gfp-high','glucoseFasting','all',0,200,126,600,'mg/dL','Tinggi','high','Gula Darah Puasa Tinggi','Gula darah puasa tinggi.','Catat hasil, cek ulang sesuai prosedur, dan konsultasikan ke dokter untuk evaluasi.','CSV internal + ADA reference','urgent',30,1),

('rule-gpp-low','glucosePostMeal','all',0,200,20,69.9,'mg/dL','Rendah','critical','Gula Darah 2 Jam PP Rendah','Gula darah 2 jam setelah makan rendah.','Jika ada gejala hipoglikemia, cari bantuan dan ikuti arahan medis.','ADA/common clinical reference','urgent',1,1),
('rule-gpp-normal','glucosePostMeal','all',0,200,70,139.9,'mg/dL','Normal','normal','Gula Darah 2 Jam PP Normal','Gula darah 2 jam setelah makan berada dalam rentang umum normal.','Pertahankan pola makan seimbang.','ADA/common clinical reference','none',10,1),
('rule-gpp-impaired','glucosePostMeal','all',0,200,140,199.9,'mg/dL','Toleransi Glukosa Terganggu','warning','Gula Darah 2 Jam PP Meningkat','Gula darah setelah makan meningkat.','Kurangi porsi gula dan karbohidrat sederhana, serta konsultasikan jika sering terjadi.','ADA/common clinical reference','watch',20,1),
('rule-gpp-high','glucosePostMeal','all',0,200,200,600,'mg/dL','Tinggi','high','Gula Darah 2 Jam PP Tinggi','Gula darah 2 jam setelah makan tinggi.','Catat hasil dan konsultasikan ke dokter untuk evaluasi.','ADA/common clinical reference','urgent',30,1),

('rule-chol-optimal','cholesterolTotal','all',0,200,50,199.9,'mg/dL','Optimal','normal','Kolesterol Optimal','Kolesterol total berada dalam batas desirable.','Pertahankan pola makan seimbang dan aktivitas fisik.','CSV internal + MedlinePlus','none',10,1),
('rule-chol-border','cholesterolTotal','all',0,200,200,239.9,'mg/dL','Batas Tinggi','warning','Kolesterol Batas Tinggi','Kolesterol total berada pada batas tinggi.','Kurangi gorengan, lemak jenuh, santan berlebih, dan tingkatkan aktivitas fisik.','CSV internal + MedlinePlus','watch',20,1),
('rule-chol-high','cholesterolTotal','all',0,200,240,600,'mg/dL','Tinggi','high','Kolesterol Tinggi','Kolesterol total tinggi dan bisa meningkatkan risiko kardiovaskular.','Konsultasikan ke dokter untuk evaluasi faktor risiko dan rencana perbaikan.','CSV internal + MedlinePlus','urgent',30,1),

('rule-uric-male-low','uricAcid','male',0,200,0,3.3,'mg/dL','Rendah','info','Asam Urat Rendah','Asam urat berada di bawah rentang referensi pria.','Catat hasil dan konsultasikan jika ada keluhan atau hasil berulang rendah.','CSV internal + lab reference configurable','none',20,1),
('rule-uric-male-normal','uricAcid','male',0,200,3.4,7,'mg/dL','Normal','normal','Asam Urat Normal','Asam urat berada dalam rentang referensi pria.','Pertahankan hidrasi dan pola makan seimbang.','CSV internal + lab reference configurable','none',10,1),
('rule-uric-male-high','uricAcid','male',0,200,7.1,20,'mg/dL','Tinggi','warning','Asam Urat Tinggi','Asam urat berada di atas rentang referensi pria.','Kurangi makanan tinggi purin seperti jeroan, seafood tertentu, dan emping. Konsultasikan jika nyeri sendi atau berulang tinggi.','CSV internal + lab reference configurable','watch',30,1),
('rule-uric-female-low','uricAcid','female',0,200,0,2.3,'mg/dL','Rendah','info','Asam Urat Rendah','Asam urat berada di bawah rentang referensi wanita.','Catat hasil dan konsultasikan jika ada keluhan atau hasil berulang rendah.','CSV internal + lab reference configurable','none',20,1),
('rule-uric-female-normal','uricAcid','female',0,200,2.4,6,'mg/dL','Normal','normal','Asam Urat Normal','Asam urat berada dalam rentang referensi wanita.','Pertahankan hidrasi dan pola makan seimbang.','CSV internal + lab reference configurable','none',10,1),
('rule-uric-female-high','uricAcid','female',0,200,6.1,20,'mg/dL','Tinggi','warning','Asam Urat Tinggi','Asam urat berada di atas rentang referensi wanita.','Kurangi makanan tinggi purin seperti jeroan, seafood tertentu, dan emping. Konsultasikan jika nyeri sendi atau berulang tinggi.','CSV internal + lab reference configurable','watch',30,1),
('rule-uric-other-normal','uricAcid','other',0,200,2.4,7,'mg/dL','Perlu Referensi Individual','info','Asam Urat Perlu Interpretasi Individual','Interpretasi asam urat bisa berbeda menurut referensi lab dan kondisi individu.','Gunakan rentang rujukan lab atau konsultasikan ke tenaga medis.','Configurable lab reference','none',40,1),

('rule-bmi-under','bmi','all',0,200,0,18.4,'index','Underweight','warning','BMI Rendah','BMI berada di bawah rentang normal.','Tingkatkan asupan nutrisi seimbang dan konsultasikan jika berat turun tanpa sebab jelas.','CSV internal + WHO/CDC category','watch',20,1),
('rule-bmi-normal','bmi','all',0,200,18.5,24.9,'index','Normal','normal','BMI Normal','BMI berada dalam rentang normal.','Pertahankan pola makan dan aktivitas fisik.','CSV internal + WHO/CDC category','none',10,1),
('rule-bmi-over','bmi','all',0,200,25,29.9,'index','Overweight','warning','BMI Overweight','BMI berada pada kategori berat badan berlebih.','Atur porsi makan, kurangi kalori berlebih, dan tingkatkan aktivitas fisik bertahap.','CSV internal + WHO/CDC category','watch',30,1),
('rule-bmi-obese','bmi','all',0,200,30,100,'index','Obesitas','high','BMI Obesitas','BMI berada pada kategori obesitas.','Pertimbangkan program penurunan berat badan yang aman dan konsultasikan dengan tenaga medis.','CSV internal + WHO/CDC category','watch',40,1),

('rule-waist-male-low','waistCircumference','male',0,200,20,93.9,'cm','Risiko Rendah','normal','Lingkar Perut Risiko Rendah','Lingkar perut berada pada kategori risiko rendah untuk pria.','Pertahankan pola makan dan aktivitas fisik.','WHO waist circumference cutoff','none',10,1),
('rule-waist-male-inc','waistCircumference','male',0,200,94,102,'cm','Risiko Meningkat','warning','Lingkar Perut Meningkat','Lingkar perut meningkat untuk pria.','Mulai kendalikan porsi makan, aktivitas fisik, dan berat badan.','WHO waist circumference cutoff','watch',20,1),
('rule-waist-male-high','waistCircumference','male',0,200,102.1,300,'cm','Risiko Sangat Meningkat','high','Lingkar Perut Sangat Meningkat','Lingkar perut berada pada kategori risiko sangat meningkat untuk pria.','Fokus pada penurunan lemak perut secara bertahap dan konsultasikan jika ada faktor risiko lain.','WHO waist circumference cutoff','watch',30,1),
('rule-waist-female-low','waistCircumference','female',0,200,20,79.9,'cm','Risiko Rendah','normal','Lingkar Perut Risiko Rendah','Lingkar perut berada pada kategori risiko rendah untuk wanita.','Pertahankan pola makan dan aktivitas fisik.','WHO waist circumference cutoff','none',10,1),
('rule-waist-female-inc','waistCircumference','female',0,200,80,88,'cm','Risiko Meningkat','warning','Lingkar Perut Meningkat','Lingkar perut meningkat untuk wanita.','Mulai kendalikan porsi makan, aktivitas fisik, dan berat badan.','WHO waist circumference cutoff','watch',20,1),
('rule-waist-female-high','waistCircumference','female',0,200,88.1,300,'cm','Risiko Sangat Meningkat','high','Lingkar Perut Sangat Meningkat','Lingkar perut berada pada kategori risiko sangat meningkat untuk wanita.','Fokus pada penurunan lemak perut secara bertahap dan konsultasikan jika ada faktor risiko lain.','WHO waist circumference cutoff','watch',30,1),

('rule-temp-low','bodyTemperature','all',0,200,30,34.9,'°C','Sangat Rendah','emergency','Suhu Tubuh Sangat Rendah','Suhu tubuh sangat rendah dan perlu perhatian segera.','Hangatkan tubuh dan cari bantuan medis, terutama jika menggigil berat, lemas, bingung, atau tidak sadar.','Clinical fever/hypothermia threshold','emergency',1,1),
('rule-temp-normal','bodyTemperature','all',0,200,35,37.4,'°C','Normal','normal','Suhu Tubuh Normal','Suhu tubuh berada pada rentang umum normal.','Pertahankan hidrasi dan istirahat cukup.','Clinical common threshold','none',10,1),
('rule-temp-raised','bodyTemperature','all',0,200,37.5,37.9,'°C','Meningkat','warning','Suhu Tubuh Meningkat','Suhu tubuh sedikit meningkat.','Pantau ulang, cukup minum, dan istirahat.','Clinical common threshold','watch',20,1),
('rule-temp-fever','bodyTemperature','all',0,200,38,38.9,'°C','Demam','high','Demam','Suhu tubuh masuk kategori demam.','Istirahat, cukup cairan, dan konsultasikan jika demam berlanjut atau ada gejala berat.','CDC fever threshold','urgent',30,1),
('rule-temp-highfever','bodyTemperature','all',0,200,39,45,'°C','Demam Tinggi','critical','Demam Tinggi','Suhu tubuh tinggi dan perlu perhatian.','Pantau ketat dan cari bantuan medis jika disertai sesak, bingung, kejang, lemas berat, atau tidak membaik.','Clinical common threshold','urgent',40,1),

('rule-sleep-low','sleepDuration','all',0,200,0,5.9,'hour','Kurang','warning','Durasi Tidur Kurang','Durasi tidur kurang dari kebutuhan umum dewasa.','Usahakan jadwal tidur konsisten dan kurangi layar sebelum tidur.','CDC sleep duration recommendation','watch',20,1),
('rule-sleep-near','sleepDuration','all',0,200,6,6.9,'hour','Hampir Cukup','info','Durasi Tidur Hampir Cukup','Durasi tidur mendekati rekomendasi minimal dewasa.','Coba tambah durasi tidur secara bertahap hingga minimal 7 jam jika memungkinkan.','CDC sleep duration recommendation','none',15,1),
('rule-sleep-normal','sleepDuration','all',0,200,7,9,'hour','Cukup','normal','Durasi Tidur Cukup','Durasi tidur berada dalam rentang umum yang direkomendasikan untuk dewasa.','Pertahankan kebiasaan tidur konsisten.','CDC sleep duration recommendation','none',10,1),
('rule-sleep-long','sleepDuration','all',0,200,9.1,24,'hour','Terlalu Lama','info','Durasi Tidur Panjang','Durasi tidur lebih panjang dari rentang umum.','Catat apakah ada kelelahan berlebih atau kualitas tidur buruk. Konsultasikan jika sering terjadi.','CDC sleep duration recommendation','watch',30,1),

('rule-bw-under','bodyWeight','all',0,200,1,39.9,'kg','Sangat Rendah','warning','Berat Badan Sangat Rendah','Berat badan berada di bawah rentang umum.','Tingkatkan asupan nutrisi dan konsultasikan ke tenaga medis jika penurunan berat badan tidak direncanakan.','Clinical common threshold','watch',20,1),
('rule-bw-normal','bodyWeight','all',0,200,40,120,'kg','Normal','normal','Berat Badan Tercatat','Berat badan berada dalam rentang umum.','Pantau berat badan secara rutin dan pertahankan pola makan seimbang.','General reference','none',10,1),
('rule-bw-high','bodyWeight','all',0,200,120.1,300,'kg','Sangat Tinggi','warning','Berat Badan Sangat Tinggi','Berat badan berada di atas rentang umum.','Konsultasikan ke tenaga medis untuk evaluasi dan program penurunan berat badan yang aman.','Clinical common threshold','watch',30,1),

('rule-bppulse-low','bloodPressurePulse','all',0,200,20,59.9,'bpm','Bradikardia','warning','Pulse Tensimeter Rendah','Pulse dari tensimeter lebih rendah dari rentang umum.','Ulangi pengukuran saat duduk tenang. Jika pusing atau lemas, hubungi tenaga medis.','CSV internal','watch',20,1),
('rule-bppulse-normal','bloodPressurePulse','all',0,200,60,100,'bpm','Normal','normal','Pulse Tensimeter Normal','Pulse dari tensimeter berada dalam rentang normal.','Pertahankan pola aktivitas dan istirahat yang baik.','CSV internal','none',10,1),
('rule-bppulse-high','bloodPressurePulse','all',0,200,100.1,250,'bpm','Takikardia','warning','Pulse Tensimeter Cepat','Pulse dari tensimeter lebih cepat dari rentang umum.','Duduk santai dan cek ulang. Jika berlanjut, konsultasikan ke dokter.','CSV internal','watch',20,1);

-- Badges

INSERT OR IGNORE INTO HL_badges (badgeCode, badgeName, description, icon, active)
VALUES
('threeDayConsistent','3 Hari Konsisten','Mencatat pengukuran minimal 3 hari berturut-turut.','calendarCheck',1),
('sevenDayConsistent','7 Hari Konsisten','Mencatat pengukuran minimal 7 hari berturut-turut.','flame',1),
('thirtyDayConsistent','30 Hari Konsisten','Mencatat pengukuran minimal 30 hari berturut-turut.','trophy',1),
('doctorReportReady','Report Dokter Dibuat','Berhasil membuat Doctor Ready PDF.','fileText',1),
('medicationWeekComplete','Obat Rutin 7 Hari','Mencatat konsumsi obat selama 7 hari.','pill',1),
('sleepWeekGood','Tidur Cukup 7 Hari','Mencatat tidur cukup selama 7 hari.','moon',1);

-- Knowledge base

INSERT OR IGNORE INTO HL_knowledgeArticles (slug, title, category, contentMarkdown, sortOrder, active)
VALUES
('yuwell-yx106','Panduan Yuwell YX106 Oximeter','device','## Yuwell YX106 Oximeter\n\nGunakan pada jari yang bersih dan hangat. Tunggu angka stabil sebelum difoto. Hindari pantulan cahaya dan pastikan layar terlihat jelas.\n\n### Tips Foto\n\n- Foto dari atas layar.\n- Pastikan angka merah terlihat tajam.\n- Jangan menutup layar dengan jari.\n- Jika AI gagal, input manual.',10,1),
('omron-hem7194t1fl','Panduan OMRON HEM 7194 T1 FL','device','## OMRON HEM 7194 T1 FL\n\nDuduk tenang 5 menit, pasang manset dengan benar, dan ukur di posisi lengan sejajar jantung. Foto layar setelah hasil stabil.\n\n### Data yang Dibaca\n\n- SYS / Sistolik\n- DIA / Diastolik\n- Pulse / bpm',20,1),
('sinocare-m101','Panduan Sinocare M101 GCU','device','## Sinocare M101 GCU\n\nPilih mode test yang benar sebelum input: gula darah, kolesterol, atau asam urat. Untuk gula darah puasa, catat status puasa.\n\n### Catatan\n\nAI tidak boleh menebak jenis test. User wajib memilih metric terlebih dahulu.',30,1),
('thermometer','Panduan Termometer','device','## Termometer\n\nPastikan alat bersih dan ikuti instruksi penggunaan alat. Foto layar saat angka sudah stabil.\n\nSuhu tubuh 38°C atau lebih umumnya masuk kategori demam.',40,1),
('body-scale','Panduan Timbangan Badan','device','## Timbangan Badan\n\nTimbang pada permukaan datar. Usahakan waktu timbang konsisten, misalnya pagi setelah bangun. BMI dihitung otomatis dari berat dan tinggi badan.',50,1),
('waist-circumference','Panduan Lingkar Perut','metric','## Lingkar Perut\n\nUkur di area perut sesuai instruksi, jangan menahan napas, dan gunakan pita ukur yang tidak terlalu ketat. Lingkar perut membantu memantau risiko obesitas sentral.',60,1),
('sleep-duration','Panduan Durasi Tidur','metric','## Durasi Tidur\n\nCatat total jam tidur malam. Untuk dewasa, durasi sekitar 7–9 jam umumnya dianggap cukup. Gunakan data ini untuk melihat pola dengan tekanan darah dan gula darah.',70,1),
('health-disclaimer','Disclaimer Kesehatan','safety','## Disclaimer\n\nAplikasi ini membantu pencatatan dan edukasi. Hasil tidak menggantikan diagnosis dokter. Selalu verifikasi angka alat dan konsultasikan ke tenaga medis bila ada keluhan.',100,1);

INSERT OR IGNORE INTO HL_schemaMigrations (migrationName)
VALUES ('20260620DefaultSeedData');
