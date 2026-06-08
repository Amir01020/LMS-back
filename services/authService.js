const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const authConfig = require('../config/auth');
const { User, RefreshToken, PasswordResetToken } = require('../models');
const { ERROR_MESSAGES } = require('../utils/constants');

class AuthService {
  static async hashPassword(password) {
    const salt = await bcrypt.genSalt(authConfig.bcrypt.saltRounds);
    return bcrypt.hash(password, salt);
  }

  static async comparePassword(plain, hashed) {
    return bcrypt.compare(plain, hashed);
  }

  static generateAccessToken(user) {
    return jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      authConfig.jwt.accessSecret,
      { expiresIn: authConfig.jwt.accessExpiresIn, algorithm: authConfig.jwt.algorithm }
    );
  }

  static generateRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
  }

  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, authConfig.jwt.accessSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') throw new Error('Токен истек');
      throw new Error(ERROR_MESSAGES.INVALID_TOKEN);
    }
  }

  static async createRefreshToken(userId) {
    const token = this.generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await RefreshToken.create({
      user_id: userId,
      token,
      expires_at: expiresAt
    });

    return token;
  }

  static async login(email, password) {
    const user = await User.findByEmail(email);
    if (!user || !user.is_active) {
      throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    const valid = await this.comparePassword(password, user.password_hash);
    if (!valid) throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);

    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken
    };
  }

  static async refresh(refreshToken) {
    const stored = await RefreshToken.findOne({
      where: { token: refreshToken, is_revoked: false }
    });

    if (!stored || stored.expires_at < new Date()) {
      throw new Error(ERROR_MESSAGES.INVALID_TOKEN);
    }

    const user = await User.findByPk(stored.user_id);
    if (!user || !user.is_active) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    await stored.update({ is_revoked: true });

    const accessToken = this.generateAccessToken(user);
    const newRefreshToken = await this.createRefreshToken(user.id);

    return { user: user.toJSON(), accessToken, refreshToken: newRefreshToken };
  }

  static async logout(refreshToken) {
    if (refreshToken) {
      await RefreshToken.update(
        { is_revoked: true },
        { where: { token: refreshToken } }
      );
    }
    return { message: 'Вы успешно вышли из системы' };
  }

  static async createUser(data) {
    const existing = await User.findByEmail(data.email);
    if (existing) throw new Error(ERROR_MESSAGES.USER_EXISTS);

    const password_hash = await this.hashPassword(data.password);
    const user = await User.create({
      name: data.name,
      email: data.email,
      password_hash,
      role: data.role,
      phone: data.phone || null,
      avatar_url: data.avatar_url || null,
      branch_id: data.branch_id || null,
      salary: data.salary ?? null
    });

    if (data.branch_ids?.length) {
      const BranchAccessService = require('./branchAccessService');
      await BranchAccessService.syncUserBranches(user.id, data.branch_ids);
    } else if (data.branch_id) {
      const BranchAccessService = require('./branchAccessService');
      await BranchAccessService.syncUserBranches(user.id, [data.branch_id]);
    }

    return user.toJSON();
  }

  static async changePassword(userId, oldPassword, newPassword) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);

    const valid = await this.comparePassword(oldPassword, user.password_hash);
    if (!valid) throw new Error('Неверный текущий пароль');

    await user.update({ password_hash: await this.hashPassword(newPassword) });
    await RefreshToken.update({ is_revoked: true }, { where: { user_id: userId } });

    return { message: 'Пароль успешно изменен' };
  }

  static async forgotPassword(email) {
    const user = await User.findByEmail(email);
    if (!user) {
      return { message: 'Если email существует, код отправлен' };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await PasswordResetToken.create({
      user_id: user.id,
      code,
      expires_at: expiresAt
    });

    // TODO: отправка email через Nodemailer
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Reset code for ${email}: ${code}`);
    }

    return { message: 'Если email существует, код отправлен' };
  }

  static async resetPassword(email, code, newPassword) {
    const user = await User.findByEmail(email);
    if (!user) throw new Error('Неверный код или email');

    const resetToken = await PasswordResetToken.findOne({
      where: { user_id: user.id, code, is_used: false },
      order: [['created_at', 'DESC']]
    });

    if (!resetToken || resetToken.expires_at < new Date()) {
      throw new Error('Неверный или просроченный код');
    }

    await user.update({ password_hash: await this.hashPassword(newPassword) });
    await resetToken.update({ is_used: true });
    await RefreshToken.update({ is_revoked: true }, { where: { user_id: user.id } });

    return { message: 'Пароль успешно сброшен' };
  }

  static async getUserById(userId) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    return user.toJSON();
  }

  static async updateProfile(userId, data) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);

    const updates = {};
    if (data.name) updates.name = data.name;
    if (data.phone !== undefined) updates.phone = data.phone || null;
    if (data.avatar_url !== undefined) updates.avatar_url = data.avatar_url || null;

    if (data.email && data.email !== user.email) {
      const existing = await User.findByEmail(data.email);
      if (existing && existing.id !== user.id) {
        throw new Error(ERROR_MESSAGES.USER_EXISTS);
      }
      updates.email = data.email;
    }

    await user.update(updates);
    return user.toJSON();
  }
}

module.exports = AuthService;
