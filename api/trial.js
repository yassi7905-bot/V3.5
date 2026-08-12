import { kv } from '@vercel/kv';

const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 أيام

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(404).json({ success: false, message: 'Not Found' });
    }

    const { action, deviceId } = req.body || {};

    if (!deviceId || !['start', 'status'].includes(action)) {
        return res.status(400).json({ success: false, message: 'بيانات غير صحيحة' });
    }

    const trialKey = `trial:${deviceId}`;

    // 🛠️ إصلاح: كل نداءات kv كانت بدون try/catch، فأي خطأ من @vercel/kv
    // (غالباً بسبب عدم ربط قاعدة بيانات KV بالمشروع على Vercel، أو غياب
    // متغيرات البيئة KV_REST_API_URL / KV_REST_API_TOKEN) كان يخرج كـ
    // "500 Internal Server Error" بدون أي تفاصيل تساعد على التشخيص.
    // الآن نلتقط الخطأ ونرجّع رسالة واضحة (تظهر في استجابة axios على main.js
    // وفي سجلات Vercel Runtime Logs) بدل 500 صامت.
    try {
        if (action === 'start') {
            const existing = await kv.get(trialKey);
            if (existing) {
                // اتبدأت التجربة قبل كده على نفس الجهاز، منرجعش نبدأ من جديد
                return res.status(200).json({ success: true, alreadyStarted: true });
            }
            const now = Date.now();
            const record = { startedAt: now, expiresAt: now + TRIAL_DURATION_MS };
            await kv.set(trialKey, record);
            return res.status(200).json({ success: true, alreadyStarted: false });
        }

        // action === 'status'
        const record = await kv.get(trialKey);
        if (!record) {
            return res.status(200).json({ expired: false, notStarted: true });
        }

        const remaining = record.expiresAt - Date.now();
        if (remaining <= 0) {
            return res.status(200).json({ expired: true, remaining: 0 });
        }

        return res.status(200).json({ expired: false, remaining });
    } catch (err) {
        console.error('trial.js KV error:', err);
        return res.status(500).json({
            success: false,
            message: 'فشل الاتصال بقاعدة بيانات KV: ' + (err && err.message ? err.message : String(err)),
        });
    }
}
