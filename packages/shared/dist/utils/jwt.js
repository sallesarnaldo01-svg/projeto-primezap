import jwt from 'jsonwebtoken';
export const signJwt = (payload, options) => {
    const { secret, expiresIn, ...rest } = options;
    const signOptions = {
        ...rest,
        ...(expiresIn !== undefined ? { expiresIn } : {}),
    };
    return jwt.sign(payload, secret, signOptions);
};
export const verifyJwt = (token, secret, options) => jwt.verify(token, secret, options);
