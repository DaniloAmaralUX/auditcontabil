import { ContentSection } from '../components/content-section'
import { NotificationsForm } from './notifications-form'

export function SettingsNotifications() {
  return (
    <ContentSection
      title='Notificações'
      desc='Escolha como você prefere receber os avisos.'
    >
      <NotificationsForm />
    </ContentSection>
  )
}
