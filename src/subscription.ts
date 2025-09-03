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
        // map alf-related posts to a db row
        return {
          uri: create.uri,
          cid: create.cid,
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
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }
}
