import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  Share,
  StyleSheet,
  ScrollView
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Gift, Copy, ShareNetwork, Coins, Users, CheckCircle, UserCircle, ArrowLeft, Storefront, Notebook, Info } from 'phosphor-react-native';
import { ReferralCodeServiceV2, type Referral, type ReferralStats } from '@/services/referralCodeV2';
import { ReferralRewardsService } from '@/services/referralRewards';
import { useAuth } from '@/hooks/useAuth';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LoadingSpinner } from '@/components/ui';
import ScreenLayout from '@/components/ScreenLayout';

type NavigationProp = NativeStackNavigationProp<any>;

export const ReferralsScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const lastLoadAtRef = useRef(0);
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

  const loadReferralData = useCallback(async () => {
    if (!user?.id) return;
    try {
      lastLoadAtRef.current = Date.now();
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
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      void loadReferralData();
    }
  }, [loadReferralData, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastLoadAtRef.current < 500) {
        return;
      }

      if (user?.id) {
        void loadReferralData();
      }
    }, [loadReferralData, user?.id])
  );

  const handleCopyCode = async () => {
    if (!referralCode) return;

    try {
      await Clipboard.setStringAsync(referralCode);
      Alert.alert('Copied!', 'Referral code copied to clipboard');
    } catch (error) {
      console.error('Failed to copy referral code:', error);
      Alert.alert('Error', 'Unable to copy referral code. Please try again.');
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

  const isLikelySystemIdentifier = (value: string) => {
    const trimmed = value.trim();

    // UUID-style values should never be shown as a display name.
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      return true;
    }

    // Legacy rows may store a short hex ID-like token (e.g., "7717c60b").
    if (/^[0-9a-f]{8,16}$/i.test(trimmed)) {
      return true;
    }

    return false;
  };

  const getReferralDisplayName = (item: Referral) => {
    const rawName = item.referred_user_name?.trim();

    if (!rawName || isLikelySystemIdentifier(rawName)) {
      return formatReferralId(item.referred_user_id);
    }

    return rawName;
  };

  const renderHistoryItem = ({ item }: { item: Referral }) => (
    <View style={styles.historyRow} testID={`history-item-${item.id}`}>
      <View style={styles.historyLeading}>
        <View style={styles.avatar}>
           <UserCircle size={36} color="#6B6B6B" weight="fill" />
        </View>
        <View style={styles.historyTextContainer}>
          <Text style={styles.historyName} testID={`history-name-${item.id}`}>{getReferralDisplayName(item)}</Text>
          <Text style={styles.historyDate} testID={`history-date-${item.id}`}>Joined {new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
      </View>
      <View style={styles.historyTrailing}>
        {item.status === 'completed' && <CheckCircle size={16} color="#5DBB8E" weight="fill" testID={`check-icon-${item.id}`} />}
        <Text style={[styles.historyReward, item.status === 'pending' && { color: '#6B6B6B' }]} testID={`history-reward-${item.id}`}>
           +{rewardsConfig.referrer_sp || 0} SP
        </Text>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer} testID="empty-state">
      <Users size={64} color="#E0E0E0" weight="fill" />
      <Text style={styles.emptyText} testID="empty-text">No referrals yet — share your code!</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="loading-indicator">
        <LoadingSpinner />
      </View>
    );
  }

  const hasAnyBonusConfigured =
    rewardsConfig.first_trade_enabled || rewardsConfig.first_listing_enabled;
  const isProgramPaused = !rewardsConfig.program_enabled;
  const isShareDisabled = isProgramPaused || !hasAnyBonusConfigured;

  return (
    <ScreenLayout variant="detail" title="Referrals">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Hero Card */}
        <View style={styles.heroCard} testID="hero-card">
          <Gift size={32} color="#FFFFFF" weight="fill" />
          <Text style={styles.heroTitle} testID="hero-title">Refer Friends, Earn SP</Text>
          <Text style={styles.heroSubtext} testID="hero-subtext">Share your code and get rewards when they join.</Text>
        </View>

        {/* Active Programs Section */}
        {!hasAnyBonusConfigured ? (
          <View style={styles.noProgramsCard} testID="no-programs-card">
            <Info size={20} color="#F59E0B" weight="fill" />
            <Text style={styles.noProgramsText}>
              No active referral programs at the moment. Check back later!
            </Text>
          </View>
        ) : (
          <View style={styles.activeProgramsCard} testID="active-programs-card">
            <Text style={styles.activeProgramsTitle}>Active Rewards</Text>
            <Text style={styles.activeProgramsSubtext}>Your friends earn these bonuses when they join:</Text>

            {isProgramPaused && (
              <View style={styles.programPausedBanner} testID="program-paused-banner">
                <Info size={16} color="#A16207" weight="fill" />
                <Text style={styles.programPausedText}>
                  Referral program is paused globally right now. Rewards shown below are configured but currently not being awarded.
                </Text>
              </View>
            )}
            
            {rewardsConfig.first_trade_enabled && (
              <View style={styles.programRow} testID="trade-bonus-row">
                <View style={styles.programIcon}>
                  <Storefront size={20} color="#5DBB8E" weight="fill" />
                </View>
                <View style={styles.programContent}>
                  <Text style={styles.programLabel}>First Trade Bonus</Text>
                  <Text style={styles.programDetail}>+{rewardsConfig.referee_sp} SP when they complete their first trade</Text>
                </View>
                <View style={styles.programBadge}>
                  <Coins size={14} color="#F59E0B" weight="fill" />
                  <Text style={styles.programBadgeText}>{rewardsConfig.referee_sp} SP</Text>
                </View>
              </View>
            )}

            {rewardsConfig.first_listing_enabled && (
              <View style={styles.programRow} testID="listing-bonus-row">
                <View style={styles.programIcon}>
                  <Notebook size={20} color="#5DBB8E" weight="fill" />
                </View>
                <View style={styles.programContent}>
                  <Text style={styles.programLabel}>First Listing Bonus</Text>
                  <Text style={styles.programDetail}>+{rewardsConfig.referee_listing_sp} SP when their first listing is approved</Text>
                </View>
                <View style={styles.programBadge}>
                  <Coins size={14} color="#F59E0B" weight="fill" />
                  <Text style={styles.programBadgeText}>{rewardsConfig.referee_listing_sp} SP</Text>
                </View>
              </View>
            )}

            <View style={styles.yourEarningRow}>
              <Text style={styles.yourEarningLabel}>You earn:</Text>
              <Text style={styles.yourEarningAmount}>
                {rewardsConfig.first_trade_enabled && `${rewardsConfig.referrer_sp} SP per trade`}
                {rewardsConfig.first_trade_enabled && rewardsConfig.first_listing_enabled && ' • '}
                {rewardsConfig.first_listing_enabled && `${rewardsConfig.referrer_listing_sp} SP per listing`}
              </Text>
            </View>
          </View>
        )}

        {/* SP Earned Strip */}
        <View style={styles.spStrip} testID="sp-earned-strip">
          <Coins size={20} color="#F59E0B" weight="fill" />
          <Text style={styles.spStripText} testID="sp-earned-text">
            You've earned <Text style={styles.spStripBold}>{stats.total_sp_earned}</Text> SP from referrals
          </Text>
        </View>

        {/* Code Box */}
        <View style={styles.codeContainer} testID="code-container">
          <Text style={styles.codeText} testID="referral-code-text">{referralCode}</Text>
          <TouchableOpacity onPress={handleCopyCode} testID="copy-btn" accessibilityLabel="Copy referral code">
            <Copy size={20} color="#5DBB8E" weight="bold" />
          </TouchableOpacity>
        </View>

        {/* Share Button */}
        <TouchableOpacity 
          style={[
            styles.shareButton, 
            isShareDisabled && styles.shareButtonDisabled
          ]} 
          onPress={handleShareLink} 
          testID="share-btn" 
          accessibilityLabel="Share referral code"
          disabled={isShareDisabled}
        >
          <ShareNetwork size={18} color="#FFFFFF" weight="bold" />
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>

        <Text style={styles.historyTitle} testID="history-title">Referral History</Text>
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={renderHistoryItem}
          ListEmptyComponent={renderEmptyState}
          scrollEnabled={false}
          contentContainerStyle={styles.historyList}
        />
      </ScrollView>
    </ScreenLayout>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  headerSpacer: {
    width: 40,
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
    borderWidth: 8,
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
  shareButtonDisabled: {
    backgroundColor: '#B0B0B0',
    opacity: 0.6,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  activeProgramsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  activeProgramsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  activeProgramsSubtext: {
    fontSize: 13,
    color: '#6B6B6B',
    marginBottom: 16,
  },
  programPausedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 10,
    marginBottom: 12,
  },
  programPausedText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#92400E',
    marginLeft: 8,
  },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  programIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F9F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  programContent: {
    flex: 1,
  },
  programLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  programDetail: {
    fontSize: 12,
    color: '#6B6B6B',
  },
  programBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  programBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: 4,
  },
  yourEarningRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  yourEarningLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  yourEarningAmount: {
    fontSize: 14,
    color: '#5DBB8E',
    fontWeight: '600',
  },
  noProgramsCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  noProgramsText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
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
