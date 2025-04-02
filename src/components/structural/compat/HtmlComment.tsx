import React, { useLayoutEffect, useRef } from 'react'

type HtmlCommentProps = {
  text: string
}

/**
 * Inserts a standalone HTML comment node into the DOM.
 * Used to support Knockout comment-based bindings like `ko if:`.
 * Removes the placeholder div on mount and replaces it with a comment.
 */
export const HtmlComment = React.memo(function HtmlComment({ text }: HtmlCommentProps) {
  const markerRef = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    const marker = markerRef.current
    if (marker === null) {
      return
    }
    const parent = marker.parentNode
    if (parent === null) {
      return
    }

    const comment = document.createComment(` ${text} `)
    parent.insertBefore(comment, marker)
  }, [text])

  return (
    <div ref={markerRef} style={{ display: 'none' }}></div>
  )
})
