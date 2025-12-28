import React from "react";
import Svg, { Path } from "react-native-svg";

interface AppleIconProps {
  size?: number;
  color?: string;
}

export function AppleIcon({ size = 24, color = "#000000" }: AppleIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74 1.18 0 2.45-1.02 3.8-1.02 1.34 0 2.58.63 3.23 1.64-2.85 1.57-2.36 6.04.42 7.31-.23.69-.5 1.4-.89 2.06-.61 1.05-1.25 2.11-1.64 2.24zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.17 2.37-2.03 4.27-3.74 4.25z" />
    </Svg>
  );
}
