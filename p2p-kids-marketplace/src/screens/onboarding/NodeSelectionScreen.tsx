import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
// TODO: Implement analytics service
// import { trackEvent } from '@/services/analytics';

interface Node {
  id: string;
  name: string;
  description: string;
  member_count: number;
}

export default function NodeSelectionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, nodeId } = (route.params as any) || {};

  const [assignedNode, setAssignedNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNode();
  }, []);

  const loadNode = async () => {
    try {
      const { data, error } = await supabase
        .from('nodes')
        .select('id, name, latitude, longitude, status')
        .eq('id', nodeId)
        .eq('status', 'active')
        .single();

      if (error) throw error;
      
      if (data) {
        // Map the node data to match the Node interface
        setAssignedNode({
          id: (data as any).id,
          name: (data as any).name,
          description: (data as any).name, // Use name as description since table doesn't have description
          member_count: 0, // Placeholder - can be calculated later
        });
      }
    } catch (error) {
      console.error('Load node error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    // TODO: Track analytics event
    // trackEvent('onboarding_node_confirmed', {
    //   user_id: userId,
    //   node_id: nodeId,
    // });

    (navigation as any).navigate('FeatureHighlights', { userId });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressInactive]} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Your Local Node</Text>
        <Text style={styles.subtitle}>
          You've been assigned to a nearby community
        </Text>

        {/* Node Card */}
        <View style={styles.nodeCard}>
          <Text style={styles.nodeEmoji}>🏘️</Text>
          <Text style={styles.nodeName}>{assignedNode?.name}</Text>
          <Text style={styles.nodeDescription}>{assignedNode?.description}</Text>
          <View style={styles.memberRow}>
            <Text style={styles.memberCount}>
              👥 {assignedNode?.member_count || 0} members
            </Text>
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Your node is where you'll find local traders, attend events, and
            participate in community activities.
          </Text>
        </View>

        {/* Continue Button */}
        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>Looks Good!</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    marginTop: 60,
  },
  progressContainer: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginLeft: 4,
  },
  progressActive: {
    backgroundColor: '#3b82f6',
  },
  progressInactive: {
    backgroundColor: '#e5e7eb',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  nodeCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 24,
    marginBottom: 40,
  },
  nodeEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  nodeName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  nodeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCount: {
    fontSize: 14,
    color: '#666',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 32,
  },
  infoText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
