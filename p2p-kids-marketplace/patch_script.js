const fs = require('fs');
const content = fs.readFileSync('src/screens/profile/SellerProfileScreen.tsx', 'utf8');

let newContent = content.replace(
  "import { Star, ShieldCheck, MapPin } from 'phosphor-react-native';",
  "import { Star, ShieldCheck, MapPin, IdentificationCard, UserPlus, Check } from 'phosphor-react-native';"
);

newContent = newContent.replace(
  "const [badges, setBadges] = useState<UserBadge[]>([]);",
  "const [badges, setBadges] = useState<UserBadge[]>([]);\n  const [isFollowing, setIsFollowing] = useState(false);"
);

const oldJSX = `{/* Trust Indicators Section */}
          <View style={styles.trustSection}>
            <Text style={styles.sectionTitle}>Trust Indicators</Text>
            {profile.verification_status === 'approved' && (
              <View style={styles.trustBadgeRow}>
                <ShieldCheck size={20} color="#5DBB8E" weight="fill" />
                <Text style={styles.trustBadgeText}>ID Verified Seller</Text>
              </View>
            )}
            {badges.map((userBadge) => (
              <View key={userBadge.id} style={styles.trustBadgeRow}>
                <ShieldCheck size={20} color="#5DBB8E" weight="regular" />
                <Text style={styles.trustBadgeText}>{userBadge.badge?.name || 'Earned Badge'}</Text>
              </View>
            ))}
            {profile.verification_status !== 'approved' && badges.length === 0 && (
              <Text style={styles.noTrustText}>No trust indicators yet</Text>
            )}
          </View>

          {/* Rating Summary - FLOW-15 */}
          <View style={styles.ratingRow}>
            {reviewStats && reviewStats.total_reviews > 0 ? (
              <>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={16}
                      color={star <= Math.round(reviewStats.average_rating) ? '#F59E0B' : '#E0E0E0'}
                      weight={star <= Math.round(reviewStats.average_rating) ? 'fill' : 'regular'}
                    />
                  ))}
                </View>
                <Text style={styles.ratingNumber}>{reviewStats.average_rating.toFixed(1)}</Text>
                <Text style={styles.reviewCount}>({reviewStats.total_reviews} reviews)</Text>
              </>
            ) : (
              <Text style={styles.noReviewsText}>No ratings yet</Text>
            )}
          </View>`;

const newJSX = `{/* Rating Summary - FLOW-15 */}
            <View style={styles.ratingRow}>
              {reviewStats && reviewStats.total_reviews > 0 ? (
                <>
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={16}
                        color={star <= Math.round(reviewStats.average_rating) ? '#F59E0B' : '#E0E0E0'}
                        weight={star <= Math.round(reviewStats.average_rating) ? 'fill' : 'regular'}
                      />
                    ))}
                  </View>
                  <Text style={styles.ratingNumber}>{reviewStats.average_rating.toFixed(1)}</Text>
                  <Text style={styles.reviewCount}>({reviewStats.total_reviews} reviews)</Text>
                </>
              ) : (
                <Text style={styles.noReviewsText}>No ratings yet</Text>
              )}
            </View>

            {/* Follow Button */}
            <TouchableOpacity
              style={[styles.followButton, isFollowing && styles.followingButton]}
              onPress={() => setIsFollowing(!isFollowing)}
            >
              {isFollowing ? (
                <>
                  <Check size={16} color="#5DBB8E" weight="bold" />
                  <Text style={[styles.followButtonText, styles.followingButtonText]}>Following</Text>
                </>
              ) : (
                <>
                  <UserPlus size={16} color="#FFFFFF" weight="bold" />
                  <Text style={styles.followButtonText}>Follow</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Trust Indicators Section */}
          <View style={styles.trustSection}>
            {profile.verification_status === 'approved' && (
              <View style={[styles.promoCard, styles.verifiedCard]}>
                <View style={[styles.promoIconContainer, { backgroundColor: '#ECFDF5' }]}>
                  <IdentificationCard size={24} color="#10B981" weight="bold" />
                </View>
                <View style={styles.promoContent}>
                  <Text style={[styles.promoTitle, { color: '#10B981' }]}>Identity Verified</Text>
                  <Text style={styles.promoSubtitle}>Trust level: Ultimate</Text>
                </View>
              </View>
            )}

            {(badges.length > 0) && (
              <View style={styles.badgesWrapper}>
                <Text style={styles.badgesTitle}>Badges ({badges.length})</Text>
                <View style={styles.badgesList}>
                  {badges.map((userBadge) => (
                    <View key={userBadge.id} style={styles.trustBadgeRow}>
                      <ShieldCheck size={20} color="#5DBB8E" weight="fill" />
                      <Text style={styles.trustBadgeText}>{userBadge.badge?.name || 'Earned Badge'}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            
            {profile.verification_status !== 'approved' && badges.length === 0 && (
              <Text style={styles.noTrustText}>No trust indicators yet</Text>
            )}
          </View>

          {/* Active Listings Section */}`;

// The old JSX is wrapped somewhat tricky. Let's do a substring replace.
// We'll replace from `{/* Trust Indicators Section */}` down to just before `{/* Active Listings Section */}`
const startIdx = newContent.indexOf('{/* Trust Indicators Section */}');
const endIdx = newContent.indexOf('{/* Active Listings Section */}');

if (startIdx > -1 && endIdx > -1) {
  newContent = newContent.substring(0, startIdx) + newJSX.substring(0, newJSX.length - 27) + '\n          {/* Active Listings Section */}' + newContent.substring(endIdx + 29);
} else {
  console.log("Failed to find JSX markers");
}

const stylesOld = `  bio: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  starRow: {`;

const stylesNew = `  bio: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5DBB8E',
    borderRadius: 22,
    height: 44,
    paddingHorizontal: 24,
    gap: 8,
  },
  followingButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#5DBB8E',
  },
  followButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  followingButtonText: {
    color: '#5DBB8E',
  },
  starRow: {`;

newContent = newContent.replace(stylesOld, stylesNew);

const stylesSectionOld = `  trustBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },`;

const stylesSectionNew = `  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 2,
    width: '100%',
    marginBottom: 20,
  },
  verifiedCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  promoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  promoContent: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  promoSubtitle: {
    fontSize: 12,
    color: '#6B6B6B',
  },
  badgesWrapper: {
    width: '100%',
  },
  badgesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  badgesList: {
    width: '100%',
  },
  trustBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },`;

newContent = newContent.replace(stylesSectionOld, stylesSectionNew);

fs.writeFileSync('src/screens/profile/SellerProfileScreen.tsx', newContent);
console.log('Update complete.');
