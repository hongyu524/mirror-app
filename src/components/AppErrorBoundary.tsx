import React from 'react';
import { View, Text, ScrollView, Platform } from 'react-native';
import { getStartupLogs } from '../utils/startupLog';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message?: string; stack?: string };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: any) {
    return {
      hasError: true,
      message: String(error?.message ?? error),
      stack: String(error?.stack ?? ''),
    };
  }

  componentDidCatch(error: any, info: any) {
    console.log('[FATAL] Uncaught error:', error);
    console.log('[FATAL] Component stack:', info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={{ flex: 1, paddingTop: 60, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>App Error</Text>
        <Text style={{ marginBottom: 8 }}>
          The app failed to start. This screen replaces the blank white screen so we can debug TestFlight.
        </Text>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 8 }}>Message</Text>
          <Text selectable style={{ marginTop: 6 }}>
            {this.state.message}
          </Text>

          {!!this.state.stack && (
            <>
              <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 16 }}>Stack</Text>
              <Text selectable style={{ marginTop: 6 }}>
                {this.state.stack}
              </Text>
            </>
          )}

          <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 16 }}>Startup logs</Text>
          <Text selectable style={{ marginTop: 6, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
            {getStartupLogs() || 'No startup logs recorded.'}
          </Text>

          <Text style={{ marginTop: 16, opacity: 0.7 }}>Platform: {Platform.OS}</Text>
        </ScrollView>
      </View>
    );
  }
}
