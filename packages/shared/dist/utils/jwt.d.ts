import { Secret, SignOptions, VerifyOptions } from 'jsonwebtoken';
export interface SignJwtOptions extends Omit<SignOptions, 'expiresIn'> {
    secret: Secret;
    expiresIn?: string | number;
}
export declare const signJwt: <T extends object>(payload: T, options: SignJwtOptions) => string;
export declare const verifyJwt: <T>(token: string, secret: Secret, options?: VerifyOptions) => T;
//# sourceMappingURL=jwt.d.ts.map