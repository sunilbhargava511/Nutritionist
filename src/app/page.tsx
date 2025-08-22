import HomePage from '@/components/HomePage';

export default function Home() {
  return <HomePage />;
}

// Add metadata for better Railway deployment
export const metadata = {
  title: 'Nutritionist Learning Platform',
  description: 'AI-powered nutritionist learning platform with voice interaction',
};
