import { ContentSection } from '../components/content-section'
import { AppearanceForm } from './appearance-form'

export function SettingsAppearance() {
  return (
    <ContentSection
      title='Aparência'
      desc='Escolha como o painel aparece para você. O tema pode acompanhar o modo do sistema, alternando entre claro e escuro sozinho.'
    >
      <AppearanceForm />
    </ContentSection>
  )
}
