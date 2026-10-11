/**
 * Photo or video? The galleries store both in one list of URLs, so the file
 * extension (preserved through upload) is what decides how a tile renders.
 */
const VIDEO_PATTERN = /\.(mp4|m4v|mov|webm|ogv|ogg)(?:[?#]|$)/i;

export const isVideoUrl = (url: string | null | undefined) => VIDEO_PATTERN.test(url || '');
