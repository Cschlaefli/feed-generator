import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'



// max 15 chars
export const shortname = 'test-feed'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  let builder = ctx.db
    .selectFrom('post')
    .selectAll()
    .orderBy('indexedAt', 'desc')
    .orderBy('cid', 'desc')
    .limit(params.limit)

  if (params.cursor) {
    const timeStr = new Date(parseInt(params.cursor, 10)).toISOString()
    builder = builder.where('post.indexedAt', '<', timeStr)
  }

  // EXCLUDE: none of these tags may be present
  if (ctx.excludeTagIds.length) {
    builder = builder.where(eb =>
      eb.not(eb.exists(
        eb.selectFrom('post_tags as pt')
          .select(eb.lit(1).as('one'))
          .whereRef('pt.uri', '=', 'post.uri')
          .where('pt.tag_id', 'in', ctx.excludeTagIds)
      ))
    );
  }
  const res = await builder.execute()

  const feed = res.map((row) => ({
    post: row.uri,
  }))

  let cursor: string | undefined
  const last = res.at(-1)
  if (last) {
    cursor = new Date(last.indexedAt).getTime().toString(10)
  }

  return {
    cursor,
    feed,
  }
}
