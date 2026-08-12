import { kv } from '@vercel/kv';

const ADMIN_SECRET = process.env.ADMIN_RESET_SECRET || 'CHANGE_THIS_TO_A_STRONG_SECRET_NOW';

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

    const { secret, revokeAll } = req.body || {};

    if (secret !== ADMIN_SECRET) {
        return res.status(401).json({ success: false, message: 'غير مصرح' });
    }

    if (revokeAll !== true) {
        return res.status(400).json({
            success: false,
            message: 'لازم تبعت revokeAll: true'
        });
    }

    try {
        const pattern = 'license:*';
        let cursor = '0';
        let revokedCount = 0;
        const revokedKeys = [];

        do {
            const [nextCursor, keys] = await kv.scan(cursor, {
                match: pattern,
                count: 100
            });
            cursor = nextCursor;

            if (keys && keys.length > 0) {
                for (const key of keys) {
                    const record = await kv.get(key);
                    if (record && !record.revoked) {
                        record.revoked = true;
                        await kv.set(key, record);
                        revokedCount++;
                        revokedKeys.push(key);
                    }
                }
            }
        } while (cursor !== '0');

        return res.status(200).json({
            success: true,
            message: `تم إلغاء تفعيل ${revokedCount} مفتاح`,
            revokedCount,
            revokedKeys
        });
    } catch (err) {
        console.error('revoke-licenses.js KV error:', err);
        return res.status(500).json({
            success: false,
            message: 'فشل الاتصال بقاعدة بيانات KV: ' + (err && err.message ? err.message : String(err)),
        });
    }
}