// Authentication middleware using JWT
import crypto from 'crypto';
import { db } from '../db/client.js';
// Simple JWT-like token (for MVP - use proper JWT library in production)
const SECRET = process.env.BRICK_JWT_SECRET || 'brick-dev-secret-change-in-production';
// Create a signed token
export function createToken(userId) {
    const payload = {
        userId,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
        .createHmac('sha256', SECRET)
        .update(data)
        .digest('base64url');
    return `${data}.${signature}`;
}
// Verify and decode token
export function verifyToken(token) {
    try {
        const [data, signature] = token.split('.');
        const expectedSig = crypto
            .createHmac('sha256', SECRET)
            .update(data)
            .digest('base64url');
        if (signature !== expectedSig)
            return null;
        const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
        if (payload.exp < Date.now())
            return null;
        return { userId: payload.userId };
    }
    catch {
        return null;
    }
}
// Hash password
export function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
        .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
        .toString('hex');
    return `${salt}:${hash}`;
}
// Verify password
export function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(':');
    const verify = crypto
        .pbkdf2Sync(password, salt, 10000, 64, 'sha512')
        .toString('hex');
    return hash === verify;
}
// Auth middleware - requires valid token
export async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing authorization token' });
        return;
    }
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (!decoded) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
    }
    const user = await db.getUserById(decoded.userId);
    if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
    }
    req.userId = user.id;
    req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
    };
    next();
}
// Optional auth - populates user if token present, but doesn't require it
export async function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const decoded = verifyToken(token);
        if (decoded) {
            const user = await db.getUserById(decoded.userId);
            if (user) {
                req.userId = user.id;
                req.user = {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                };
            }
        }
    }
    next();
}
//# sourceMappingURL=auth.js.map