import { kv } from '@vercel/kv';

// قائمة المفاتيح المسموح بها فقط
const VALID_KEYS = ["nlkhjeahfdjhg;lkdjotgmethpomkl;fdjgb;ohgoiejy"];

export default async function handler(req, res) {
    // إعدادات الـ CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(404).json({ status: 'error', message: 'Not Found' });
    }

    const { key, deviceId } = req.body || {};

    if (!key || !deviceId) {
        return res.status(400).json({ status: 'error', message: 'بيانات ناقصة (المفتاح أو معرّف الجهاز)' });
    }

    if (!VALID_KEYS.includes(key)) {
        return res.status(401).json({ status: 'error', message: 'المفتاح غير صحيح' });
    }

    const licenseRecordKey = `license:${key}`;

    // 🛠️ إصلاح: نفس مشكلة trial.js / check-status.js — التقاط أخطاء KV
    // وإرجاع رسالة واضحة بدل 500 صامت.
    try {
        const existing = await kv.get(licenseRecordKey);

        // المفتاح ده مربوط بالفعل بجهاز تاني
        if (existing && existing.deviceId && existing.deviceId !== deviceId) {
            return res.status(403).json({
                status: 'error',
                message: 'تم استخدام هذا المفتاح على جهاز آخر من قبل'
            });
        }

        if (existing && existing.revoked) {
            return res.status(403).json({ status: 'error', message: 'تم إلغاء تفعيل هذا المفتاح' });
        }

        const record = {
            key,
            deviceId,
            activatedAt: existing?.activatedAt || Date.now(),
            revoked: false
        };

        // نخزن السجل بالمفتاح، ونخزن فهرس عكسي بالجهاز عشان نلاقيه بسرعة في check-status
        await kv.set(licenseRecordKey, record);
        await kv.set(`device:${deviceId}`, key);

        return res.status(200).json({ status: 'success' });
    } catch (err) {
        console.error('verify.js KV error:', err);
        return res.status(500).json({
            status: 'error',
            message: 'فشل الاتصال بقاعدة بيانات KV: ' + (err && err.message ? err.message : String(err)),
        });
    }
}
