import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Auth } from './components/Auth';
import { ResetPassword } from './components/ResetPassword';
import { Layout } from './components/Layout';
import { EventCapture } from './components/EventCapture';
import { Timeline } from './components/Timeline';
import { Patterns } from './components/Patterns';
import { Settings } from './components/Settings';

type Screen = 'capture' | 'timeline' | 'patterns' | 'settings';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('capture');
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [scrollToReflections, setScrollToReflections] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;

    if (hash.includes('type=recovery') || hash.includes('type=password_recovery')) {
      setIsResetPassword(true);
    }
  }, []);

  const handleNavigate = (screen: Screen, options?: { scrollToReflections?: boolean }) => {
    setCurrentScreen(screen);
    if (options?.scrollToReflections) {
      setScrollToReflections(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (isResetPassword) {
    return <ResetPassword />;
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <Layout currentScreen={currentScreen} onScreenChange={(screen) => { setCurrentScreen(screen); setScrollToReflections(false); }}>
      {currentScreen === 'capture' && (
        <EventCapture
          onNavigate={handleNavigate}
          scrollToReflections={scrollToReflections}
          onScrollComplete={() => setScrollToReflections(false)}
        />
      )}
      {currentScreen === 'timeline' && <Timeline />}
      {currentScreen === 'patterns' && (
        <Patterns
          onNavigate={handleNavigate}
          scrollToReflections={scrollToReflections}
          onScrollComplete={() => setScrollToReflections(false)}
        />
      )}
      {currentScreen === 'settings' && <Settings />}
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LanguageProvider>
          <AppContent />
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
