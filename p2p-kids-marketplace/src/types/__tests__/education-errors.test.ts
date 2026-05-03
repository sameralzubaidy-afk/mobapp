// FILE: p2p-kids-marketplace/src/types/__tests__/education-errors.test.ts
// MODULE-18 V1 EDU-002: Unit tests for education error classes

import {
  ContentValidationError,
  AnalyticsWriteError,
} from '../education-errors';

describe('Education Error Classes', () => {
  describe('ContentValidationError', () => {
    it('should have correct code and name', () => {
      const error = new ContentValidationError('Title is too short');

      expect(error.code).toBe('CONTENT_VALIDATION');
      expect(error.name).toBe('ContentValidationError');
      expect(error.message).toBe('Title is too short');
    });

    it('should include field when provided', () => {
      const error = new ContentValidationError('Must be between 3-100 characters', 'title');

      expect(error.field).toBe('title');
      expect(error.message).toBe('Must be between 3-100 characters');
    });

    it('should allow undefined field', () => {
      const error = new ContentValidationError('Invalid content');

      expect(error.field).toBeUndefined();
    });

    it('should extend Error correctly', () => {
      const error = new ContentValidationError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ContentValidationError);
    });

    it('should have proper stack trace', () => {
      const error = new ContentValidationError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ContentValidationError');
    });

    it('should be throwable and catchable', () => {
      const throwError = () => {
        throw new ContentValidationError('Body is too long', 'body');
      };

      expect(throwError).toThrow(ContentValidationError);
      expect(throwError).toThrow('Body is too long');

      try {
        throwError();
      } catch (err) {
        if (err instanceof ContentValidationError) {
          expect(err.code).toBe('CONTENT_VALIDATION');
          expect(err.field).toBe('body');
        }
      }
    });
  });

  describe('AnalyticsWriteError', () => {
    it('should have correct code and name', () => {
      const error = new AnalyticsWriteError('Failed to write event');

      expect(error.code).toBe('ANALYTICS_WRITE_FAILED');
      expect(error.name).toBe('AnalyticsWriteError');
      expect(error.message).toBe('Failed to write event');
    });

    it('should include eventType when provided', () => {
      const error = new AnalyticsWriteError('Database connection failed', 'calculator_use');

      expect(error.eventType).toBe('calculator_use');
      expect(error.message).toBe('Database connection failed');
    });

    it('should allow undefined eventType', () => {
      const error = new AnalyticsWriteError('Unknown error');

      expect(error.eventType).toBeUndefined();
    });

    it('should extend Error correctly', () => {
      const error = new AnalyticsWriteError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AnalyticsWriteError);
    });

    it('should have proper stack trace', () => {
      const error = new AnalyticsWriteError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AnalyticsWriteError');
    });

    it('should be used for logging (not throwing)', () => {
      // This error is NEVER thrown — used for type-safe logging
      const logAnalyticsError = (err: AnalyticsWriteError) => {
        console.warn(`[Analytics] ${err.code}: ${err.message}`, {
          eventType: err.eventType,
        });
      };

      const error = new AnalyticsWriteError('RLS violation', 'section_expand');

      // Should not throw
      expect(() => logAnalyticsError(error)).not.toThrow();
    });
  });

  describe('Error class type guards', () => {
    it('should distinguish between error types', () => {
      const contentError = new ContentValidationError('Invalid title', 'title');
      const analyticsError = new AnalyticsWriteError('Failed to log', 'help_view');

      const handleError = (err: Error) => {
        if (err instanceof ContentValidationError) {
          return { type: 'content', code: err.code, field: err.field };
        } else if (err instanceof AnalyticsWriteError) {
          return { type: 'analytics', code: err.code, eventType: err.eventType };
        }
        return { type: 'unknown' };
      };

      expect(handleError(contentError)).toEqual({
        type: 'content',
        code: 'CONTENT_VALIDATION',
        field: 'title',
      });

      expect(handleError(analyticsError)).toEqual({
        type: 'analytics',
        code: 'ANALYTICS_WRITE_FAILED',
        eventType: 'help_view',
      });
    });
  });
});
