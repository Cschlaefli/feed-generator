const splitList = (v?: string) =>
  (v ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

const INCLUDE_TAGS = splitList(process.env.FEED_TAGS ?? '');
const EXCLUDE_TAGS = splitList(process.env.FEED_TAG_EXCLUDE ?? '');
const TAG_MODE = (process.env.FEED_TAG_MODE ?? 'any') as 'any'|'all';
