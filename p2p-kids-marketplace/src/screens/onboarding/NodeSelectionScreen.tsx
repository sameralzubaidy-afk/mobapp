import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
// TODO: Implement analytics service
// import { trackEvent } from '@/services/analytics';

interface Node {
  id: string;
  name: string;
  description: string;
  member_count: number;
  status?: 'active' | 'inactive';
}

export default function NodeSelectionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, nodeId } = (route.params as any) || {};

  const [assignedNode, setAssignedNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  useEffect(() => {
    loadNode();
  }, []);

  const loadNode = async () => {
    try {
      // First try to find an active node
      const { data: activeNode, error: activeError } = await supabase
        .from('nodes')
        .select('id, name, latitude, longitude, status')
        .eq('id', nodeId)
        .eq('status', 'active')
        .single();

      if (activeNode) {
        // Node is active - show it
        setAssignedNode({
          id: (activeNode as any).id,
          name: (activeNode as any).name,
          description: (activeNode as any).name,
          member_count: 0,
          status: 'active',
        });
      } else {
        // Node might be inactive - check without status filter
        const { data: anyNode, error: anyError } = await supabase
          .from('nodes')
          .select('id, name, latitude, longitude, status')
          .eq('id', nodeId)
          .single();

        if (anyError) throw anyError;

        if (anyNode && (anyNode as any).status === 'inactive') {
          // Node is INACTIVE - show waitlist option
          setAssignedNode({
            id: (anyNode as any).id,
            name: (anyNode as any).name,
            description: (anyNode as any).name,
            member_count: 0,
            status: 'inactive',
          });
        } else {
          // Unknown state
          throw new Error('Node not found or not active');
        }
      }
    } catch (error) {
      console.error('Load node error:', error);
      // Still try to render something - user can continue
      setAssignedNode(null);
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

  const handleJoinWaitlist = async () => {
    try {
      setWaitlistLoading(true);

      // Add user to waitlist for this inactive node
      const { error } = await supabase.from('waitlist_registrations').insert({
        user_id: userId,
        node_id: nodeId,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Show success and navigate to features
      Alert.alert(
        'Waitlist Confirmed',
        `We'll notify you as soon as ${assignedNode?.name} is ready to launch!`,
        [
          {
            text: 'Continue',
            onPress: () => (navigation as any).navigate('FeatureHighlights', { userId }),
          },
        ]
      );
    } catch (error: any) {
      console.error('Waitlist error:', error);
      Alert.alert('Error', error.message || 'Failed to join waitlist');
    } finally {
      setWaitlistLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressActive]} />
          <View style={[styles.progressBar, styles.progressInactive]} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Your Local Node</Text>
        <Text style={styles.subtitle}>You've been assigned to a nearby community</Text>

        {/* Node Card */}
        <View style={styles.nodeCard}>
          <Text style={styles.nodeEmoji}>🏘️</Text>
          <Text style={styles.nodeName}>{assignedNode?.name}</Text>
          <Text style={styles.nodeDescription}>{assignedNode?.description}</Text>
          <View style={styles.memberRow}>
            <Text style={styles.memberCount}>👥 {assignedNode?.member_count || 0} members</Text>
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            💡 Your node is where you'll find local traders, attend events, and participate in
            community activities.
          </Text>
        </View>

        {/* Button - conditional based on node status */}
        {assignedNode?.status === 'inactive' ? (
          <TouchableOpacity
            style={styles.button}
            onPress={handleJoinWaitlist}
            disabled={waitlistLoading}
          >
            {waitlistLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Join Waitlist</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleContinue}>
            <Text style={styles.buttonText}>Looks Good!</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
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
