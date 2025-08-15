import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { PatientProfile, User } from '../models';

const router = Router();

router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    
    const profile = await PatientProfile.findOne({
      where: { userId: user.id },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'phone', 'age', 'profilePicture'],
        },
      ],
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const updates = req.body;

    let profile = await PatientProfile.findOne({
      where: { userId: user.id },
    });

    if (!profile) {
      profile = await PatientProfile.create({
        userId: user.id,
        ...updates,
        lastUpdated: new Date(),
      });
    } else {
      await profile.update({
        ...updates,
        lastUpdated: new Date(),
      });
    }

    res.json(profile);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/allergies', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { allergies } = req.body;

    const profile = await PatientProfile.findOne({
      where: { userId: user.id },
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const updatedAllergies = [...new Set([...profile.allergies, ...allergies])];
    await profile.update({
      allergies: updatedAllergies,
      lastUpdated: new Date(),
    });

    res.json({ allergies: updatedAllergies });
  } catch (error) {
    console.error('Add allergies error:', error);
    res.status(500).json({ error: 'Failed to add allergies' });
  }
});

router.delete('/allergies/:allergy', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { allergy } = req.params;

    const profile = await PatientProfile.findOne({
      where: { userId: user.id },
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const updatedAllergies = profile.allergies.filter(a => a !== allergy);
    await profile.update({
      allergies: updatedAllergies,
      lastUpdated: new Date(),
    });

    res.json({ allergies: updatedAllergies });
  } catch (error) {
    console.error('Remove allergy error:', error);
    res.status(500).json({ error: 'Failed to remove allergy' });
  }
});

router.post('/dietary-restrictions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { restrictions } = req.body;

    const profile = await PatientProfile.findOne({
      where: { userId: user.id },
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const updatedRestrictions = [...new Set([...profile.dietaryRestrictions, ...restrictions])];
    await profile.update({
      dietaryRestrictions: updatedRestrictions,
      lastUpdated: new Date(),
    });

    res.json({ dietaryRestrictions: updatedRestrictions });
  } catch (error) {
    console.error('Add restrictions error:', error);
    res.status(500).json({ error: 'Failed to add dietary restrictions' });
  }
});

router.post('/goals', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { goals } = req.body;

    const profile = await PatientProfile.findOne({
      where: { userId: user.id },
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const updatedGoals = [...new Set([...profile.goals, ...goals])];
    await profile.update({
      goals: updatedGoals,
      lastUpdated: new Date(),
    });

    res.json({ goals: updatedGoals });
  } catch (error) {
    console.error('Add goals error:', error);
    res.status(500).json({ error: 'Failed to add goals' });
  }
});

router.put('/preferences', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { preferences } = req.body;

    const profile = await PatientProfile.findOne({
      where: { userId: user.id },
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    await profile.update({
      preferences: {
        ...profile.preferences,
        ...preferences,
      },
      lastUpdated: new Date(),
    });

    res.json({ preferences: profile.preferences });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

export default router;