import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { HtmlComment } from '@/index'

describe('HtmlComment', () => {
  it('inserts a comment into the DOM', () => {
    const text = 'ko ifnot: condition'
    
    render(<HtmlComment text={text} />)

    // コメントノードがDOMに含まれているかを確認
    const comment = document.querySelector('div')?.firstChild
    expect(comment).not.toBeNull()
    expect(comment?.nodeType).toBe(Node.COMMENT_NODE)  // コメントノードであることを確認
    expect(comment?.nodeValue).toBe(` ${text} `)       // コメントの内容が一致することを確認
  })
})