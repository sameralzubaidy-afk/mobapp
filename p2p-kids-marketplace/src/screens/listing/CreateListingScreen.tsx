/**
 * File: p2p-kids-marketplace/src/screens/listing/CreateListingScreen.tsx
 * MODULE-04 LISTING-V2-002: Create listing with SP payment preference
 * MODULE-13 SAFETY-P002: Add image picker and upload functionality
 *
 * Features:
 * - Form for title, description, price, category, condition
 * - SP payment toggle (only shown to subscribers)
 * - Subscription check before allowing SP
 * - Real-time form validation
 * - Multi-image upload (up to 5 photos)
 * - Image preview with reorder and delete
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { getSubscriptionSummary } from '../../services/subscription';
import { createListing, uploadListingImages } from '../../services/listing';
import { getCategories } from '../../services/items';
import { ListingCondition } from '../../types/listing';
import BottomNavBar from '../../components/organisms/BottomNavBar';
import ImagePickerGrid, { SelectedImage } from '../../components/molecules/ImagePickerGrid';

interface ListingCategory {
  id: string;
  name: string;
  icon: string | null;
}

export default function CreateListingScreen({ navigation }: any) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceText, setPriceText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [condition, setCondition] = useState<ListingCondition>('good');
  const [acceptsSwapPoints, setAcceptsSwapPoints] = useState(false);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [categories, setCategories] = useState<ListingCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Subscription state
  const [canAcceptSP, setCanAcceptSP] = useState(false);

  // Check subscription whenever screen comes into focus (e.g., after upgrading)
  useFocusEffect(
    React.useCallback(() => {
      loadSubscription();
      loadCategories();
    }, [session?.user?.id])
  );

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const data = (await getCategories()) as ListingCategory[];
      setCategories(data || []);

      if (!categoryId && data && data.length > 0) {
        setCategoryId(data[0].id);
      }
    } catch (error) {
      console.error('[CreateListing] ❌ loadCategories error:', error);
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadSubscription = async () => {
    if (!session?.user?.id) return;

    try {
      console.log('[CreateListing] 🔍 Loading subscription status for user:', session.user.id);
      setCheckingSubscription(true);
      const summary = await getSubscriptionSummary(session.user.id);
      console.log('[CreateListing] 📊 Subscription summary:', summary);
      setCanAcceptSP(summary.can_spend_sp);

      if (summary.can_spend_sp) {
        console.log('[CreateListing] ✅ User can accept SP - SP toggle will be visible');
      } else {
        console.log('[CreateListing] ℹ️ User cannot accept SP - upgrade CTA will be shown');
      }
    } catch (error) {
      console.error('[CreateListing] ❌ loadSubscription error:', error);
      setCanAcceptSP(false);
      // Don't show alert to avoid interrupting user flow
    } finally {
      setCheckingSubscription(false);
    }
  };

  const handleCreateListing = async () => {
    // Validate form
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title');
      return;
    }

    if (title.length < 3 || title.length > 100) {
      Alert.alert('Invalid Title', 'Title must be between 3 and 100 characters');
      return;
    }

    const price = parseFloat(priceText);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price greater than $0');
      return;
    }

    if (!categoryId) {
      Alert.alert('Required', 'Please select a category');
      return;
    }

    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to create a listing');
      return;
    }

    try {
      setLoading(true);

      console.log('[CreateListing] 📝 Creating listing...');

      // Step 1: Create the listing
      const listing = await createListing({
        seller_id: session.user.id,
        title: title.trim(),
        description: description.trim(),
        price,
        category_id: categoryId,
        condition,
        accepts_swap_points: canAcceptSP ? acceptsSwapPoints : false,
      });

      console.log('[CreateListing] ✅ Listing created:', listing.id);

      // Step 2: Upload images if any
      if (selectedImages.length > 0) {
        console.log(`[CreateListing] 📤 Uploading ${selectedImages.length} images...`);
        setUploadingImages(true);

        try {
          const imageUris = selectedImages.map((img) => img.uri);
          await uploadListingImages(listing.id, session.user.id, imageUris);
          console.log('[CreateListing] ✅ All images uploaded successfully');
        } catch (imageError: any) {
          console.error('[CreateListing] ⚠️ Image upload error:', imageError);
          // Continue even if image upload fails - listing is already created
          Alert.alert(
            'Partial Success',
            'Listing created but some images failed to upload. You can add images later by editing the listing.',
            [
              {
                text: 'OK',
                onPress: () => navigation.goBack(),
              },
            ]
          );
          return;
        } finally {
          setUploadingImages(false);
        }
      }

      Alert.alert('Success', 'Listing created successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      console.error('[CreateListing] handleCreateListing error:', error);
      Alert.alert('Error', error.message || 'Failed to create listing');
    } finally {
      setLoading(false);
      setUploadingImages(false);
    }
  };

  if (checkingSubscription) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Checking subscription...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, flexDirection: 'column' }}>
        <ScrollView style={styles.container}>
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Item Details</Text>

            {/* Title */}
            <Text style={styles.label}>Title *</Text>
            <TextInput
              testID="create-listing-title-input"
              style={styles.input}
              placeholder="e.g., LEGO Star Wars Set"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
            <Text style={styles.hint}>{title.length}/100 characters</Text>

            {/* Description */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              testID="create-listing-description-input"
              style={[styles.input, styles.textArea]}
              placeholder="Describe your item..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={1000}
            />

            {/* Price */}
            <Text style={styles.label}>Price ($) *</Text>
            <TextInput
              testID="create-listing-price-input"
              style={styles.input}
              placeholder="0.00"
              value={priceText}
              onChangeText={setPriceText}
              keyboardType="decimal-pad"
            />

            {/* Category */}
            <Text style={styles.label}>Category *</Text>
            {loadingCategories ? (
              <View style={styles.inlineLoader}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.hint}>Loading categories...</Text>
              </View>
            ) : categories.length === 0 ? (
              <Text style={styles.errorText}>
                No active categories found. Please contact support.
              </Text>
            ) : (
              <View style={styles.categoryButtons}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryButton,
                      categoryId === category.id && styles.categoryButtonActive,
                    ]}
                    onPress={() => setCategoryId(category.id)}
                    testID={`create-listing-category-${category.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        categoryId === category.id && styles.categoryButtonTextActive,
                      ]}
                    >
                      {category.icon ? `${category.icon} ` : ''}
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Condition */}
            <Text style={styles.label}>Condition *</Text>
            <View style={styles.conditionButtons}>
              {(['new', 'like_new', 'good', 'fair', 'poor'] as ListingCondition[]).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.conditionButton, condition === c && styles.conditionButtonActive]}
                  onPress={() => setCondition(c)}
                >
                  <Text
                    style={[
                      styles.conditionButtonText,
                      condition === c && styles.conditionButtonTextActive,
                    ]}
                  >
                    {c.replace('_', ' ').toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* V2 SAFETY-P002: Image Picker */}
            <ImagePickerGrid
              images={selectedImages}
              onImagesChange={setSelectedImages}
              uploading={uploadingImages}
              maxImages={5}
              testID="create-listing-image-picker"
            />

            {/* V2: Swap Points Payment Preference */}
            <View style={styles.spSection}>
              <Text style={styles.sectionTitle}>Payment Preference</Text>

              {canAcceptSP ? (
                <>
                  <View style={styles.spToggleRow}>
                    <View style={styles.spToggleLabel}>
                      <Text style={styles.label}>Accept Swap Points?</Text>
                      <Text style={styles.hint}>
                        Allow buyers to pay up to 50% with Swap Points
                      </Text>
                    </View>
                    <Switch
                      value={acceptsSwapPoints}
                      onValueChange={setAcceptsSwapPoints}
                      trackColor={{ false: '#ccc', true: '#34C759' }}
                      thumbColor="#fff"
                    />
                  </View>
                  {acceptsSwapPoints && (
                    <View style={styles.spEligibleBadge}>
                      <Text style={styles.spEligibleText}>✓ SP Eligible</Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.upgradePrompt}>
                  <Text style={styles.upgradeText}>
                    🌟 Subscribe to Kids Club+ to accept Swap Points and unlock more features!
                  </Text>
                  <TouchableOpacity
                    style={styles.upgradeButton}
                    onPress={() => navigation.navigate('SubscriptionChoice')}
                  >
                    <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Create Button */}
            <TouchableOpacity
              testID="create-listing-submit-button"
              style={[
                styles.createButton,
                (loading || uploadingImages) && styles.createButtonDisabled,
              ]}
              onPress={handleCreateListing}
              disabled={loading || uploadingImages}
            >
              {loading || uploadingImages ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.createButtonText}>
                    {uploadingImages ? 'Uploading images...' : 'Creating...'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.createButtonText}>Create Listing</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
        <BottomNavBar />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  form: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 12,
    color: '#000',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  inlineLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 13,
    marginTop: 4,
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  categoryButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  conditionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  conditionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  conditionButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  conditionButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  conditionButtonTextActive: {
    color: '#fff',
  },
  spSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  spToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spToggleLabel: {
    flex: 1,
    marginRight: 12,
  },
  spEligibleBadge: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  spEligibleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    textAlign: 'center',
  },
  upgradePrompt: {
    alignItems: 'center',
    padding: 12,
  },
  upgradeText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  upgradeButton: {
    backgroundColor: '#FFB74D',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  createButton: {
    marginTop: 32,
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Navigation handled by BottomNavBar
});
