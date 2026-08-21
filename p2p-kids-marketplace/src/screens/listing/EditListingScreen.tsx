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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { getSubscriptionSummary } from '../../services/subscription';
import { deleteListing, updateListing, getListingById, syncListingImages } from '../../services/listing';
import { getCategories } from '../../services/items';
import { getConfigValue } from '../../services/adminConfig';
import { Listing, ListingCondition } from '../../types/listing';
import ImagePickerGrid, { SelectedImage } from '../../components/molecules/ImagePickerGrid';
import { ColorPicker } from '../../components/listing/ColorPicker';
import { AgeGroupSelector } from '../../components/listing/AgeGroupSelector';
import { GenderSelector } from '../../components/listing/GenderSelector';
import ScreenLayout from '@/components/ScreenLayout';
import { LoadingSpinner } from '@/components/ui';
import { PriceAdjustmentModal } from '../../components/listing/PriceAdjustmentModal';

interface ListingCategory {
  id: string;
  name: string;
  icon: string | null;
}

type ListingAgeGroup = '0-2' | '3-5' | '6-8' | '9-12' | '13+';
type ListingGender = 'boy' | 'girl' | 'unisex';

export default function EditListingScreen({ route, navigation }: any) {
  const { listing_id } = route.params;
  const { session } = useAuth();

  const [loading, setLoading] = useState(false);
  const [syncingImages, setSyncingImages] = useState(false);
  const [loadingListing, setLoadingListing] = useState(true);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalTitle, setSuccessModalTitle] = useState('Changes Saved');
  const [successModalMessage, setSuccessModalMessage] = useState(
    'Your listing was updated successfully.'
  );
  const [successModalTarget, setSuccessModalTarget] = useState<'goBack' | 'myListings'>('goBack');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceText, setPriceText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [requestedCategoryName, setRequestedCategoryName] = useState('');
  const [condition, setCondition] = useState<ListingCondition>('good');
  const [brand, setBrand] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [ageGroup, setAgeGroup] = useState<ListingAgeGroup | null>(null);
  const [gender, setGender] = useState<ListingGender | null>(null);
  const [acceptsSwapPoints, setAcceptsSwapPoints] = useState(false);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [categories, setCategories] = useState<ListingCategory[]>([]);

  // Subscription state
  const [canAcceptSP, setCanAcceptSP] = useState(false);

  // Min listing price from admin config
  const [minListingPrice, setMinListingPrice] = useState(0);
  const [showPriceAdjustmentModal, setShowPriceAdjustmentModal] = useState(false);
  const [priceFieldY, setPriceFieldY] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const priceInputRef = useRef<TextInput>(null);

  // Original listing
  const [originalListing, setOriginalListing] = useState<Listing | null>(null);

  // Load listing and subscription on mount
  useEffect(() => {
    loadData();
    loadMinListingPrice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing_id]);

  const loadMinListingPrice = async () => {
    try {
      const value = await getConfigValue('min_listing_price');
      setMinListingPrice(Number(value) || 0);
    } catch {
      setMinListingPrice(0);
    }
  };

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
      setRequestedCategoryName(listing.requested_category_name || '');
      setCondition(listing.condition || 'good');
      setBrand(listing.brand || '');
      setColors(Array.isArray(listing.color) ? listing.color : []);
      setAgeGroup((listing.age_group as ListingAgeGroup | null) || null);
      setGender((listing.gender as ListingGender | null) || null);
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
    if (minListingPrice > 0 && price < minListingPrice) {
      setShowPriceAdjustmentModal(true);
      return;
    }

    if (!categoryId) {
      Alert.alert('Required', 'Please select a category');
      return;
    }

    const selectedCategory = categories.find((category) => category.id === categoryId);
    const isOtherCategory = selectedCategory?.name?.trim().toLowerCase() === 'other';
    if (isOtherCategory && !requestedCategoryName.trim()) {
      Alert.alert('Required', 'Please provide the custom category name');
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
        requested_category_name: isOtherCategory ? requestedCategoryName.trim() : null,
        condition,
        brand: brand.trim() || null,
        color: colors.length > 0 ? colors : null,
        age_group: ageGroup,
        gender,
        accepts_swap_points: canAcceptSP ? acceptsSwapPoints : false,
      });

      setSyncingImages(true);
      await syncListingImages(
        listing_id,
        session.user.id,
        images.map((image) => ({ id: image.id, uri: image.uri }))
      );

      setSuccessModalTitle('Changes Saved');
      setSuccessModalMessage('Your listing was updated successfully.');
      setSuccessModalTarget('goBack');
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('[EditListing] handleSaveChanges error:', error);
      Alert.alert('Error', error.message || 'Failed to update listing');
    } finally {
      setLoading(false);
      setSyncingImages(false);
    }
  };

  const handleDeleteListing = async () => {
    if (!session?.user?.id || !originalListing) return;

    Alert.alert('Delete Listing', 'Are you sure you want to delete this listing?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await deleteListing(listing_id, session.user.id);
            setSuccessModalTitle('Listing Deleted');
            setSuccessModalMessage('Your listing was deleted successfully.');
            setSuccessModalTarget('myListings');
            setShowSuccessModal(true);
          } catch (error: any) {
            console.error('[EditListing] handleDeleteListing error:', error);
            Alert.alert('Error', error.message || 'Failed to delete listing');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  // NOTE: useCallback must stay BEFORE the early return to avoid
  // "Rendered more hooks than during the previous render" errors.
  const handlePriceAdjustmentUpdate = useCallback(() => {
    setShowPriceAdjustmentModal(false);
    setTimeout(() => {
      if (priceFieldY > 0) {
        scrollViewRef.current?.scrollTo({ y: Math.max(0, priceFieldY - 100), animated: true });
      }
      setTimeout(() => {
        priceInputRef.current?.focus();
      }, 350);
    }, 100);
  }, [priceFieldY]);

  // DEV-ONLY fixture: fill title/price/condition in one tap (mirrors ItemCreate's
  // dev-fill-item) so QA can skip the manual form-fill + keypad-dismiss dance and
  // jump straight to Save Changes. Gated by __DEV__ — never in release builds.
  const handleDevFillItem = useCallback(() => {
    setTitle('QA Dev Fixture Item');
    setPriceText('20');
    setCondition('new');
  }, []);

  if (loadingListing || checkingSubscription) {
    return (
      <ScreenLayout variant="detail" title="Edit Listing">
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Loading listing...</Text>
        </View>
      </ScreenLayout>
    );
  }

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const isOtherCategory = selectedCategory?.name?.trim().toLowerCase() === 'other';

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    if (successModalTarget === 'myListings') {
      navigation.navigate('MyListings');
      return;
    }

    navigation.goBack();
  };

  return (
    <ScreenLayout variant="detail" title="Edit Listing">
      <ScrollView ref={scrollViewRef} style={styles.container}>
        <View style={styles.form}>
        <Text style={styles.sectionTitle}>Edit Item Details</Text>

        {/* DEV-ONLY: fill title/price/condition in one tap so QA can skip the
            manual form-fill + keypad-dismiss dance. Never in release builds. */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.devFillButton}
            onPress={handleDevFillItem}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Fill edit form with test values (dev only)"
            testID="dev-fill-item"
          >
            <Text style={styles.devFillButtonText}>Dev: Fill Item (Title/Price/Condition)</Text>
          </TouchableOpacity>
        )}

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
        <View style={styles.field} onLayout={(e) => setPriceFieldY(e.nativeEvent.layout.y)}>
          <Text style={styles.label}>Price ($) *</Text>
          <TextInput
            ref={priceInputRef}
            style={styles.input}
            placeholder="0.00"
            value={priceText}
            onChangeText={setPriceText}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Category */}
        <Text style={styles.label}>Category *</Text>
        {categories.length === 0 ? (
          <Text style={styles.errorText}>No active categories found. Please contact support.</Text>
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
                testID={`edit-listing-category-${category.name.toLowerCase().replace(/\s+/g, '-')}`}
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
          {(['new', 'like_new', 'good', 'fair', 'worn'] as ListingCondition[]).map((c) => (
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

        {isOtherCategory && (
          <>
            <Text style={styles.label}>Custom Category Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Board Games"
              value={requestedCategoryName}
              onChangeText={setRequestedCategoryName}
              maxLength={100}
            />
          </>
        )}

        <Text style={styles.label}>Brand</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Nike"
          value={brand}
          onChangeText={setBrand}
          maxLength={100}
        />

        <View style={styles.v3SectionSpacer}>
          <ColorPicker selectedColors={colors} onChange={setColors} />
        </View>

        <AgeGroupSelector value={ageGroup} onChange={setAgeGroup} />

        <GenderSelector value={gender} onChange={setGender} />

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
                  <Text style={styles.hint}>Allow buyers to pay with Swap Points</Text>
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
              <Text style={styles.infoText}>ℹ️ Subscribe to Kids Club+ to accept Swap Points</Text>
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
              <Text style={styles.saveButtonText}>
                {syncingImages ? 'Saving photos...' : 'Saving...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteLinkButton, (loading || syncingImages) && styles.saveButtonDisabled]}
          onPress={handleDeleteListing}
          disabled={loading || syncingImages}
        >
          <Text style={styles.deleteLinkText}>Delete Listing</Text>
        </TouchableOpacity>

        {/* Cancel Button */}
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Price Adjustment Modal (min listing price validation) */}
      <PriceAdjustmentModal
        visible={showPriceAdjustmentModal}
        minPrice={minListingPrice}
        onUpdatePrice={handlePriceAdjustmentUpdate}
      />

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={handleSuccessModalClose}
      >
        <View style={styles.successModalBackdrop}>
          <View style={styles.successModalCard}>
            <View style={styles.successIconBadge}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.successModalTitle}>{successModalTitle}</Text>
            <Text style={styles.successModalMessage}>{successModalMessage}</Text>

            <TouchableOpacity
              style={styles.successModalButton}
              onPress={handleSuccessModalClose}
              testID="edit-listing-success-ok"
            >
              <Text style={styles.successModalButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    padding: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 12,
    color: '#1A1A1A',
  },
  devFillButton: {
    backgroundColor: '#EAF7F0',
    borderColor: '#5DBB8E',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  devFillButtonText: {
    color: '#2E7D5B',
    fontSize: 14,
    fontWeight: '600',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
    color: '#333',
  },
  input: {
    backgroundColor: '#F0F0F0',
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 52,
    fontSize: 16,
    color: '#1A1A1A',
  },
  textArea: {
    minHeight: 100,
    paddingVertical: 12,
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 0,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  categoryButtonActive: {
    backgroundColor: '#5DBB8E',
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 0,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  conditionButtonActive: {
    backgroundColor: '#5DBB8E',
  },
  conditionButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  conditionButtonTextActive: {
    color: '#fff',
  },
  v3SectionSpacer: {
    marginTop: 8,
  },
  spSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0,
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
    backgroundColor: '#5DBB8E',
    minHeight: 52,
    paddingVertical: 14,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  deleteLinkButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  deleteLinkText: {
    color: '#E85D75',
    fontSize: 14,
    fontWeight: '500',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelButton: {
    marginTop: 12,
    minHeight: 48,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6B6B6B',
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B6B6B',
  },
  successModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  successIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F5F0',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successIconText: {
    fontSize: 28,
    color: '#14805E',
    fontWeight: '700',
  },
  successModalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  successModalMessage: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 18,
    lineHeight: 24,
    color: '#4B5563',
    textAlign: 'center',
  },
  successModalButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: '#5DBB8E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successModalButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  field: {
    marginBottom: 16,
  },
});
