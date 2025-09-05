import { Kysely, Migration, MigrationProvider, sql } from 'kysely'

const migrations: Record<string, Migration> = {}

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations
  },
}

migrations['001'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable('post')
      .addColumn('uri', 'varchar', (col) => col.primaryKey())
      .addColumn('cid', 'varchar', (col) => col.notNull())
      .addColumn('indexedAt', 'varchar', (col) => col.notNull())
      .execute()
    await db.schema
      .createTable('sub_state')
      .addColumn('service', 'varchar', (col) => col.primaryKey())
      .addColumn('cursor', 'int8', (col) => col.notNull())
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('post').execute()
    await db.schema.dropTable('sub_state').execute()
  },
}

migrations['002'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable("tag")
      .addColumn("id", "serial", (col) => col.primaryKey())
      .addColumn("value", "varchar(50)", (col) => col.notNull().unique())
      .execute()
    await db.schema
      .createTable('post_tags')
      .addColumn('uri', 'varchar', (col) => col.references('post.uri').onDelete('cascade').notNull())
      .addColumn('tag_id', 'integer', (col) => col.references('tag.id').onDelete('cascade').notNull())
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('post_tags').execute()
  },
}


migrations['003'] = {
  async up(db: Kysely<unknown>) {
    // 0) Safety: remove duplicates in post_tags (if any) before adding PK
    await sql`
      DELETE FROM post_tags a
      USING post_tags b
      WHERE a.ctid < b.ctid
        AND a.uri = b.uri
        AND a.tag_id = b.tag_id
    `.execute(db)

    // 1) Composite primary key on (uri, tag_id)
    //    Ensures uniqueness and speeds up many lookups.
    await sql`
      ALTER TABLE post_tags
      ADD CONSTRAINT post_tags_pkey PRIMARY KEY (uri, tag_id)
    `.execute(db)

    // 2) Post pagination index (supports ORDER BY indexedAt DESC, cid DESC)
    //    For Postgres btree, direction is scan-time; ASC index still works for DESC order.
    await db.schema
      .createIndex('idx_post_indexedat_cid')
      .on('post')
      .columns(['indexedAt', 'cid'])
      .execute()

    // 3) Semi-join friendly indexes for tag filters
    //    (a) tag_id -> post_uri (fast include/exclude by tag set)
    await db.schema
      .createIndex('idx_post_tags_tag_post')
      .on('post_tags')
      .columns(['tag_id', 'uri'])
      .execute()

    //    (b) post_uri -> tag_id (useful for per-post tag lookups elsewhere)
    await db.schema
      .createIndex('idx_post_tags_post_tag')
      .on('post_tags')
      .columns(['uri', 'tag_id'])
      .execute()

    // Note: you already have a UNIQUE constraint on tag.value from migration 002,
    // which gives you an index on tag(value). No extra index needed there.
  },

  async down(db: Kysely<unknown>) {
    // Drop indexes (if present), then drop the PK constraint.
    await db.schema.dropIndex('idx_post_tags_post_tag').on('post_tags').ifExists().execute()
    await db.schema.dropIndex('idx_post_tags_tag_post').on('post_tags').ifExists().execute()
    await db.schema.dropIndex('idx_post_indexedat_cid').on('post').ifExists().execute()

    await sql`
      ALTER TABLE post_tags
      DROP CONSTRAINT IF EXISTS post_tags_pkey
    `.execute(db)
  },
}
