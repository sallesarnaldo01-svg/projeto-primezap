import jwt, { Secret, SignOptions, VerifyOptions } from 'jsonwebtoken';

export interface SignJwtOptions extends Omit<SignOptions, 'expiresIn'> {
  secret: Secret;
  expiresIn?: string | number;
}

export const signJwt = <T extends object>(payload: T, options: SignJwtOptions) => {
  const { secret, expiresIn, ...rest } = options;
  const signOptions = {
    ...rest,
    ...(expiresIn !== undefined ? { expiresIn } : {}),
  } as SignOptions;
  return jwt.sign(payload, secret, signOptions);
};

export const verifyJwt = <T>(token: string, secret: Secret, options?: VerifyOptions): T =>
  jwt.verify(token, secret, options) as T;
