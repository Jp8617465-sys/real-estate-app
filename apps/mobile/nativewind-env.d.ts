// NativeWind v4 type augmentation for className prop on React Native components.
// This enables TypeScript support for NativeWind's className-based styling.
import 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface TouchableOpacityProps {
    className?: string;
  }
  interface PressableProps {
    className?: string;
  }
  interface TextInputProps {
    className?: string;
  }
  interface ImageProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
  }
  // FlatList: className + expose ScrollView props not surfaced via VirtualizedListProps in RN 0.84
  interface FlatListProps<_ItemT> {
    className?: string;
    contentContainerStyle?: StyleProp<ViewStyle>;
    scrollEnabled?: boolean;
  }
  // SectionList: same scroll prop workaround
  interface SectionListProps<_ItemT, _SectionT> {
    className?: string;
    contentContainerStyle?: StyleProp<ViewStyle>;
    scrollEnabled?: boolean;
  }
}

declare module 'react-native-safe-area-context' {
  interface NativeSafeAreaViewProps {
    style?: StyleProp<ViewStyle>;
  }
}
