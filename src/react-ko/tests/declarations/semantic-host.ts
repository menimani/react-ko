import type { SemanticHost } from '../../dist/index.js'

declare global {
  interface HTMLElementTagNameMap {
    'custom-host': HTMLElement
    customhost: HTMLElement
    frame: HTMLElement
    basefont: HTMLElement
    bgsound: HTMLElement
    keygen: HTMLElement
    menuitem: HTMLElement
  }
}

type Assert<T extends true> = T

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
type FrameIsSemanticHost = Assert<'frame' extends SemanticHost ? true : false>
type BasefontIsSemanticHost = Assert<'basefont' extends SemanticHost ? true : false>
type BgsoundIsSemanticHost = Assert<'bgsound' extends SemanticHost ? true : false>
type KeygenIsSemanticHost = Assert<'keygen' extends SemanticHost ? true : false>
type MenuitemIsSemanticHost = Assert<'menuitem' extends SemanticHost ? true : false>
type TextareaIsSemanticHost = Assert<'textarea' extends SemanticHost ? true : false>
type TitleIsSemanticHost = Assert<'title' extends SemanticHost ? true : false>
type TemplateIsSemanticHost = Assert<'template' extends SemanticHost ? true : false>

void (true satisfies MarqueeIsSemanticHost)
void (true satisfies DirIsSemanticHost)
void (true satisfies FontIsSemanticHost)
void (true satisfies FramesetIsSemanticHost)
void (true satisfies CustomElementIsSemanticHost)
void (true satisfies DeclarationMergedHostIsSemanticHost)
void (true satisfies FrameIsSemanticHost)
void (true satisfies BasefontIsSemanticHost)
void (true satisfies BgsoundIsSemanticHost)
void (true satisfies KeygenIsSemanticHost)
void (true satisfies MenuitemIsSemanticHost)
void (true satisfies TextareaIsSemanticHost)
void (true satisfies TitleIsSemanticHost)
void (true satisfies TemplateIsSemanticHost)
