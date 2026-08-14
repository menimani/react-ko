import { KnockoutScope } from '../../dist/index.js'

type ViewModel = {
  label: string
}

const viewModel: ViewModel = { label: 'Bound' }

export function InferredScope() {
  return (
    <KnockoutScope viewModel={viewModel}>
      <span>{viewModel.label}</span>
    </KnockoutScope>
  )
}

export function ExplicitGenericScope() {
  return (
    <KnockoutScope<ViewModel> viewModel={viewModel}>
      <span>{viewModel.label}</span>
    </KnockoutScope>
  )
}

// @ts-expect-error A scope requires a view model.
const missingViewModel = <KnockoutScope>Child</KnockoutScope>

// @ts-expect-error A scope requires children to bind.
const missingChildren = <KnockoutScope viewModel={viewModel} />

void missingViewModel
void missingChildren
