import { Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

interface QuickActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
}

export function QuickActionButton({
  icon,
  label,
  onPress,
  color = '#2563eb',
}: QuickActionButtonProps) {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!reduced) {
      scale.value = withSpring(0.93, { damping: 14, stiffness: 300 });
    }
  };

  const handlePressOut = () => {
    if (!reduced) {
      scale.value = withSpring(1, { damping: 14, stiffness: 300 });
    }
  };

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View style={[animatedStyle, { flex: 1, minWidth: 76 }]}>
      <Pressable
        className="flex-1 items-center justify-center bg-white rounded-xl py-3.5 px-2 border border-gray-200"
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name={icon} size={22} color={color} />
        <Text
          className="text-[11px] font-semibold mt-1.5 text-center"
          style={{ color }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
