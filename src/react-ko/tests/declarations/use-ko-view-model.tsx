import { useKoViewModel } from '../../dist/index.js'

type ViewModel = {
  label: string
}

const viewModel: ViewModel = useKoViewModel<ViewModel>()

void viewModel
