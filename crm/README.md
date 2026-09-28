# vizaCRM — Supabase bilan (barcha qurilmalarda bir xil)

Ma’lumotlar endi brauzerda emas, **Supabase** bulutida saqlanadi. Kompyuter, telefon yoki boshqa
kompyuterda kiritilgan o‘zgarish boshqa qurilmalarda **sahifani yangilamasdan, shu zahoti** ko‘rinadi.
Kirish faqat email + parol bilan — begona odam ma’lumotlarni ko‘ra olmaydi.

> `.env.local` fayli bo‘lmasa, ilova avvalgidek **namuna rejimida** (faqat brauzerda) ishlaydi.

---

## 1. Supabase loyihasini yaratish (5 daqiqa)

1. <https://supabase.com> → **New project**. Hudud sifatida yaqinroq joyni tanlang (masalan, *Frankfurt*).
2. Chap menyu → **SQL Editor** → **New query** → `supabase/schema.sql` faylidagi hamma matnni qo‘ying → **Run**.
   Jadvallar, xavfsizlik (RLS) va Realtime avtomatik sozlanadi.
3. **Authentication → Sign In / Providers** → *Allow new users to sign up* ni **o‘chiring**
   (shunda begonalar o‘zi ro‘yxatdan o‘ta olmaydi).
4. **Authentication → Users → Add user → Create new user**: xodim uchun email va parol kiriting,
   *Auto Confirm User* ni belgilang. Har bir xodimga alohida hisob oching.
5. **Project Settings → API** (yoki yuqoridagi **Connect** tugmasi) dan ikkita qiymatni oling:
   *Project URL* va *anon / publishable key*.

## 2. Kompyuterda ishga tushirish

```bash
cp .env.example .env.local      # so‘ng ichiga 5-qadamdagi qiymatlarni yozing
npm install
npm run dev                     # http://localhost:5173
```

## 3. Telefondan ham ochish uchun internetga joylash (Vercel, bepul)

1. Loyihani GitHub’ga yuklang (`.env.local` yuklanmaydi — bu to‘g‘ri).
2. <https://vercel.com> → **Add New → Project** → reponi tanlang.
3. **Environment Variables** ga `VITE_SUPABASE_URL` va `VITE_SUPABASE_ANON_KEY` ni qo‘shing → **Deploy**.
4. Berilgan manzilni (masalan `viza-crm.vercel.app`) telefon va boshqa kompyuterlarda oching va login qiling.
   Telefonda brauzer menyusidan **“Bosh ekranga qo‘shish”** ni bossangiz, ilova kabi ochiladi.

## 4. Eski ma’lumotlarni ko‘chirish

Eski ma’lumotlar kompyuteringiz brauzerida turibdi. Ikki usul bor:

- **Avtomatik:** yangi versiyani *o‘sha kompyuterda, o‘sha manzilda* (`npm run dev` → `localhost:5173`) oching va login qiling.
  Bulut bo‘sh bo‘lsa, “Bu qurilmadagi ma’lumotlarni bulutga ko‘chirasizmi?” oynasi chiqadi → **Ha**.
- **Zaxira fayl orqali:** eski versiyada *Sozlamalar → Zaxira nusxasini yuklab olish* → JSON fayl.
  Yangi versiyada *Sozlamalar → Zaxira nusxasidan yuklash* → shu faylni tanlang.

## Qanday ishlaydi

| Nima | Qayerda saqlanadi |
|---|---|
| Mijozlar, navbatlar, to‘lovlar, profil | Supabase (`clients`, `appointments`, `payments`, `app_settings` jadvallari) |
| Tungi/yorug‘ rejim, bildirishnoma belgisi | Har bir qurilmaning o‘zida |
| Biriktirilgan fayllar | Hozircha faqat **fayl nomi** saqlanadi (hujjatning o‘zi yuklanmaydi) |

- Pastki satrda holat ko‘rinadi: 🟢 *Barcha qurilmalarda sinxronlangan*, 🟡 *saqlanmoqda*, 🔴 *internet yo‘q / xato*.
- Telefon uyqudan qaytganda yoki internet tiklanganda ma’lumotlar avtomatik qayta yuklanadi.
- Ikki kishi bir vaqtda **bitta mijozni** tahrirlasa, oxirgi saqlagan kishining o‘zgarishi qoladi.
- Bulut rejimida “Namuna ma’lumotlarini tiklash” tugmasi yashirilgan (haqiqiy bazani o‘chirib yubormaslik uchun).

## Fayllar

- `src/lib/supabase.ts` — Supabase ulanishi
- `src/lib/sync.ts` — ikki tomonlama sinxronlash (yuborish + Realtime + qayta ulanish)
- `src/components/Auth.tsx` — kirish ekrani
- `supabase/schema.sql` — baza sxemasi, RLS va Realtime
- `tests/cloud-sync.mjs` — ikki qurilma (kompyuter + telefon) sinovi: `npm run test:cloud`
