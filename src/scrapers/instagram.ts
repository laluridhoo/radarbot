import { config } from '../config.js';
import type { VideoItem } from '../types.js';
import { runActor } from './apify.js';

interface IgRaw {
  id?: string;
  shortCode?: string;
  timestamp?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  ownerUsername?: string;
  url?: string;
}

export async function scrapeInstagram(hashtag: string): Promise<VideoItem[]> {
  const raw = await runActor<IgRaw>(config.apifyInstagramActor, {
    hashtags: [hashtag],
    resultsType: 'reels',
    resultsLimit: config.resultsPerHashtag,
  });

  const items: VideoItem[] = [];
  for (const r of raw) {
    const key = r.shortCode ?? r.id;
    const uploaded = r.timestamp ? new Date(r.timestamp) : null;
    if (!key || !uploaded || Number.isNaN(uploaded.getTime())) continue;
    items.push({
      id: `ig_${key}`,
      platform: 'instagram',
      hashtag,
      authorUsername: r.ownerUsername ?? 'unknown',
      uploadedAt: uploaded,
      views: r.videoPlayCount ?? r.videoViewCount ?? 0,
      likes: Math.max(r.likesCount ?? 0, 0),
      comments: r.commentsCount ?? 0,
      url: r.url ?? `https://www.instagram.com/reel/${key}/`,
    });
  }
  return items;
}
