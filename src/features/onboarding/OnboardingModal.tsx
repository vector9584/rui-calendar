import type { JSX } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Capacitor } from '@capacitor/core'
import { useAnimatedClose } from '@/hooks/useAnimatedClose'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useSettingsStore } from '@/store/settingsStore'
import { useConfigStore } from '@/store/configStore'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { expandProviderUrl } from '@/features/caldav/client/discovery'
import { requestNativeReminderPermission } from '@/lib/nativeReminders'
import styles from './OnboardingModal.module.css'

const isNative = Capacitor.isNativePlatform()

export function OnboardingModal(): JSX.Element | null {
  const { t } = useTranslation('common')
  const { t: tc } = useTranslation('calendar')
  const [serverUrl, setServerUrl] = useState('https://your-caldav.example.com:7086/dav.php/')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')

  const hasCompletedOnboarding = useSettingsStore((state) => state.hasCompletedOnboarding)
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const hasPreconfiguredAccounts = useConfigStore((state) => state.hasPreconfiguredAccounts)
  const { addAccount } = useCalDAV()

  // Open on first visit — no onboarding done and no preconfigured accounts.
  const isOpen = !(hasCompletedOnboarding || hasPreconfiguredAccounts)
  const noop = useCallback(() => {}, [])
  const { rendered, closing } = useAnimatedClose(isOpen, noop, 200)
  const contentRef = useRef<HTMLDivElement>(null)

  useFocusTrap(contentRef, rendered && !closing)

  // Escape dismisses the onboarding modal — it uses a custom backdrop, so it
  // needs its own keydown handler rather than the generic Modal component's.
  useEffect(() => {
    if (!rendered || closing) return
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        useSettingsStore.getState().updateSettings({ hasCompletedOnboarding: true })
        if (isNative) {
          void requestNativeReminderPermission()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [rendered, closing])

  if (!rendered) {
    return null
  }

  const completeOnboarding = (): void => {
    updateSettings({ hasCompletedOnboarding: true })
    if (isNative) {
      void requestNativeReminderPermission()
    }
  }

  const handleDismiss = (): void => {
    completeOnboarding()
  }

  const handleConnect = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (isConnecting) return
    setIsConnecting(true)
    setConnectError('')
    try {
      const expanded = expandProviderUrl(serverUrl, username)
      await addAccount(expanded || serverUrl, username, password, username)
      completeOnboarding()
    } catch (error) {
      setConnectError(
        error instanceof Error ? error.message : '连接失败，请检查服务器地址、用户名和密码'
      )
    } finally {
      setIsConnecting(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      handleDismiss()
    }
  }

  return (
    <div
      className={`${styles.modal} ${closing ? styles.closing : ''}`}
      onClick={handleBackdropClick}
    >
      <div
        ref={contentRef}
        className={styles.modalContent}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <h2 className={styles.title} id="onboarding-title">
          {t('ui.onboarding.title')}
        </h2>

        <p className={styles.description}>{t('ui.onboarding.connectLine')}</p>

        <form className={styles.connectForm} onSubmit={handleConnect}>
          <div className={styles.formGroup}>
            <label htmlFor="onboard-serverUrl" className={styles.formLabel}>
              {tc('ui.calModal.serverUrl')}
            </label>
            <input
              id="onboard-serverUrl"
              name="serverUrl"
              type="url"
              className={styles.formInput}
              placeholder="https://your-caldav.example.com:7086/dav.php/"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="onboard-username" className={styles.formLabel}>
              {tc('ui.calModal.username')}
            </label>
            <input
              id="onboard-username"
              name="username"
              className={styles.formInput}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="onboard-password" className={styles.formLabel}>
              {tc('ui.calModal.password')}
            </label>
            <input
              id="onboard-password"
              name="password"
              type="password"
              className={styles.formInput}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {connectError && <p className={styles.errorMessage}>{connectError}</p>}

          <button
            type="submit"
            className={styles.addButton}
            disabled={isConnecting}
            data-component="connect-submit"
          >
            {isConnecting ? tc('ui.calModal.connecting') : tc('ui.calModal.connect')}
          </button>
        </form>

        <div className={styles.footerButtons}>
          <button className={styles.skipButton} onClick={handleDismiss}>
            {t('ui.onboarding.skip')}
          </button>
          <a
            className={styles.skipButton}
            href="https://your-caldav.example.com:7086/admin/"
            target="_blank"
            rel="noreferrer"
          >
            管理后台
          </a>
        </div>
      </div>
    </div>
  )
}
