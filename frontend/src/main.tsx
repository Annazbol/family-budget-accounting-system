import { createRoot } from 'react-dom/client'
import App from './App'
import { SettingsProvider } from './i18n'
import { RatesProvider } from './rates'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <SettingsProvider>
    <RatesProvider>
      <App />
    </RatesProvider>
  </SettingsProvider>,
)
