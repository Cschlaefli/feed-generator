import { Generated } from 'kysely'

export type DatabaseSchema = {
  post: Post
  sub_state: SubState
  tag: Tag
  post_tags: PostTags
}

export type Post = {
  uri: string
  cid: string
  indexedAt: string
}

export type SubState = {
  service: string
  cursor: number
}

export type Tag = {
  id: Generated<number>
  value: string
}

export type PostTags = {
  uri: string
  tag_id: number
}