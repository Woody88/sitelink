import { Camera, Plus, type LucideIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import * as React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Pressable,
  type PressableProps,
  Platform,
  Animated,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';

interface WorkspaceFABProps extends Omit<PressableProps, 'children' | 'style'> {
  onPress: () => void;
  icon?: LucideIcon;
  opacity?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export const WorkspaceFAB = React.memo<WorkspaceFABProps>(
  ({ onPress, icon: IconComponent = Camera, opacity = 1, className, style, ...props }) => {
    const insets = useSafeAreaInsets();
    const scaleAnim = React.useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        friction: 3,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 3,
      }).start();
    };

    return (
      <Animated.View
        className={className}
        style={[
          styles.container,
          {
            opacity,
            transform: [{ scale: scaleAnim }],
            bottom: 16 + insets.bottom,
            right: 16 + insets.right,
          },
          style,
        ]}
      >
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          className="bg-primary h-14 w-14 items-center justify-center rounded-full"
          style={styles.shadow}
          accessibilityRole="button"
          accessibilityLabel={IconComponent === Plus ? "Add plan" : "Open camera"}
          {...props}
        >
          <Icon
            as={IconComponent}
            className="text-primary-foreground size-6"
            strokeWidth={2.5}
          />
        </Pressable>
      </Animated.View>
    );
  }
);

WorkspaceFAB.displayName = 'WorkspaceFAB';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 56,
    height: 56,
    zIndex: 50,
  },
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 3,
        },
        shadowOpacity: 0.27,
        shadowRadius: 4.65,
      },
      android: {
        elevation: 6,
      },
      default: {
        // Web shadow via NativeWind className
      },
    }),
  } as ViewStyle,
});
