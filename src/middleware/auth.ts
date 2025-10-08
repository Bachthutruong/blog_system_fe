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
      return res.status(401).json({ success: false, error: '拒絕存取：未提供權杖' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ success: false, error: '無效的權杖' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: '無效的權杖' });
  }
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '拒絕存取：需要管理員身分' });
    }
    next();
  } catch (error) {
    res.status(403).json({ success: false, error: '拒絕存取' });
  }
};

export const requireEmployee = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!['admin', 'employee'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: '拒絕存取：需要員工身分' });
    }
    next();
  } catch (error) {
    res.status(403).json({ success: false, error: '拒絕存取' });
  }
};
