import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(404).json({ isActivated: false, message: 'Not Found' });
    }

    const { deviceId } = req.body || {};

    if (!deviceId) {
        return res.status(400).json({ isActivated: false, message: 'معرّف الجهاز مفقود' });
    }

    // 🛠️ إصلاح: نفس مشكلة trial.js — أي خطأ من @vercel/kv كان يظهر كـ 500
    // بدون رسالة، فيصعب معرفة هل السبب KV غير مربوطة أم مشكلة أخرى.
    try {
        const key = await kv.get(`device:${deviceId}`);
        if (!key) {
            return res.status(200).json({ isActivated: false });
        }

        const record = await kv.get(`license:${key}`);
        if (!record || record.revoked || record.deviceId !== deviceId) {
            return res.status(200).json({ isActivated: false });
        }

        return res.status(200).json({ isActivated: true });
    } catch (err) {
        console.error('check-status.js KV error:', err);
        return res.status(500).json({
            isActivated: false,
            message: 'فشل الاتصال بقاعدة بيانات KV: ' + (err && err.message ? err.message : String(err)),
        });
    }
}
