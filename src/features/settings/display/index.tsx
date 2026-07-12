import { ContentSection } from '../components/content-section'
import { DisplayForm } from './display-form'

export function SettingsDisplay() {
  return (
    <ContentSection
      title='Exibição'
      desc='Ligue ou desligue os itens que aparecem no painel.'
    >
      <DisplayForm />
    </ContentSection>
  )
}
