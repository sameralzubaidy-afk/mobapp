import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Share,
  Alert,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Clipboard
} from 'react-native';
import { Gift, Copy, ShareNetwork, Coins, Users, CheckCircle, UserCircle } from 'phosphor-react-native';
import { ReferralCodeServiceV2, type Referral, type ReferralStats } from '@/services/referralCodeV2';
import { ReferralRewardsService } from '@/services/referralRewards';
import { useAuth } from '@/hooks/useAuth';

export const ReferralsScreen: React.FC = () => {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState('');
  const [stats, setStats] = useState<ReferralStats>({
    total_referrals: 0,
    pending_referrals: 0,
    completed_referrals: 0,
    total_sp_earned: 0,
    trial_extensions_used: 0,
  });
  const [rewardsConfig, setRewardsConfig] = useState({
    referrer_sp: 25,
    referee_sp: 10,
    referrer_listing_sp: 25,
    referee_listing_sp: 10,
    program_enabled: true,
    first_trade_enabled: true,
    first_listing_enabled: true,
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
      const [code, statsData, historyData, config] = await Promise.all([
        ReferralCodeServiceV2.getReferralCode(user.id),
        ReferralCodeServiceV2.getReferralStats(user.id),
        ReferralCodeServiceV2.getReferralHistory(user.id),
        ReferralRewardsService.getConfiguredRewardAmounts(),
      ]);

      setReferralCode(code || '');
      setStats(statsData);
      setHistory(historyData);
      setRewardsConfig(config);
    } catch (error) {
      console.error('Failed to load referral data:', error);
      Alert.alert('Error', 'Failed to load referral data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (referralCode) {
      Clipboard.setString(referralCode);
      Alert.alert('Copied!', 'Referral code copied to clipboard');
    }
  };

  const handleShareLink = async () => {
    if (!referralCode) return;
    const link = ReferralCodeServiceV2.getReferralLink(referralCode);
    let bonusText = '';

    if (rewardsConfig.program_enabled) {
      const bonuses: string[] = [];
      if (rewardsConfig.first_trade_enabled) {
        bonuses.push(`${rewardsConfig.referee_sp} SP for trade`);
      }
      if (rewardsConfig.first_listing_enabled) {
        bonuses.push(`${rewardsConfig.referee_listing_sp} SP for listing`);
      }

      if (bonuses.length > 0) {
        bonusText = ` and get ${bonuses.join(' and ')}`;
      }
    }

    const message = `Join Kids Club+${bonusText}! Use my referral code: ${referralCode}\n\n${link}`;

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

  const renderHistoryItem = ({ item }: { item: Referral }) => (
    <View style={styles.historyRow}>
      <View style={styles.historyLeading}>
        <View style={styles.avatar}>
           <UserCircle size={36} color="#6B6B6B" weight="fill" />
        </View>
        <View style={styles.historyTextContainer}>
          <Text style={styles.historyName}>{item.referred_user_name || formatReferralId(item.referred_user_id)}</Text>
          <Text style={styles.historyDate}>Joined {new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
      </View>
      <View style={styles.historyTrailing}>
        {item.status === 'completed' && <CheckCircle size={16} color="#5DBB8E" weight="fill" />}
        <Text style={[styles.historyReward, item.status === 'pending' && { color: '#6B6B6B' }]}>
           +{item.status === 'completed' ? (rewardsConfig.referrer_sp || 0) : 0} SP
        </Text>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Users size={64} color="#E0E0E0" weight="fill" />
      <Text style={styles.emptyText}>No referrals yet — share your code!</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5DBB8E" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Hero Card */}
        <View style={styles.heroCard}>
          <Gift size={32} color="#FFFFFF" weight="fill" />
          <Text style={styles.heroTitle}>Refer Friends, Earn SP</Text>
          <Text style={styles.heroSubtext}>Share your code and get rewards when they join.</Text>
        </View>

        {/* SP Earned Strip */}
        <View style={styles.spStrip}>
          <Coins size={20} color="#F59E0B" weight="fill" />
          <Text style={styles.spStripText}>
            You've earned <Text style={styles.spStripBold}>{stats.total_sp_earned}</Text> SP from referrals
          </Text>
        </View>

        {/* Code Box */}
        <View style={styles.codeContainer}>
          <Text style={styles.codeText} testID="referral-code-text">{referralCode}</Text>
          <TouchableOpacity onPress={handleCopyCode} testID="copy-btn">
            <Copy size={20} color="#5DBB8E" weight="bold" />
          </TouchableOpacity>
        </View>

        {/* Share Button */}
        <TouchableOpacity style={styles.shareButton} onPress={handleShareLink} testID="share-btn">
          <ShareNetwork size={18} color="#FFFFFF" weight="bold" />
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>

        <Text style={styles.historyTitle}>Referral History</Text>
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={renderHistoryItem}
          ListEmptyComponent={renderEmptyState}
          scrollEnabled={false}
          contentContainerStyle={styles.historyList}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  heroCard: {
    backgroundColor: '#5DBB8E',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
    marginTop: 12,
    marginBottom: 4,
  },
  heroSubtext: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.8,
    textAlign: 'center',
  },
  spStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    justifyContent: 'center',
  },
  spStripText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1A1A1A',
  },
  spStripBold: {
    fontWeight: 'bold',
  },
  codeContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  codeText: {
    fontSize: 20,
    color: '#1A1A1A',
    letterSpacing: 4,
    fontFamily: 'Courier', 
  },
  shareButton: {
    backgroundColor: '#5DBB8E',
    borderRadius: 52,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  historyList: {
    paddingBottom: 24,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  historyLeading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  historyTextContainer: {
    marginLeft: 12,
  },
  historyName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  historyDate: {
    fontSize: 13,
    color: '#6B6B6B',
    marginTop: 2,
  },
  historyTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyReward: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
  },
});
export default ReferralsScreen;
