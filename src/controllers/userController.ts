import { Request, Response } from 'express';
import { User } from '../models/User';

interface AuthRequest extends Request {
  user?: any;
}

export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '伺服器內部錯誤'
    });
  }
};

export const createUserByAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const { username, email, password, role } = req.body as {
      username: string;
      email: string;
      password: string;
      role: 'admin' | 'employee';
    };

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: '缺少必填欄位' });
    }

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(400).json({ success: false, error: '此電子郵件或使用者名稱已被使用' });
    }

    const newUser = new User({ username, email, password, role: role || 'employee' });
    await newUser.save();

    const userResponse = {
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt
    };

    res.status(201).json({ success: true, data: userResponse, message: '使用者建立成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: '伺服器內部錯誤' });
  }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '找不到使用者'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '伺服器內部錯誤'
    });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { username, email, role } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '找不到使用者'
      });
    }

    // Check if trying to change own role
    if (userId === req.user._id.toString() && role && role !== req.user.role) {
      return res.status(400).json({
        success: false,
        error: '不可更改自己的角色'
      });
    }

    // Update user
    if (username) user.username = username;
    if (email) user.email = email;
    if (role && req.user.role === 'admin') user.role = role;

    await user.save();

    const userResponse = {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json({
      success: true,
      data: userResponse,
      message: '使用者更新成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '伺服器內部錯誤'
    });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    // Cannot delete yourself
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: '不可刪除自己的帳號'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '找不到使用者'
      });
    }

    // Cannot delete other admins
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        error: '不可刪除管理員帳號'
      });
    }

    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: '使用者刪除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '伺服器內部錯誤'
    });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '找不到使用者'
      });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        error: '目前密碼不正確'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: '密碼變更成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '伺服器內部錯誤'
    });
  }
};
