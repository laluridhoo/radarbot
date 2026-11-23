import { config } from '../config.js';
import type { VideoItem } from '../types.js';
import { runActor } from './apify.js';

interface TikTokRaw {
  id?: string;
  createTime?: number;
  createTimeISO?: string;
  playCount?: number;
  diggCount?: number;
  commentCount?: number;
  webVideoUrl?: string;
  authorMeta?: { name?: string };
}

export async function scrapeTikTok(hashtag: string): Promise<VideoItem[]> {
  const raw = await runActor<TikTokRaw>(config.apifyTiktokActor, {
    hashtags: [hashtag],
    resultsPerPage: config.resultsPerHashtag,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
  });

  const items: VideoItem[] = [];
  for (const r of raw) {
    const uploaded = r.createTime ? new Date(r.createTime * 1000) : r.createTimeISO ? new Date(r.createTimeISO) : null;
    if (!r.id || !uploaded || Number.isNaN(uploaded.getTime())) continue;
    const author = r.authorMeta?.name ?? 'unknown';
    items.push({
      id: `tt_${r.id}`,
      platform: 'tiktok',
      hashtag,
      authorUsername: author,
      uploadedAt: uploaded,
      views: r.playCount ?? 0,
      likes: r.diggCount ?? 0,
      comments: r.commentCount ?? 0,
      url: r.webVideoUrl ?? `https://www.tiktok.com/@${author}/video/${r.id}`,
    });
  }
  return items;
}
