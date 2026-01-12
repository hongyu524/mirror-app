import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext.native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext.native';
import { LanguageProvider } from './src/contexts/LanguageContext.native';
import * as Linking from 'expo-linking';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { logStartup } from './src/utils/startupLog';

// Import React Native components
import { Auth } from './src/components/Auth.native';
import { ResetPassword } from './src/components/ResetPassword.native';
import { Layout } from './src/components/Layout.native';
import { EventCapture } from './src/components/EventCapture.native';
import { Timeline } from './src/components/Timeline.native';
import { Patterns } from './src/components/Patterns.native';
import { Settings } from './src/components/Settings.native';

type Screen = 'capture' | 'timeline' | 'patterns' | 'settings';

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#60a5fa" />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('capture');
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [scrollToReflections, setScrollToReflections] = useState(false);

  useEffect(() => {
    logStartup('Init deep link handling');
    // Handle deep linking for password reset
    const handleDeepLink = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        const { queryParams } = Linking.parse(initialUrl);
        if (queryParams?.type === 'recovery' || queryParams?.type === 'password_recovery') {
          setIsResetPassword(true);
        }
      }
    };

    handleDeepLink();

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const { queryParams } = Linking.parse(url);
      if (queryParams?.type === 'recovery' || queryParams?.type === 'password_recovery') {
        setIsResetPassword(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleNavigate = (screen: Screen, options?: { scrollToReflections?: boolean }) => {
    setCurrentScreen(screen);
    if (options?.scrollToReflections) {
      setScrollToReflections(true);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (isResetPassword) {
    return <ResetPassword />;
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <Layout
      currentScreen={currentScreen}
      onScreenChange={(screen) => {
        setCurrentScreen(screen);
        setScrollToReflections(false);
      }}
    >
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

function AppWithTheme() {
  const { resolvedTheme } = useTheme();
  logStartup('Mount AppWithTheme');
  return (
    <>
      <StatusBar style={resolvedTheme === 'light' ? 'dark' : 'light'} />
      <AppContent />
    </>
  );
}

function App() {
  logStartup('App entry loaded');
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <LanguageProvider>
              <AppWithTheme />
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a', // Dark background
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#bae6fd', // Light text color
  },
});

export default App;

