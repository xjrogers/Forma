import { Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: {
        id: string;
        email: string;
        role: string;
        plan: string;
      };
    }
  }
}

export interface AuthRequest extends Request {
  userId: string;
  user: {
    id: string;
    email: string;
    role: string;
    plan: string;
  };
} 