import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext.native';

export function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signIn, resetPassword } = useAuth();

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isForgotPassword) {
        await resetPassword(email);
        setSuccess('Password reset email sent! Check your inbox.');
        setEmail('');
      } else if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/mirror_logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            </View>
            <Text style={styles.tagline}>Reflect on your relationships</Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>

              {!isForgotPassword && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.input}
                  />
                </View>
              )}

              {!isForgotPassword && !isSignUp && (
                <TouchableOpacity
                  onPress={() => {
                    setIsForgotPassword(true);
                    setError('');
                    setSuccess('');
                  }}
                  style={styles.forgotButton}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              )}

              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {success ? (
                <View style={styles.successContainer}>
                  <Text style={styles.successText}>{success}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              >
                <Text style={styles.submitButtonText}>
                  {loading ? 'Please wait...' : isForgotPassword ? 'Send Reset Link' : isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
              </TouchableOpacity>

              <View style={styles.switchContainer}>
                {isForgotPassword ? (
                  <TouchableOpacity
                    onPress={() => {
                      setIsForgotPassword(false);
                      setError('');
                      setSuccess('');
                    }}
                  >
                    <Text style={styles.switchText}>Back to sign in</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      setIsSignUp(!isSignUp);
                      setError('');
                      setSuccess('');
                    }}
                  >
                    <Text style={styles.switchText}>
                      {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.disclaimer}>
                Mirror is a personal reflection tool. It does not provide therapy, counseling, or medical advice.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 96,
    height: 96,
  },
  tagline: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 32,
  },
  form: {
    backgroundColor: '#1a2332',
    borderRadius: 24,
    padding: 32,
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#cbd5e1',
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#2a3441',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#f1f5f9',
    fontSize: 16,
  },
  forgotButton: {
    alignSelf: 'flex-end',
  },
  forgotText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
  },
  successContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 8,
    padding: 12,
  },
  successText: {
    fontSize: 14,
    color: '#22c55e',
  },
  submitButton: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  switchContainer: {
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  disclaimer: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
});

