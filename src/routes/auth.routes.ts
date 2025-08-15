import { Router } from 'express';
import passport from 'passport';
import { generateToken, generateRefreshToken } from '../middleware/auth.middleware';
import { User, PatientProfile } from '../models';
import jwt from 'jsonwebtoken';

const router = Router();

// Google OAuth temporarily disabled
router.get('/google', (req, res) => {
  res.json({ 
    error: 'Google OAuth temporarily disabled', 
    message: 'Please use email/password registration instead',
    registerEndpoint: '/api/auth/register'
  });
});

router.get('/google/callback', (req, res) => {
  res.json({ 
    error: 'Google OAuth temporarily disabled',
    message: 'Please use email/password login instead',
    loginEndpoint: '/api/auth/login'
  });
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role, invitationCode, age, phone } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    let nutritionistId;
    if (role === 'patient' && invitationCode) {
      const nutritionist = await User.findOne({
        where: { invitationCode, role: 'nutritionist' },
      });
      if (!nutritionist) {
        return res.status(400).json({ error: 'Invalid invitation code' });
      }
      nutritionistId = nutritionist.id;
    }

    const user = await User.create({
      email,
      password,
      name,
      role: role || 'patient',
      nutritionistId,
      age,
      phone,
    });

    if (role === 'patient') {
      await PatientProfile.create({
        userId: user.id,
        allergies: [],
        dietaryRestrictions: [],
        healthConditions: [],
        medications: [],
        goals: [],
        preferences: {},
      });
    }

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await user.update({ lastLogin: new Date() });

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as any;
    if (decoded.type !== 'refresh') {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    const user = await User.findByPk(decoded.id);
    if (!user || !user.isActive) {
      return res.status(403).json({ error: 'User not found or inactive' });
    }

    const newToken = generateToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.json({
      token: newToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    res.status(403).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', (req, res) => {
  // Simple logout since we're not using sessions for now
  res.json({ message: 'Logged out successfully' });
});

// Test endpoint to verify auth system is working
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Auth system is working!',
    timestamp: new Date().toISOString(),
    endpoints: {
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      refresh: 'POST /api/auth/refresh'
    },
    googleOAuth: 'disabled'
  });
});

export default router;