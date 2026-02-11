// Authentication routes

import { Router } from 'express';
import { db } from '../db/client.js';
import {
  createToken,
  hashPassword,
  verifyPassword,
  requireAuth,
  type AuthenticatedRequest,
} from '../middleware/auth.js';

const router = Router();

// Sign up
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user exists
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user
    const passwordHash = hashPassword(password);
    const user = await db.createUser(email, passwordHash, name);

    // Generate token
    const token = createToken(user.id);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    if (!verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = createToken(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

// Update profile
router.patch('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { name } = req.body;

    const user = await db.updateUser(req.userId!, { name });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
