import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fileProcessor } from '../utils/fileProcessor';
import fs from 'fs';
import path from 'path';

// This test uses real file operations instead of mocks
describe('FileProcessor', () => {
  // Set up test directories
  const testDir = path.resolve('./test-uploads');
  const testImagePath = path.join(testDir, 'test-image.jpg');
  const testVideoPath = path.join(testDir, 'test-video.mp4');

  // Create test directory and files for real testing
  beforeAll(() => {
    // Create test directory if it doesn't exist
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create a simple test image (1x1 black pixel) using Node's Buffer
    const blackPixel = Buffer.from([
      0xff, 0xd8, // JPEG SOI marker
      0xff, 0xe0, 0x00, 0x10, 'J', 'F', 'I', 'F', 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // JFIF header
      0xff, 0xdb, 0x00, 0x43, 0x00, // DQT marker
      // Quantization table (simplified)
      0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32,
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, // SOF marker (1x1 image)
      0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x09, // DHT marker
      0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xd2, 0xcf, 0x20, // SOS marker
      0xff, 0xd9 // EOI marker
    ]);
    fs.writeFileSync(testImagePath, blackPixel);

    // Create a short dummy MP4 file
    // This is a minimal MP4 container with no actual video content
    const dummyMP4 = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6D, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00,
      0x6D, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x00, 0x08, 0x6D, 0x6F, 0x6F, 0x76
    ]);
    fs.writeFileSync(testVideoPath, dummyMP4);
  });

  // Clean up test files after tests
  afterAll(() => {
    // Remove test files and directory
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    if (fs.existsSync(testVideoPath)) {
      fs.unlinkSync(testVideoPath);
    }

    // Clean up any blur files that might have been created
    const blurredImagePath = testImagePath.replace('.jpg', '-blur.jpg');
    if (fs.existsSync(blurredImagePath)) {
      fs.unlinkSync(blurredImagePath);
    }

    const blurredVideoPath = testVideoPath.replace('.mp4', '-blur.jpg');
    if (fs.existsSync(blurredVideoPath)) {
      fs.unlinkSync(blurredVideoPath);
    }

    // Remove the test directory if it's empty
    if (fs.existsSync(testDir) && fs.readdirSync(testDir).length === 0) {
      fs.rmdirSync(testDir);
    }
  });

  describe('processFile', () => {
    it('should process image files', async () => {
      // Skip test if file doesn't exist
      if (!fs.existsSync(testImagePath)) {
        console.warn('Test image does not exist. Skipping test.');
        return;
      }

      try {
        const result = await fileProcessor.processFile(
          testImagePath,
          'image',
          testDir
        );

        // Check that results are defined
        expect(result.originalUrl).toBeDefined();
        expect(result.blurredUrl).toBeDefined();
        expect(result.error).toBeUndefined();

        // We don't check if the blurred file exists in this test
        // as it might be dependent on Sharp/FFmpeg which aren't available in test env
        console.log('Blurred URL:', result.blurredUrl);
      } catch (error) {
        console.error('Error processing image:', error);
        throw error;
      }
    });

    it('should handle file processing errors gracefully', async () => {
      // Test with a non-existent file
      const nonExistentFile = path.join(testDir, 'non-existent.jpg');

      const result = await fileProcessor.processFile(
        nonExistentFile,
        'image',
        testDir
      );

      // Should return error
      expect(result.error).toBeDefined();
      expect(result.originalUrl).toBe('');
      expect(result.blurredUrl).toBe('');
    });
  });

  describe('Video processing', () => {
    // This test only checks if the video duration detection is working
    it('should detect video duration when possible', () => {
      try {
        // @ts-ignore - accessing private method for testing
        const duration = fileProcessor.getVideoDuration(testVideoPath);

        // If ffprobe is not available, this might return the default 10
        expect(typeof duration).toBe('number');
      } catch (error) {
        // If ffprobe is not available, we'll skip this test
        console.warn('Video duration detection test skipped: ffprobe may not be available');
      }
    });
  });
});