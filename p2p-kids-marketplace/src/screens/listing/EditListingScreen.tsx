/**
 * File: p2p-kids-marketplace/src/screens/listing/EditListingScreen.tsx
 * MODULE-04 LISTING-V2-003: Edit listing with V2 rules
 * 
 * Features:
 * - Pre-filled form with existing listing data
 * - Ownership verification (only seller can edit)
 * - Active trade check (cannot edit if trades in progress)
 * - SP toggle re-validation on change
 */

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { getSubscriptionSummary } from '../../services/subscription';
import { updateListing, getListingById, syncListingImages } from '../../services/listing';
import { getCategories } from '../../services/items';
import { Listing, ListingCondition } from '../../types/listing';
import ImagePickerGrid, { SelectedImage } from '../../components/molecules/ImagePickerGrid';

interface ListingCategory {
  id: string;
  name: string;
  icon: string | null;
}

export default function EditListingScreen({ route, navigation }: any) {
  const { listing_id } = route.params;
  const { session } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [syncingImages, setSyncingImages] = useState(false);
  const [loadingListing, setLoadingListing] = useState(true);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceText, setPriceText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [condition, setCondition] = useState<ListingCondition>('good');
  const [acceptsSwapPoints, setAcceptsSwapPoints] = useState(false);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [categories, setCategories] = useState<ListingCategory[]>([]);
  
  // Subscription state
  const [canAcceptSP, setCanAcceptSP] = useState(false);
  
  // Original listing
  const [originalListing, setOriginalListing] = useState<Listing | null>(null);

  // Load listing and subscription on mount
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing_id]);

  const loadData = async () => {
    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in');
      navigation.goBack();
      return;
    }

    try {
      setLoadingListing(true);
      setCheckingSubscription(true);

      // Load listing
      const listing = await getListingById(listing_id);
      if (!listing) {
        Alert.alert('Error', 'Listing not found');
        navigation.goBack();
        return;
      }

      // Verify ownership
      if (listing.seller_id !== session.user.id) {
        Alert.alert('Error', 'You are not authorized to edit this listing');
        navigation.goBack();
        return;
      }

      setOriginalListing(listing);
      setTitle(listing.title);
      setDescription(listing.description || '');
      setPriceText(listing.price.toString());
      setCategoryId(listing.category_id || '');
      setCondition(listing.condition || 'good');
      setAcceptsSwapPoints(listing.accepts_swap_points);
      setImages(
        [...(listing.images ?? [])]
          .sort((a, b) => a.display_order - b.display_order)
          .map((image) => ({
            id: image.id,
            uri: image.url,
            width: 0,
            height: 0,
          }))
      );

      // Check subscription
      const summary = await getSubscriptionSummary(session.user.id);
      setCanAcceptSP(summary.can_spend_sp);

      const categoryRows = (await getCategories()) as ListingCategory[];
      setCategories(categoryRows || []);
      if (!listing.category_id && categoryRows.length > 0) {
        setCategoryId(categoryRows[0].id);
      }
    } catch (error) {
      console.error('[EditListing] loadData error:', error);
      Alert.alert('Error', 'Failed to load listing');
      navigation.goBack();
    } finally {
      setLoadingListing(false);
      setCheckingSubscription(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!session?.user?.id || !originalListing) return;

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

    try {
      setLoading(true);

      await updateListing({
        listing_id,
        user_id: session.user.id,
        title: title.trim(),
        description: description.trim(),
        price,
        category_id: categoryId,
        condition,
        accepts_swap_points: canAcceptSP ? acceptsSwapPoints : false,
      });

      setSyncingImages(true);
      await syncListingImages(
        listing_id,
        session.user.id,
        images.map((image) => ({ id: image.id, uri: image.uri }))
      );

      Alert.alert('Success', 'Listing updated successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      console.error('[EditListing] handleSaveChanges error:', error);
      Alert.alert('Error', error.message || 'Failed to update listing');
    } finally {
      setLoading(false);
      setSyncingImages(false);
    }
  };

  if (loadingListing || checkingSubscription) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading listing...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Edit Item Details</Text>

        {/* Title */}
        <Text style={styles.label}>Title *</Text>
        <TextInput
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
          style={styles.input}
          placeholder="0.00"
          value={priceText}
          onChangeText={setPriceText}
          keyboardType="decimal-pad"
        />

        {/* Category */}
        <Text style={styles.label}>Category *</Text>
        {categories.length === 0 ? (
          <Text style={styles.errorText}>No active categories found. Please contact support.</Text>
        ) : (
          <View style={styles.categoryButtons}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[styles.categoryButton, categoryId === category.id && styles.categoryButtonActive]}
                onPress={() => setCategoryId(category.id)}
                testID={`edit-listing-category-${category.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Text style={[styles.categoryButtonText, categoryId === category.id && styles.categoryButtonTextActive]}>
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
                style={[styles.conditionButtonText, condition === c && styles.conditionButtonTextActive]}
              >
                {c.replace('_', ' ').toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Listing Photos */}
        <Text style={styles.label}>Photos</Text>
        <ImagePickerGrid
          images={images}
          onImagesChange={setImages}
          uploading={loading || syncingImages}
          maxImages={5}
          testID="edit-listing-image-picker"
        />
        <Text style={styles.hint}>Add up to 5 photos. The first photo is the cover image.</Text>

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
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                ℹ️ Subscribe to Kids Club+ to accept Swap Points
              </Text>
            </View>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, (loading || syncingImages) && styles.saveButtonDisabled]}
          onPress={handleSaveChanges}
          disabled={loading || syncingImages}
        >
          {loading || syncingImages ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.saveButtonText}>{syncingImages ? 'Saving photos...' : 'Saving...'}</Text>
            </View>
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  infoBox: {
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    textAlign: 'center',
  },
  saveButton: {
    marginTop: 32,
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
});
