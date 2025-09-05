import { SelfLabel } from './lexicon/types/com/atproto/label/defs';
import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return

    const ops = await getOpsByType(evt)

    // This logs the text of every post off the firehose.
    // Just for fun :)
    // Delete before actually using
    // for (const post of ops.posts.creates) {
    //   console.log(post.record.text)
    // }

    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates
      .filter((create) => {
        // records with embeds and labels
        // (create.record.labels?.values.some((e) => typeof e == "string" && taglist.has(e))
        /// post with an embed and one of the tags
        if( create.record.embed && (create.record.tags || create.record.labels)){
          if(create.record.labels?.$type === "com.atproto.label.defs#selfLabels"){
            // console.log("selflabels", create.record.labels);
            const values = create.record.labels?.values as SelfLabel[];
            if(values.some((label) => this.tags.has(label.val.toLowerCase()))){
              // console.log("SelfLabel matched:", values);
              return true;
            }
          }
          // console.log("tags", create.record.tags);
          return create.record.tags?.some((e) => this.tags.has(e.toLowerCase()));
        }
        return false;
      })
      .map((create) => {
        // console.log("record", create.record)
        // console.log("record.facets.features", create.record.facets?.map((facet) => facet.features))

        const features = create.record.facets?.flatMap((facet) => facet.features) ?? [];
        const featureTags = features.filter((feature) => feature.$type === 'app.bsky.richtext.facet#tag')
                            .map((feature) => (feature.tag as string).toLowerCase());

        const tags = [
          ...(create.record.tags ?? []),
          ...featureTags
        ]
        return {
          uri: create.uri,
          cid: create.cid,
          tags,
          indexedAt: new Date().toISOString(),
        }
      })

    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
    if (postsToCreate.length > 0) {
      const justPosts = postsToCreate.map((post) => ({
        uri: post.uri,
        cid: post.cid,
        indexedAt: post.indexedAt,
      }));

      this.db
        .insertInto('post')
        .values(justPosts)
        .onConflict((oc) => oc.doNothing())
        .execute();
      for(const post of postsToCreate.values()) {
        const newTags = post.tags.map((tag) => tag.toLowerCase());
        // if tags empty
        if (newTags.length <= 0){
          console.log("No tags for post", post.uri);
          continue;
        }else{
          console.log("Adding tags for post", post.tags.length);
        }
        const newTagIds : {id : number}[] = [];
        const insertTags : {value: string}[] = [];
        for(const tag of newTags) {
          const existing = await this.db
            .selectFrom('tag')
            .selectAll()
            .where('value', '=', tag)
            .executeTakeFirst();
          if(existing) {
            newTagIds.splice(parseInt(tag), 1);
          }else{
            insertTags.push({value: tag});
          }
        }

        if(insertTags.length !== 0){
          const tagInsert = await this.db.insertInto('tag')
              .values(insertTags)
              .onConflict((oc) => oc.column('value').doNothing())
              .returning("id")
              .compile();
          const createTags = await this.db.executeQuery(tagInsert);
          newTagIds.push(...(createTags.rows as {id : number}[]));
        }

        const postTags = newTagIds.map((id) => ({
          uri: post.uri,
          tag_id: id.id,
        }));
        if (postTags.length > 0) {
          await this.db
            .insertInto('post_tags')
            .values(postTags)
            .onConflict((oc) => oc.doNothing())
            .execute();
        }
      }
    }
  }
}
