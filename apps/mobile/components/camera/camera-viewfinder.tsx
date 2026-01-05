import * as React from 'react'
import { View, StyleSheet } from 'react-native'
import { CameraView } from 'expo-camera'
import type { CameraType, FlashMode } from '@/hooks/use-camera-state'

interface CameraViewfinderProps {
  cameraRef: React.RefObject<CameraView | null>
  cameraType: CameraType
  flashMode: FlashMode
}

export const CameraViewfinder = React.memo(function CameraViewfinder({
  cameraRef,
  cameraType,
  flashMode,
}: CameraViewfinderProps) {
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraType}
        flash={flashMode}
        mode="picture"
      />
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
})

