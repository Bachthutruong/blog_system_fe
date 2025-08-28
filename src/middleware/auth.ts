import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

interface AuthRequest extends Request {
  user?: any;
}

export const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid token.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token.' });
  }
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied. Admin role required.' });
    }
    next();
  } catch (error) {
    res.status(403).json({ success: false, error: 'Access denied.' });
  }
};

export const requireEmployee = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!['admin', 'employee'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Access denied. Employee role required.' });
    }
    next();
  } catch (error) {
    res.status(403).json({ success: false, error: 'Access denied.' });
  }
};
