import ReactKo = require('react-ko')

type IsAny<T> = 0 extends (1 & T) ? true : false
type AssertFalse<T extends false> = T

type KnockoutScopeIsTyped = AssertFalse<IsAny<typeof ReactKo.KnockoutScope>>

const component: typeof ReactKo.KnockoutScope = ReactKo.KnockoutScope
void (component satisfies typeof ReactKo.KnockoutScope)
void (false satisfies KnockoutScopeIsTyped)
