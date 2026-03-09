import { useEffect } from 'react';
import { Text, View, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import type { ToastVariant } from '@realflow/ui';

const VARIANT_COLORS: Record<ToastVariant, { bg: string; text: string; border: string }> = {
  success: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  error: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  warning: { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
  info: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
};

const VARIANT_ICONS: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
};

export interface MobileToastProps {
  message: string;
  variant: ToastVariant;
  duration?: number;
  onDismiss: () => void;
}

export function MobileToast({ message, variant, duration = 4000, onDismiss }: MobileToastProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(40);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    // Slide in
    opacity.value = withSpring(1, { damping: 18, stiffness: 220 });
    translateY.value = withSpring(0, { damping: 18, stiffness: 220 });

    if (duration > 0) {
      const dismiss = () => {
        opacity.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(24, { duration: 200 }, (finished) => {
          if (finished) runOnJS(onDismiss)();
        });
      };
      const timer = setTimeout(dismiss, duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const colors = VARIANT_COLORS[variant];

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          position: 'absolute',
          bottom: 32,
          left: 16,
          right: 16,
          zIndex: 9999,
          borderRadius: 12,
          borderWidth: 1,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 8,
        },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>
          {VARIANT_ICONS[variant]}
        </Text>
      </View>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '500', color: colors.text }}>
        {message}
      </Text>
      <Pressable onPress={onDismiss} hitSlop={8} accessibilityLabel="Dismiss">
        <Text style={{ fontSize: 16, color: colors.text, opacity: 0.5 }}>✕</Text>
      </Pressable>
    </Animated.View>
  );
}
