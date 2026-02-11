// User preferences routes

import { Router } from 'express';
import { getDatabase } from '../db/client.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// All preferences routes require authentication
router.use(requireAuth);

// Get user preferences
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    let prefs = await db.getUserPreferences(req.userId!);

    // Create default preferences if none exist
    if (!prefs) {
      prefs = await db.upsertUserPreferences(req.userId!, {
        theme: 'auto',
        customIcons: {},
      });
    }

    res.json({
      preferences: {
        theme: prefs.theme,
        customIcons: prefs.customIcons,
        github: {
          connected: !!prefs.githubToken,
          username: prefs.githubUsername || null,
        },
      },
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// Update preferences
router.patch('/', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const { theme, customIcons } = req.body;

    const updates: Record<string, unknown> = {};

    if (theme !== undefined) {
      if (!['light', 'dark', 'auto'].includes(theme)) {
        return res.status(400).json({ error: 'Invalid theme. Must be light, dark, or auto.' });
      }
      updates.theme = theme;
    }

    if (customIcons !== undefined) {
      if (typeof customIcons !== 'object') {
        return res.status(400).json({ error: 'customIcons must be an object' });
      }
      updates.customIcons = customIcons;
    }

    const prefs = await db.upsertUserPreferences(req.userId!, updates);

    res.json({
      preferences: {
        theme: prefs.theme,
        customIcons: prefs.customIcons,
        github: {
          connected: !!prefs.githubToken,
          username: prefs.githubUsername || null,
        },
      },
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Update theme only
router.put('/theme', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const { theme } = req.body;

    if (!['light', 'dark', 'auto'].includes(theme)) {
      return res.status(400).json({ error: 'Invalid theme. Must be light, dark, or auto.' });
    }

    const prefs = await db.upsertUserPreferences(req.userId!, { theme });

    res.json({ theme: prefs.theme });
  } catch (error) {
    console.error('Update theme error:', error);
    res.status(500).json({ error: 'Failed to update theme' });
  }
});

// Update custom icon for a component
router.put('/icons/:componentId', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const { componentId } = req.params;
    const { icon } = req.body;

    if (!icon || typeof icon !== 'string') {
      return res.status(400).json({ error: 'Icon name is required' });
    }

    const currentPrefs = await db.getUserPreferences(req.userId!);
    const customIcons = { ...(currentPrefs?.customIcons || {}), [componentId]: icon };

    const prefs = await db.upsertUserPreferences(req.userId!, { customIcons });

    res.json({
      componentId,
      icon,
      customIcons: prefs.customIcons,
    });
  } catch (error) {
    console.error('Update icon error:', error);
    res.status(500).json({ error: 'Failed to update icon' });
  }
});

// Remove custom icon for a component
router.delete('/icons/:componentId', async (req: AuthenticatedRequest, res) => {
  try {
    const db = getDatabase();
    const { componentId } = req.params;

    const currentPrefs = await db.getUserPreferences(req.userId!);
    const customIcons = { ...(currentPrefs?.customIcons || {}) };
    delete customIcons[componentId];

    const prefs = await db.upsertUserPreferences(req.userId!, { customIcons });

    res.json({
      componentId,
      customIcons: prefs.customIcons,
    });
  } catch (error) {
    console.error('Remove icon error:', error);
    res.status(500).json({ error: 'Failed to remove icon' });
  }
});

export default router;
