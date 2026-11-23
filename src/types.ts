export type Platform = 'tiktok' | 'instagram';

export interface VideoItem {
  id: string;
  platform: Platform;
  hashtag: string;
  authorUsername: string;
  uploadedAt: Date;
  views: number;
  likes: number;
  comments: number;
  url: string;
}

export interface GacorVideo extends VideoItem {
  ageHours: number;
  viewsPerHour: number;
}
