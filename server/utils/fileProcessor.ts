import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { execSync } from 'child_process';

interface ProcessedFile {
  originalUrl: string;
  blurredUrl: string;
  durationSeconds?: number;
  error?: string;
}

class FileProcessor {
  /**
   * Process uploaded files - create blurred versions and handle videos
   */
  async processFile(filePath: string, fileType: 'image' | 'video', publicPath: string): Promise<ProcessedFile> {
    try {
      const fileDir = path.dirname(filePath);
      const fileExt = path.extname(filePath);
      const fileBasename = path.basename(filePath, fileExt);
      const blurredFilename = `${fileBasename}-blur${fileExt}`;
      const blurredFilePath = path.join(fileDir, blurredFilename);
      
      // Create public paths
      const publicUrl = `/${publicPath}`;
      const blurredPublicPath = `/${path.join(path.dirname(publicPath), blurredFilename)}`;
      
      // Handle video files
      if (fileType === 'video') {
        // Check video duration
        const durationSeconds = this.getVideoDuration(filePath);
        
        if (durationSeconds > 20) {
          // Delete the original file
          fs.unlinkSync(filePath);
          return {
            originalUrl: '',
            blurredUrl: '',
            error: 'Video is too long. Maximum duration is 20 seconds.'
          };
        }
        
        // Create a blurred thumbnail from the video
        await this.createVideoThumbnail(filePath, blurredFilePath);
        
        return {
          originalUrl: publicUrl,
          blurredUrl: blurredPublicPath,
          durationSeconds
        };
      } 
      // Handle image files
      else {
        // Create blurred version
        await this.createBlurredImage(filePath, blurredFilePath);
        
        return {
          originalUrl: publicUrl,
          blurredUrl: blurredPublicPath
        };
      }
    } catch (error: any) {
      return {
        originalUrl: '',
        blurredUrl: '',
        error: error.message || 'Failed to process file'
      };
    }
  }
  
  /**
   * Create a blurred version of an image
   */
  private async createBlurredImage(inputPath: string, outputPath: string): Promise<void> {
    await sharp(inputPath)
      .blur(15)
      .toFile(outputPath);
  }
  
  /**
   * Extract thumbnail from video and blur it
   */
  private async createVideoThumbnail(videoPath: string, outputPath: string): Promise<void> {
    // Create temp thumbnail
    const tempThumbnail = `${videoPath}-thumb.jpg`;
    
    try {
      // Extract thumbnail at 1 second mark
      execSync(`ffmpeg -i "${videoPath}" -ss 00:00:01 -frames:v 1 "${tempThumbnail}"`);
      
      // Blur the thumbnail
      await this.createBlurredImage(tempThumbnail, outputPath);
      
      // Clean up temp file
      fs.unlinkSync(tempThumbnail);
    } catch (error) {
      // Fallback if ffmpeg fails or is not available
      // Create a generic blurred placeholder
      await sharp({
        create: {
          width: 640,
          height: 360,
          channels: 4,
          background: { r: 200, g: 200, b: 200, alpha: 1 }
        }
      })
      .blur(15)
      .toFile(outputPath);
    }
  }
  
  /**
   * Get video duration in seconds
   */
  private getVideoDuration(videoPath: string): number {
    try {
      // Use ffprobe to get video duration
      const result = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`);
      return parseFloat(result.toString().trim());
    } catch (error) {
      // If ffprobe fails, assume it's a valid duration
      return 10; // Default to 10 seconds
    }
  }
}

export const fileProcessor = new FileProcessor();
