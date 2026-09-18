/**
 * Unit tests for uploadFailureFormat
 * FIX-Task-61 item 1: shared per-photo upload-failure copy.
 *
 * Two contracts are asserted here and they must not be confused:
 *   - `buildUploadFailureMessage` is the BULK screen's copy (failed photos are
 *     skipped), moved verbatim out of BulkListingCreateScreen. Its wording,
 *     ordering and "+N more" truncation must stay byte-identical.
 *   - `buildRejectedPhotoMessage` is the ITEMCREATE copy: the photo is NOT skipped,
 *     it stays in the strip and blocks Publish until removed or replaced.
 */

import {
  buildRejectedPhotoMessage,
  buildUploadFailureMessage,
  photoLabelFromUri,
  summarizeRejectedPhotos,
} from '../uploadFailureFormat';

describe('uploadFailureFormat', () => {
  describe('photoLabelFromUri', () => {
    it('uses the file name tail when the URI has one', () => {
      expect(photoLabelFromUri('file:///tmp/picked/IMG_0042.png', 0)).toBe('IMG_0042.png');
    });

    it('falls back to the 1-based position when there is no usable tail', () => {
      expect(photoLabelFromUri('', 2)).toBe('Photo 3');
    });
  });

  describe('buildUploadFailureMessage (Bulk contract — unchanged)', () => {
    it('renders the singular header, the reason and the Bulk retry hint', () => {
      const message = buildUploadFailureMessage(
        [{ index: 0, error: 'Image must be smaller than 10MB' }],
        [{ uri: 'file:///tmp/IMG_1.png' }]
      );

      expect(message).toBe(
        '1 photo failed to upload and was skipped.\n' +
          '- IMG_1.png: Image must be smaller than 10MB\n' +
          'Use "+ Add more photos" to retry.'
      );
    });

    it('renders the plural header', () => {
      const message = buildUploadFailureMessage(
        [
          { index: 0, error: 'Only JPEG, PNG, WebP, and HEIC images are supported' },
          { index: 1, error: 'Image must be smaller than 10MB' },
        ],
        [{ uri: 'a.gif' }, { uri: 'b.png' }]
      );

      expect(message.startsWith('2 photos failed to upload and were skipped.')).toBe(true);
      expect(message).toContain('- a.gif: Only JPEG, PNG, WebP, and HEIC images are supported');
      expect(message).toContain('- b.png: Image must be smaller than 10MB');
    });

    it('caps the listed reasons at three and collapses the rest into a "+N more" line', () => {
      const errors = [0, 1, 2, 3, 4].map((index) => ({ index, error: `reason ${index}` }));
      const photos = [0, 1, 2, 3, 4].map((i) => ({ uri: `photo-${i}.png` }));

      const message = buildUploadFailureMessage(errors, photos);

      expect(message).toContain('- photo-0.png: reason 0');
      expect(message).toContain('- photo-2.png: reason 2');
      expect(message).not.toContain('reason 3');
      expect(message).toContain('- +2 more failure(s)');
    });
  });

  describe('buildRejectedPhotoMessage (ItemCreate contract — photo is NOT skipped)', () => {
    it('renders the singular heading and the fix-it instruction', () => {
      const message = buildRejectedPhotoMessage(
        [{ index: 0, error: 'Only JPEG, PNG, WebP, and HEIC images are supported' }],
        [{ uri: 'content://media/picker/bad.gif' }]
      );

      expect(message).toBe(
        "1 photo can't be uploaded\n" +
          '- bad.gif: Only JPEG, PNG, WebP, and HEIC images are supported\n' +
          'Remove or replace it, then try again.'
      );
    });

    it('switches to the plural heading and instruction for multiple rejections', () => {
      const message = buildRejectedPhotoMessage(
        [
          { index: 0, error: 'Image must be smaller than 10MB' },
          { index: 1, error: 'Image must be at least 400×400 pixels' },
        ],
        [{ uri: 'huge.png' }, { uri: 'tiny.png' }]
      );

      expect(message).toContain("2 photos can't be uploaded");
      expect(message).toContain('- huge.png: Image must be smaller than 10MB');
      expect(message).toContain('- tiny.png: Image must be at least 400×400 pixels');
      expect(message).toContain('Remove or replace them, then try again.');
    });

    it('never says the photo was skipped — the whole point is that it stays visible', () => {
      const message = buildRejectedPhotoMessage(
        [{ index: 0, error: 'Image must be smaller than 10MB' }],
        [{ uri: 'huge.png' }]
      );

      expect(message).not.toContain('skipped');
      expect(message).not.toContain('Add more photos');
    });

    it('exposes a structured summary for the persistent inline card', () => {
      const summary = summarizeRejectedPhotos(
        [{ index: 0, error: 'Image must be smaller than 10MB' }],
        [{ uri: 'huge.png' }]
      );

      expect(summary.heading).toBe("1 photo can't be uploaded");
      expect(summary.details).toEqual(['huge.png: Image must be smaller than 10MB']);
      expect(summary.overflowLine).toBeNull();
      expect(summary.instruction).toBe('Remove or replace it, then try again.');
    });

    it('collapses reasons beyond three in the summary too', () => {
      const errors = [0, 1, 2, 3].map((index) => ({ index, error: 'too big' }));
      const photos = [0, 1, 2, 3].map((i) => ({ uri: `p${i}.png` }));

      const summary = summarizeRejectedPhotos(errors, photos);

      expect(summary.details).toHaveLength(3);
      expect(summary.overflowLine).toBe("+1 more photo(s) couldn't upload");
    });
  });
});
