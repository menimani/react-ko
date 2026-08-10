import type { ComponentProps } from 'react'
import { createAppViewModelContext } from '../../dist/index.js'

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends
  (<T>() => T extends Right ? 1 : 2) ? true : false
type Assert<T extends true> = T

type ViewModel = { title: string }

const TypedAppViewModelContext = createAppViewModelContext<ViewModel>()

type HookValue = ReturnType<typeof TypedAppViewModelContext.useAppViewModel>
type ProviderValue = ComponentProps<typeof TypedAppViewModelContext.Provider>['value']

type HookIsLinkedToFactory = Assert<Equal<HookValue, ViewModel>>
type ProviderIsLinkedToFactory = Assert<Equal<ProviderValue, ViewModel>>

void (true satisfies HookIsLinkedToFactory)
void (true satisfies ProviderIsLinkedToFactory)
