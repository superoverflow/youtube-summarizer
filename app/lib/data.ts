import { unstable_noStore as noStore } from "next/cache";
import { YoutubeVideoAPIResponse, YoutubeVideo } from "./definitions";
import { sql } from "@vercel/postgres";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

async function fetchYoutubeVideoFromAPI(videoId: string) {
  const apiKey = YOUTUBE_API_KEY;
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?key=${apiKey}&part=snippet&part=contentDetails&id=${videoId}`
  );
  const data = await response.json();

  const videoObject: YoutubeVideoAPIResponse = data.items[0].snippet;
  const video: YoutubeVideo = {
    video_id: videoId,
    title: videoObject.title,
    published_at: videoObject.publishedAt,
    thumbnail_url: videoObject.thumbnails.default.url,
    channel_id: videoObject.channelId,
    duration: data.items[0].contentDetails.duration
  };
  return video;
}

async function fetchYoutubeVideosFromDB(videoId: string) {
  noStore();
  const { rows } = await sql<YoutubeVideo>`
    SELECT 
      video_id,
      title, 
      published_at, 
      thumbnail_url, 
      channel_id, 
      duration,
      left(transcript, 255) as transcript,
      market_sentiment
    FROM youtube_videos
    WHERE video_id = ${videoId};`;
  if (rows.length > 0) return rows[0];
  return null;
}

export async function saveYoutubeVideo(video: YoutubeVideo) {
  noStore();
  sql`
  INSERT INTO youtube_videos 
    (video_id, title, published_at, thumbnail_url,channel_id, duration)
  VALUES (
    ${video.video_id}, ${video.title}, ${video.published_at}, ${video.thumbnail_url}, 
    ${video.channel_id}, ${video.duration})
  ON CONFLICT (video_id) DO NOTHING
`;
}

export async function fetchYoutubeVideo(videoId: string) {
  const videoFromDB = await fetchYoutubeVideosFromDB(videoId);
  if (videoFromDB != null) {
    return videoFromDB;
  }

  const video = await fetchYoutubeVideoFromAPI(videoId);
  return video;
}


export async function fetchAllVideos(offset: number = 0, limit: number = 10) {
  noStore();
  const { rows } = await sql<{ video_id: string }>`
    SELECT 
      video_id 
    FROM youtube_videos 
    LIMIT ${limit}
    OFFSET ${offset}`
  return rows
}

export async function searchYoutubeVideos(query: string) {
  const apiKey = YOUTUBE_API_KEY;
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&part=id&type=video&q=${query}`
  );
  const data: { items: { id: { videoId: string } }[] } = await response.json();
  return data.items.map(item => item.id.videoId);
}