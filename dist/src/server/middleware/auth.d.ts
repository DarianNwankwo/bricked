import type { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    userId?: string;
    user?: {
        id: string;
        email: string;
        name: string;
    };
}
export declare function createToken(userId: string): string;
export declare function verifyToken(token: string): {
    userId: string;
} | null;
export declare function hashPassword(password: string): string;
export declare function verifyPassword(password: string, stored: string): boolean;
export declare function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
export declare function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.d.ts.map