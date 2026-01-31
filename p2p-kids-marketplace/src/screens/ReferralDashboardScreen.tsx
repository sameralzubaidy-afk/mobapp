import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Share,
  Alert,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Clipboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ReferralCodeServiceV2, type Referral, type ReferralStats } from '@/services/referralCodeV2';
import { useAuth } from '@/hooks/useAuth';

export const ReferralDashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [referralCode, setReferralCode] = useState('');
  const [stats, setStats] = useState<ReferralStats>({
    total_referrals: 0,
    pending_referrals: 0,
    completed_referrals: 0,
    total_sp_earned: 0,
    trial_extensions_used: 0,
  });
  const [history, setHistory] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadReferralData();
    }
  }, [user?.id]);

  const loadReferralData = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      
      // Load all referral data concurrently
      const [code, statsData, historyData] = await Promise.all([
        ReferralCodeServiceV2.getReferralCode(user.id),
        ReferralCodeServiceV2.getReferralStats(user.id),
        ReferralCodeServiceV2.getReferralHistory(user.id),
      ]);

      setReferralCode(code || '');
      setStats(statsData);
      setHistory(historyData);
    } catch (error) {
      console.error('Failed to load referral data:', error);
      Alert.alert('Error', 'Failed to load referral data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (referralCode) {
      Clipboard.setString(referralCode);
      Alert.alert('Copied!', 'Referral code copied to clipboard');
    }
  };

  const handleShareLink = async () => {
    if (!referralCode) return;

    const link = ReferralCodeServiceV2.getReferralLink(referralCode);
    const message = `Join Kids Club+ and earn 10 SP when you complete your first trade! Use my referral code: ${referralCode}\n\n${link}`;

    try {
      await Share.share({
        message,
        title: 'Join Kids Club+',
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  const formatReferralId = (id: string) => {
    return `User #${id.slice(0, 8)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderReferralItem = ({ item }: { item: Referral }) => (
    <View style={styles.referralItem}>
      <View style={styles.referralInfo}>
        <Text style={styles.referralId}>
          {formatReferralId(item.referred_user_id)}
        </Text>
        <Text style={styles.referralDate}>
          {formatDate(item.created_at)}
        </Text>
      </View>
      <View style={styles.referralStatus}>
        <View
          style={[
            styles.statusBadge,
            item.status === 'completed' && styles.statusCompleted,
            item.status === 'pending' && styles.statusPending,
            item.status === 'expired' && styles.statusExpired,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              item.status === 'completed' && styles.statusTextCompleted,
              item.status === 'pending' && styles.statusTextPending,
            ]}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
        {item.trial_extension_applied && (
          <Text style={styles.extensionBadge}>+7 days</Text>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading referral data...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Refer Friends, Earn Rewards!</Text>
            <Text style={styles.subtitle}>
              Invite friends and earn 25 SP when they complete their first trade
            </Text>
          </View>
        </View>

        {/* Referral Code Card */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your Referral Code</Text>
          <Text style={styles.code}>{referralCode}</Text>
          <Text style={styles.codeHint}>Share this code or use the link below</Text>
          
          <View style={styles.codeActions}>
            <TouchableOpacity style={styles.copyButton} onPress={handleCopyCode}>
              <Text style={styles.copyButtonText}>Copy Code</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareButton} onPress={handleShareLink}>
              <Text style={styles.shareButtonText}>Share Link</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total_referrals}</Text>
            <Text style={styles.statLabel}>Total{'\n'}Referrals</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.completed_referrals}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total_sp_earned}</Text>
            <Text style={styles.statLabel}>SP Earned</Text>
          </View>
        </View>

        {/* Referral History */}
        <View style={styles.historyContainer}>
          <Text style={styles.historyTitle}>Referral History</Text>
          
          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No referrals yet. Share your code to get started!
              </Text>
            </View>
          ) : (
            <FlatList
              data={history}
              renderItem={renderReferralItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              style={styles.historyList}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 4,
  },
  backButtonText: {
    fontSize: 28,
    color: '#007AFF',
    fontWeight: '400',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  codeCard: {
    margin: 16,
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  codeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  code: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginBottom: 8,
    color: '#2196F3',
  },
  codeHint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 16,
  },
  codeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  copyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  copyButtonText: {
    color: '#2196F3',
    fontWeight: '600',
    fontSize: 14,
  },
  shareButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  shareButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  historyContainer: {
    flex: 1,
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  historyList: {
    flexGrow: 0,
  },
  referralItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  referralInfo: {
    flex: 1,
  },
  referralId: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  referralDate: {
    fontSize: 12,
    color: '#666',
  },
  referralStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 4,
  },
  statusCompleted: {
    backgroundColor: '#c8e6c9',
  },
  statusPending: {
    backgroundColor: '#fff9c4',
  },
  statusExpired: {
    backgroundColor: '#ffcdd2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusTextCompleted: {
    color: '#2e7d32',
  },
  statusTextPending: {
    color: '#f57f17',
  },
  extensionBadge: {
    fontSize: 10,
    color: '#2196F3',
    fontWeight: '500',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ReferralDashboardScreen;