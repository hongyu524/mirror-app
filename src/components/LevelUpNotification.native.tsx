import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';

type LevelUpNotificationProps = {
  level: number;
  levelName: string;
  onClose: () => void;
};

const LEVEL_REWARDS = {
  2: "Unlocked: View your weekly XP progress",
  3: "Unlocked: Deeper pattern insights",
  4: "Unlocked: Advanced reflection analytics",
  5: "Unlocked: Relationship dynamic patterns",
  6: "Unlocked: Long-term trend analysis",
  7: "Unlocked: Complete mastery - All features available!",
};

export function LevelUpNotification({ level, levelName, onClose }: LevelUpNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const scaleAnim = new Animated.Value(0.9);

  useEffect(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setTimeout(() => setIsVisible(true), 100);

    const timer = setTimeout(() => {
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const reward = LEVEL_REWARDS[level as keyof typeof LEVEL_REWARDS] || "Continue growing your self-awareness!";

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
              opacity: isVisible ? 1 : 0,
            }
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            style={styles.closeButton}
          >
            <Feather name="x" size={20} color="rgba(255, 255, 255, 0.7)" />
          </TouchableOpacity>

          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Feather name="award" size={40} color="#fff" />
            </View>

            <Text style={styles.title}>Level Up!</Text>

            <Text style={styles.levelNumber}>Level {level}</Text>

            <Text style={styles.levelName}>{levelName}</Text>

            <View style={styles.rewardCard}>
              <View style={styles.rewardHeader}>
                <Feather name="zap" size={20} color="#fbbf24" />
                <Text style={styles.rewardLabel}>REWARD UNLOCKED</Text>
              </View>
              <Text style={styles.rewardText}>{reward}</Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                setIsVisible(false);
                setTimeout(onClose, 300);
              }}
              style={styles.button}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Awesome!</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  card: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#60a5fa',
    padding: 24,
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  levelNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  levelName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#bfdbfe',
    marginBottom: 24,
  },
  rewardCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  rewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rewardLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fbbf24',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  rewardText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  buttonText: {
    color: '#2563eb',
    fontWeight: 'bold',
    fontSize: 16,
  },
});


