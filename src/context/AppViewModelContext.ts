import { createContext, useContext } from 'react'

/**
 * グローバルな AppViewModel の型
 * 使用者がこの型を上書きして使うことを想定（anyで暫定）
 */
export const AppViewModelContext = createContext<any | null>(null)

/**
 * AppViewModel を取得するフック
 * Provider 配下でのみ使える
 */
export function useAppViewModel<T = any>(): T {
  const context = useContext(AppViewModelContext)
  if (!context) {
    throw new Error('useAppViewModel must be used within a RootKnockoutProvider.')
  }
  return context
}