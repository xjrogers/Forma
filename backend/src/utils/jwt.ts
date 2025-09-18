import jwt from 'jsonwebtoken';
import { StringValue } from 'ms';

export const generateToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }
  return jwt.sign({ userId }, secret, { 
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as StringValue 
  });
};

export const generateRefreshToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }
  return jwt.sign({ userId, type: 'refresh' }, secret, { 
    expiresIn: '30d' as StringValue 
  });
}; 