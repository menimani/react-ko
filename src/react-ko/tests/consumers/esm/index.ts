import { KnockoutScope } from 'react-ko'

type IsAny<T> = 0 extends (1 & T) ? true : false
type AssertFalse<T extends false> = T

type KnockoutScopeIsTyped = AssertFalse<IsAny<typeof KnockoutScope>>

const component: typeof KnockoutScope = KnockoutScope
void (component satisfies typeof KnockoutScope)
void (false satisfies KnockoutScopeIsTyped)
