import type { SemanticHost } from '../../dist/index.js'

declare global {
  interface HTMLElementTagNameMap {
    'custom-host': HTMLElement
    customhost: HTMLElement
  }
}

type Assert<T extends true> = T
type AssertNot<T extends false> = T

type MarqueeIsSemanticHost = Assert<'marquee' extends SemanticHost ? true : false>
type DirIsSemanticHost = Assert<'dir' extends SemanticHost ? true : false>
type FontIsSemanticHost = Assert<'font' extends SemanticHost ? true : false>
type FramesetIsSemanticHost = Assert<'frameset' extends SemanticHost ? true : false>
type CustomElementIsSemanticHost = Assert<
  'custom-host' extends SemanticHost ? true : false
>
type DeclarationMergedHostIsSemanticHost = Assert<
  'customhost' extends SemanticHost ? true : false
>
type FrameIsNotSemanticHost = AssertNot<'frame' extends SemanticHost ? true : false>
type BasefontIsNotSemanticHost = AssertNot<
  'basefont' extends SemanticHost ? true : false
>
type KeygenIsNotSemanticHost = AssertNot<
  'keygen' extends SemanticHost ? true : false
>

void (true satisfies MarqueeIsSemanticHost)
void (true satisfies DirIsSemanticHost)
void (true satisfies FontIsSemanticHost)
void (true satisfies FramesetIsSemanticHost)
void (true satisfies CustomElementIsSemanticHost)
void (true satisfies DeclarationMergedHostIsSemanticHost)
void (false satisfies FrameIsNotSemanticHost)
void (false satisfies BasefontIsNotSemanticHost)
void (false satisfies KeygenIsNotSemanticHost)
