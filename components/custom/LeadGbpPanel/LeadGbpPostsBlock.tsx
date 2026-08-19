"use client"

import { useState } from "react"
import { RiExternalLinkLine, RiImageLine } from "react-icons/ri"
import { LeadGbpCard } from "./LeadGbpCard"
import { formatRelativeShort } from "@/lib/date-time"
import type { GbpPost } from "@/lib/leads/gbp-audit"

function PostImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span
        aria-hidden
        className="flex h-28 w-full items-center justify-center rounded-lg bg-canvas text-fg-muted"
      >
        <RiImageLine size={22} />
      </span>
    )
  }
  return (
    <img
      src={src}
      alt=""
      className="h-28 w-full rounded-lg object-cover"
      onError={() => setFailed(true)}
    />
  )
}

export function LeadGbpPostsBlock({ posts }: { posts: GbpPost[] | null }) {
  const post = posts?.[0] ?? null

  return (
    <LeadGbpCard title="Postagens">
      {!post ? (
        <p className="font-sans text-caption text-fg-muted">
          Nenhuma postagem coletada.
        </p>
      ) : (
        <article className="flex flex-col gap-2">
          {post.imageUrl ? (
            <PostImage src={post.imageUrl} />
          ) : (
            <span
              aria-hidden
              className="flex h-28 w-full items-center justify-center rounded-lg bg-canvas text-fg-muted"
            >
              <RiImageLine size={22} />
            </span>
          )}
          {post.text ? (
            <p className="line-clamp-3 whitespace-pre-wrap font-sans text-caption text-fg">
              {post.text}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {post.publishedAt ? (
              <span className="font-sans text-caption text-fg-muted">
                {formatRelativeShort(post.publishedAt)}
              </span>
            ) : null}
            {post.url ? (
              <a
                href={post.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-sans text-caption font-medium text-link hover:text-accent"
              >
                Ver postagem
                <RiExternalLinkLine size={12} aria-hidden />
              </a>
            ) : null}
          </div>
        </article>
      )}
    </LeadGbpCard>
  )
}
