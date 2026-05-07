# OkU — KTMU дипломун автоматтык форматтоо

> **Слоган:** Баарын бир иретте куруу үчүн.

OkU — Манас университетинин (KTMU) студенттери үчүн дипломдук иштерди расмий
ченемдер боюнча автоматтык форматтоочу коммерциялык платформа. Студент `.docx`
файлын жүктөйт, MBank аркылуу 555 сом төлөйт жана форматталган DOCX же PDF
жүктөп алат.

---

## 1. Айлана-чөйрөнү тууралоо (environment variables)

Долбоор Lovable Cloud (Supabase) аркылуу иштейт. Тиешелүү өзгөрмөлөр
автоматтык түрдө `.env` файлына коюлат — аларды кол менен өзгөртүүнүн
кереги жок:

| Аты | Кайда колдонулат |
| --- | --- |
| `VITE_SUPABASE_URL` | Браузер жагы |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Браузер жагы |
| `SUPABASE_URL` | Сервер фунцкиялары / webhook |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhookто `orders` таблицасын жаңылоо үчүн |
| `MBANK_WEBHOOK_SECRET` | MBankтын HMAC-SHA256 кол тамгасын текшерүү |

`MBANK_WEBHOOK_SECRET` — Lovable → **Cloud → Secrets** бөлүмүндө кошулат.
Кодго эч качан жазылбайт.

---

## 2. MBank webhookту жайгаштыруу

MBank төлөм ийгиликтүү аяктаганда төмөнкү URL'ге `POST` сурам жөнөтөт:

```
POST https://<сиздин-домен>/api/public/webhooks/mbank
Headers:
  Content-Type: application/json
  x-mbank-signature: <hex(hmac_sha256(MBANK_WEBHOOK_SECRET, raw_body))>
Body:
  { "order_id": "<uuid>", "status": "paid", "payment_ref": "<txn id>" }
```

Сурам `src/routes/api/public/webhooks/mbank.ts` файлында иштетилет:

1. `x-mbank-signature` — `MBANK_WEBHOOK_SECRET` менен `crypto.createHmac("sha256", secret)`
   аркылуу салыштырылат (`timingSafeEqual`).
2. Туура болсо, `orders` таблицасында тиешелүү катардын `status` талаасы
   `paid` деп жаңыртылат.
3. Браузердеги Supabase Realtime муну угуп, форматтоо процессин
   автоматтык баштайт.

> Endpoint `/api/public/*` префикси менен жайгашат — бул жолдор
> чыгарылган сайтта аутентификациядан өтпөйт. Коопсуздук толугу менен
> HMAC текшерүүсүндө.

### MBank жагында кантип орнотуу керек

1. MBank кабинетинде **Webhooks** бөлүмүнө кириңиз.
2. URL катары `https://<сиздин-домен>/api/public/webhooks/mbank` көрсөтүңүз.
3. Жашыруун сөздү (`MBANK_WEBHOOK_SECRET`) Lovable Cloudдагы маани менен
   дал келтирип киргизиңиз.

---

## 3. KTMU форматтоо туруктуулары

Бардык эреже `src/lib/ktmu-constants.ts` файлында чогултулган:

```ts
KTMU = {
  paper: "A4",
  margins: { leftCm: 3.5, rightCm: 2.5, topCm: 3.0, bottomCm: 2.5 },
  pageSize: { wTwips: 11906, hTwips: 16838 }, // A4 = 21 × 29.7 см
  romanKeywords: ["БАШ СӨЗ", "АЛГЫ СӨЗ", "ÖN SÖZ", "PREFACE"],
  arabicKeywords: ["КЫСКАЧА МАЗМУНУ", "ÖZET", "SUMMARY"],
}
```

Чечмелөө:

- **Кагаз:** A4 (21 × 29.7 см) — DOCX форматында "twips" бирдигинде:
  `1 см = 567 twips`.
- **Талаалар:** сол **3.5 см**, оң **2.5 см**, үстү **3.0 см**, асты **2.5 см**.
- **Нумерация логикасы** (`src/lib/docx-format.ts`):
  - Документтин башынан тартып биринчи негизги сөздү тапкан жерге чейин —
    **титулдук бөлүм**, бет номерлери жок (`<w:pgNumType>` жок).
  - Абзац ичинде `БАШ СӨЗ`, `АЛГЫ СӨЗ`, `ÖN SÖZ` же `PREFACE` сөздөрү
    табылса — жаңы бөлүм ачылат: **рим сандар** (`i, ii, iii…`),
    `<w:pgNumType w:fmt="lowerRoman" w:start="1"/>`.
  - `КЫСКАЧА МАЗМУНУ`, `ÖZET` же `SUMMARY` сөздөрү табылса — кайра жаңы
    бөлүм: **араб сандар** "1"ден баштап,
    `<w:pgNumType w:fmt="decimal" w:start="1"/>`.

Форматтоо процесси `.docx` ZIPти `pizzip` менен ачып, `word/document.xml`ге
түз патч коёт — стилдер, сүрөттөр, таблицалар сакталат, бир гана `<w:sectPr>`
бөлүмдөрү алмаштырылат.

---

## 4. Локалдык иштетүү

```bash
bun install
bun run dev
```

Локалдык режимде Supabase автоматтык туташат. MBank webhookту локалдык
тестирлөө үчүн интерфейстеги **«DEV: Төлөмдү симуляциялоо»** баскычын
колдонсо болот.

---

## 5. GitHub'ка экспорт

Долбоордун булактары толугу менен жеке (private) GitHub репозиторийге
жайгаштырууга даяр. Lovable интерфейсинде **GitHub → Connect project**
аркылуу туташтырыңыз.
