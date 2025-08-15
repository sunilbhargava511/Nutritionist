import { connectDatabase } from '../config/database';
import { User, PatientProfile, Lesson } from '../models';

const seed = async () => {
  try {
    console.log('Starting database seeding...');
    await connectDatabase();

    // Create a demo nutritionist
    const nutritionist = await User.create({
      email: 'demo@nutritionist.com',
      password: 'password123',
      name: 'Dr. Sarah Wilson',
      role: 'nutritionist',
      phone: '+1234567890',
    });

    console.log(`Created nutritionist: ${nutritionist.name} with invitation code: ${nutritionist.invitationCode}`);

    // Create a demo patient
    const patient = await User.create({
      email: 'patient@example.com',
      password: 'password123',
      name: 'John Smith',
      role: 'patient',
      age: 35,
      phone: '+1987654321',
      nutritionistId: nutritionist.id,
    });

    // Create patient profile
    await PatientProfile.create({
      userId: patient.id,
      allergies: ['nuts', 'shellfish'],
      dietaryRestrictions: ['vegetarian'],
      healthConditions: ['diabetes'],
      goals: ['weight loss', 'better energy'],
      preferences: {
        mealTime: 'evening',
        cookingLevel: 'intermediate',
      },
      currentWeight: 180,
      targetWeight: 160,
      height: 70,
      activityLevel: 'moderate',
    });

    // Create demo lessons
    const lesson1 = await Lesson.create({
      nutritionistId: nutritionist.id,
      title: 'Understanding Macronutrients',
      description: 'Learn about proteins, carbohydrates, and fats in your diet',
      content: [
        {
          index: 0,
          content: 'Welcome to our lesson on macronutrients. Today we\'ll explore the three main types of nutrients your body needs: proteins, carbohydrates, and fats.',
          duration: 2,
          type: 'content',
          hasQA: true,
        },
        {
          index: 1,
          content: 'Proteins are the building blocks of your body. They help repair tissues, build muscles, and support immune function. Good sources include lean meats, fish, eggs, legumes, and dairy.',
          duration: 3,
          type: 'content',
          hasQA: true,
        },
        {
          index: 2,
          content: 'Carbohydrates are your body\'s main energy source. Choose complex carbs like whole grains, vegetables, and fruits over simple sugars for sustained energy.',
          duration: 3,
          type: 'content',
          hasQA: false,
        },
      ],
      sourceType: 'text',
      chunkDurationMinutes: 3,
      totalDurationMinutes: 8,
      tags: ['nutrition', 'basics', 'macronutrients'],
      isPublished: true,
    });

    const lesson2 = await Lesson.create({
      nutritionistId: nutritionist.id,
      title: 'Meal Planning for Diabetes',
      description: 'Practical strategies for managing blood sugar through nutrition',
      content: [
        {
          index: 0,
          content: 'Managing diabetes through nutrition is about creating consistent, balanced meals that help stabilize blood sugar levels throughout the day.',
          duration: 2,
          type: 'content',
          hasQA: true,
        },
        {
          index: 1,
          content: 'Focus on the plate method: fill half your plate with non-starchy vegetables, one quarter with lean protein, and one quarter with complex carbohydrates.',
          duration: 3,
          type: 'content',
          hasQA: false,
        },
      ],
      sourceType: 'text',
      chunkDurationMinutes: 3,
      totalDurationMinutes: 5,
      tags: ['diabetes', 'meal planning', 'blood sugar'],
      isPublished: true,
    });

    console.log(`Created demo data:
    - Nutritionist: ${nutritionist.name} (${nutritionist.email})
    - Patient: ${patient.name} (${patient.email})
    - Lessons: ${lesson1.title}, ${lesson2.title}
    
    Use invitation code: ${nutritionist.invitationCode} for new patients`);

    console.log('Database seeding completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seed();