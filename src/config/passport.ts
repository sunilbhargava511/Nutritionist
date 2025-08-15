import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { User, PatientProfile } from '../models';
import dotenv from 'dotenv';

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({
          where: { googleId: profile.id },
        });

        if (!user) {
          user = await User.findOne({
            where: { email: profile.emails?.[0]?.value },
          });

          if (user) {
            await user.update({ googleId: profile.id });
          } else {
            user = await User.create({
              googleId: profile.id,
              email: profile.emails?.[0]?.value || '',
              name: profile.displayName || 'User',
              profilePicture: profile.photos?.[0]?.value,
              role: 'patient',
            });

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
        }

        await user.update({ lastLogin: new Date() });

        return done(null, user);
      } catch (error) {
        return done(error as Error, undefined);
      }
    }
  )
);

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET!,
    },
    async (payload, done) => {
      try {
        const user = await User.findByPk(payload.id);
        if (user) {
          return done(null, user);
        }
        return done(null, false);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;