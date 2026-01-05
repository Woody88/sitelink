import { cn } from '@/lib/utils';
import { Camera } from 'lucide-react-native';
import * as React from 'react';
import {
  Pressable,
  type PressableProps,
  Platform,
  Animated,
  StyleSheet,
} from 'react-native';

interface CameraFABProps extends Omit<PressableProps, 'children'> {
  onPress: () => void;
  opacity?: number;
  className?: string;
}

export const CameraFAB = React.memo<CameraFABProps>(
  ({ onPress, opacity = 1, className, ...props }) => {
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
        style={[
          styles.container,
          {
            opacity,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          className={cn(
            'bg-primary h-14 w-14 items-center justify-center rounded-full',
            className
          )}
          style={styles.shadow}
          accessibilityRole="button"
          accessibilityLabel="Open camera"
          {...props}
        >
          <Camera
            size={24}
            color="hsl(var(--primary-foreground))"
            strokeWidth={2}
          />
        </Pressable>
      </Animated.View>
    );
  }
);

CameraFAB.displayName = 'CameraFAB';

const styles = StyleSheet.create({
  container: {
    width: 56,
    height: 56,
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
  },
});
