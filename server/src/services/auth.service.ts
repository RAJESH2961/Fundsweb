import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { userRepository } from '../repositories/user.repository';
import { UnauthorizedError } from '../utils/errors';

const publicUser = (u: { id: string; name: string; email: string; role: 'ADMIN' | 'SALES_USER' }) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
});

export const authService = {
  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedError('Invalid email or password');
    }
    const token = jwt.sign(publicUser(user), env.jwtSecret, {
      expiresIn: env.jwtExpiresIn,
    } as jwt.SignOptions);
    return { token, user: publicUser(user) };
  },

  async me(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new UnauthorizedError('User not found');
    return publicUser(user);
  },
};
