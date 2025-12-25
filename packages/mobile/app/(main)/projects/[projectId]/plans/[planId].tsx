import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import OpenSeadragonViewer from '@/components/plan-viewer/OpenSeadragonViewer';

export default function PlanViewerScreen() {
  const { projectId, planId } = useLocalSearchParams<{
    projectId: string;
    planId: string;
  }>();

  // TODO: Fetch actual tile source URL from API based on planId
  // For now, using default test image built into the component

  return (
    <View style={styles.container}>
      <OpenSeadragonViewer
        dom={{ style: { flex: 1, width: '100%', height: '100%' } }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
});

