import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';

export interface AuthRequest extends Request {
  user?: User;
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const user = await User.findByPk(decoded.id);
    
    if (!user || !user.isActive) {
      return res.status(403).json({ error: 'Invalid or inactive user' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

export const checkConversationLimit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role === 'nutritionist' || req.user.nutritionistId) {
    return next();
  }

  if (req.user.conversationMinutesUsed >= req.user.maxFreeMinutes) {
    return res.status(403).json({ 
      error: 'Free conversation limit reached',
      minutesUsed: req.user.conversationMinutesUsed,
      maxMinutes: req.user.maxFreeMinutes,
    });
  }

  next();
};

export const generateToken = (user: User): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET!,
    {
      expiresIn: '7d',
    }
  );
};

export const generateRefreshToken = (user: User): string => {
  return jwt.sign(
    {
      id: user.id,
      type: 'refresh',
    },
    process.env.JWT_SECRET!,
    {
      expiresIn: '30d',
    }
  );
};