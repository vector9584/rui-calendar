import type { JSX } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsPageHeading } from './SettingsPageHeading'
import { useCalDAV } from '@/features/caldav/hooks/useCalDAV'
import { connectionErrorMessage } from '@/features/caldav/client/errorMessages'
import { getCredentialById } from '@/features/caldav/client/credentials'
import type { DiagnosticsOptions } from '@/features/caldav/client/diagnostics'
import type { CalDAVAccount } from '@/features/caldav/types'
import { DiagnosticsPanel } from './DiagnosticsPanel'
import { AddCalendarModal } from '@/features/calendar/components/AddCalendarModal'
import { SubscribeCalendarModal } from '@/features/calendar/components/SubscribeCalendarModal'
import { useWebcalSubscriptions } from '@/features/webcal/hooks/useWebcalSubscriptions'
import type { WebcalSubscription } from '@/features/webcal/types'
import { PRESET_SUBSCRIPTIONS, ZODIAC_SIGNS } from '@/features/webcal/presetSubscriptions'
import { loadWeatherCities, findWeatherLocation } from '@/features/webcal/weatherCities'
import type { WeatherProvince } from '@/features/webcal/weatherCities'
import styles from './Settings.module.css'

interface TestState {
  status: 'testing' | 'ok' | 'error'
  message?: string
  hint?: string
}

export function CalDAVSettings({ searchControl }: { searchControl?: JSX.Element }): JSX.Element {
  const { t } = useTranslation('settings')
  const [isAddingAccount, setIsAddingAccount] = useState(false)
  const [editingAccount, setEditingAccount] = useState<CalDAVAccount | null>(null)
  // Keyed by account id so testing one account never shows a spinner on another.
  const [testStates, setTestStates] = useState<Record<string, TestState>>({})
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [editingSubscription, setEditingSubscription] = useState<WebcalSubscription | null>(null)
  const [syncingSubscriptionId, setSyncingSubscriptionId] = useState<string | null>(null)
  // The diagnostics panel needs the password, which lives in the credential
  // store rather than on the account — resolved once, when the row is opened.
  const [diagnosing, setDiagnosing] = useState<{
    accountId: string
    options: Omit<DiagnosticsOptions, 'includeWriteTest' | 'onProgress'>
  } | null>(null)
  // Weather preset: province/city/district catalogue + current selection indexes.
  const [weatherProvinces, setWeatherProvinces] = useState<WeatherProvince[] | null>(null)
  const [weatherProvinceIdx, setWeatherProvinceIdx] = useState(0)
  const [weatherCityIdx, setWeatherCityIdx] = useState(0)
  const [weatherDistrictIdx, setWeatherDistrictIdx] = useState(0)

  const { accounts, removeAccount, testAccount } = useCalDAV()
  const {
    subscriptions,
    addSubscription,
    updateSubscription,
    removeSubscription,
    syncSubscription,
    presetState,
    togglePreset,
    setPresetParam,
  } = useWebcalSubscriptions()

  // Load the weather city catalogue once and resolve the currently-persisted
  // location back to its picker indexes (so the selects show what's selected).
  useEffect(() => {
    let cancelled = false
    loadWeatherCities()
      .then((provinces) => {
        if (cancelled) return
        setWeatherProvinces(provinces)
        const found = findWeatherLocation(provinces, presetState.weather)
        if (found) {
          setWeatherProvinceIdx(found.province)
          setWeatherCityIdx(found.city)
          setWeatherDistrictIdx(found.district)
        }
      })
      .catch(() => {
        // Leave weatherProvinces null → the UI falls back to the free-text input.
      })
    return () => {
      cancelled = true
    }
    // Resolve once on mount; the picker keeps its own indexes afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSyncSubscription = async (id: string): Promise<void> => {
    setSyncingSubscriptionId(id)
    try {
      await syncSubscription(id)
    } finally {
      setSyncingSubscriptionId(null)
    }
  }

  const handleRemoveSubscription = (id: string): void => {
    if (!confirm(t('caldav.confirmRemoveSubscription'))) {
      return
    }
    removeSubscription(id)
  }

  const clearTestState = (id: string): void => {
    setTestStates((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleTestAccount = async (id: string): Promise<void> => {
    setTestStates((prev) => ({ ...prev, [id]: { status: 'testing' } }))
    const result = await testAccount(id)
    setTestStates((prev) => ({
      ...prev,
      [id]: result.ok
        ? { status: 'ok' }
        : {
            status: 'error',
            message:
              result.protocol === 'jmap' && result.error
                ? connectionErrorMessage(result.error, result.code)
                : result.error,
            hint: result.hint,
          },
    }))
  }

  const handleDiagnose = async (account: CalDAVAccount): Promise<void> => {
    if (diagnosing?.accountId === account.id) {
      setDiagnosing(null)
      return
    }
    const credential = await getCredentialById(account.credentialId)
    if (!credential) {
      setTestStates((prev) => ({
        ...prev,
        [account.id]: { status: 'error', message: t('caldav.credentialsNotFound') },
      }))
      return
    }
    setDiagnosing({
      accountId: account.id,
      options: {
        serverUrl: account.serverUrl,
        username: account.username,
        password: credential.password,
        customHeaders: credential.customHeaders,
        proxyUrl: account.proxyUrl,
        protocol: account.protocol ?? 'caldav',
      },
    })
  }

  const handleEditAccount = (account: CalDAVAccount): void => {
    clearTestState(account.id)
    setDiagnosing(null)
    setEditingAccount(account)
  }

  const handleDeleteAccount = async (id: string): Promise<void> => {
    if (!confirm(t('caldav.confirmRemoveAccount'))) {
      return
    }
    clearTestState(id)
    await removeAccount(id)
  }

  const renderStatus = (account: CalDAVAccount): JSX.Element => {
    const test = testStates[account.id]

    if (test?.status === 'testing') {
      return (
        <div className={styles.accountStatus}>
          <div className={`${styles.statusDot} ${styles.statusDotTesting}`} />
          {t('caldav.testing')}
        </div>
      )
    }
    if (test?.status === 'ok') {
      return (
        <div className={styles.accountStatus}>
          <div className={`${styles.statusDot} ${styles.statusDotOk}`} />
          {t('caldav.connectionOk')}
        </div>
      )
    }
    if (test?.status === 'error') {
      return (
        <div className={styles.accountStatus}>
          <div className={`${styles.statusDot} ${styles.statusDotWarn}`} />
          {test.message
            ? t('caldav.failedWithMessage', { message: test.message })
            : t('caldav.connectionFailed')}
        </div>
      )
    }

    return (
      <div className={styles.accountStatus}>
        <div className={`${styles.statusDot} ${styles.statusDotOk}`} />
        {account.lastSyncAt
          ? t('caldav.syncedOn', { date: new Date(account.lastSyncAt).toLocaleDateString() })
          : t('caldav.connected')}
      </div>
    )
  }

  return (
    <section
      className={`${styles.section} ${styles.sectionActive}`}
      data-component="caldav-settings"
    >
      <SettingsPageHeading title={t('caldav.title')} searchControl={searchControl} />

      <div className={styles.group} data-component="connected-accounts">
        <div className={styles.groupLabel}>{t('caldav.connectedAccounts')}</div>
        {accounts.map((account) => {
          const test = testStates[account.id]
          return (
            <div key={account.id} data-component="account-row-wrapper">
              <div
                className={styles.accountRow}
                data-component="account-row"
                data-account-id={account.id}
                data-account-name={account.name}
              >
                <div
                  className={styles.accountIcon}
                  style={{ background: 'color-mix(in srgb, var(--accent) 10%, var(--canvas))' }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <rect width="20" height="20" rx="5" fill="var(--accent)" opacity="0.8" />
                    <text
                      x="10"
                      y="14"
                      textAnchor="middle"
                      fontSize="11"
                      fill="white"
                      fontFamily="sans-serif"
                    >
                      {account.name.charAt(0)}
                    </text>
                  </svg>
                </div>
                <div className={styles.accountInfo}>
                  <div className={styles.accountName}>{account.name}</div>
                  <span
                    className={styles.accountStatus}
                    data-component="account-protocol"
                    aria-label={t('caldav.accountProtocol')}
                  >
                    {account.protocol === 'jmap' ? 'JMAP' : 'CalDAV'}
                  </span>
                  {renderStatus(account)}
                </div>
                <div className={styles.accountActions}>
                  <button
                    className={styles.rowBtn}
                    onClick={() => handleTestAccount(account.id)}
                    disabled={test?.status === 'testing'}
                    aria-label={t('caldav.testAriaLabel', { name: account.name })}
                    data-component="action-button"
                    data-action="test-account"
                    type="button"
                  >
                    {t('caldav.test')}
                  </button>
                  <button
                    className={styles.rowBtn}
                    onClick={() => void handleDiagnose(account)}
                    aria-label={t('caldav.diagnoseAriaLabel', { name: account.name })}
                    aria-expanded={diagnosing?.accountId === account.id}
                    data-component="action-button"
                    data-action="diagnose-account"
                    type="button"
                  >
                    {t('caldav.diagnose')}
                  </button>
                  <button
                    className={styles.rowBtn}
                    onClick={() => handleEditAccount(account)}
                    aria-label={t('caldav.editAriaLabel', { name: account.name })}
                    data-component="action-button"
                    data-action="edit-account"
                    type="button"
                  >
                    {t('caldav.edit')}
                  </button>
                  <button
                    className={styles.disconnect}
                    onClick={() => handleDeleteAccount(account.id)}
                    aria-label={t('caldav.disconnectAriaLabel', { name: account.name })}
                    type="button"
                  >
                    {t('caldav.disconnect')}
                  </button>
                </div>
              </div>
              {test?.status === 'error' && test.hint && (
                <div className={styles.accountHint}>{test.hint}</div>
              )}
              {diagnosing?.accountId === account.id && (
                <DiagnosticsPanel options={diagnosing.options} autoRun />
              )}
            </div>
          )
        })}

        <button
          className={styles.connectBtn}
          onClick={() => setIsAddingAccount(true)}
          data-component="action-button"
          data-action="add-account"
          type="button"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M8 2v12M2 8h12" />
          </svg>
          {t('caldav.addAccount')}
        </button>
      </div>

      <div className={styles.group} data-component="webcal-subscriptions">
        <div className={styles.groupLabel}>{t('caldav.calendarSubscriptions')}</div>

        <div className={styles.presetGroup} data-component="preset-subscriptions">
          <div className={styles.groupLabel}>{t('caldav.presetSubscriptions')}</div>
          <div className={styles.presetHint}>{t('caldav.presetHint')}</div>
          {PRESET_SUBSCRIPTIONS.map((preset) => {
            const enabled = presetState.toggles[preset.id] ?? false
            return (
              <div
                key={preset.id}
                className={styles.accountRow}
                data-component="preset-row"
                data-preset-id={preset.id}
              >
                <div
                  className={styles.accountIcon}
                  style={{ background: `color-mix(in srgb, ${preset.color} 15%, var(--canvas))` }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <rect width="20" height="20" rx="5" fill={preset.color} opacity="0.8" />
                    <text
                      x="10"
                      y="14"
                      textAnchor="middle"
                      fontSize="11"
                      fill="white"
                      fontFamily="sans-serif"
                    >
                      {preset.name.charAt(0)}
                    </text>
                  </svg>
                </div>
                <div className={styles.accountInfo}>
                  <div className={styles.accountName}>{preset.name}</div>
                </div>
                <div className={styles.accountActions}>
                  {preset.type === 'astro' && (
                    <select
                      className={styles.select}
                      value={presetState.astro}
                      onChange={(e) => void setPresetParam('astro', e.target.value)}
                      disabled={!enabled}
                      aria-label={t('caldav.presetAstroAria')}
                    >
                      {ZODIAC_SIGNS.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {preset.type === 'weather' &&
                    (weatherProvinces ? (
                      <div className={styles.weatherPicker}>
                        <select
                          className={styles.select}
                          value={weatherProvinceIdx}
                          onChange={(e) => {
                            const pi = Number(e.target.value)
                            setWeatherProvinceIdx(pi)
                            setWeatherCityIdx(0)
                            setWeatherDistrictIdx(0)
                            const key = weatherProvinces[pi]?.[1]?.[0]?.[1]?.[0]?.[1]
                            if (key) void setPresetParam('weather', key)
                          }}
                          disabled={!enabled}
                          aria-label={t('caldav.presetWeatherProvinceAria')}
                        >
                          {weatherProvinces.map((prov, i) => (
                            <option key={i} value={i}>
                              {prov[0]}
                            </option>
                          ))}
                        </select>
                        <select
                          className={styles.select}
                          value={weatherCityIdx}
                          onChange={(e) => {
                            const ci = Number(e.target.value)
                            setWeatherCityIdx(ci)
                            setWeatherDistrictIdx(0)
                            const key =
                              weatherProvinces[weatherProvinceIdx]?.[1]?.[ci]?.[1]?.[0]?.[1]
                            if (key) void setPresetParam('weather', key)
                          }}
                          disabled={!enabled}
                          aria-label={t('caldav.presetWeatherCityAria')}
                        >
                          {weatherProvinces[weatherProvinceIdx]?.[1]?.map((city, i) => (
                            <option key={i} value={i}>
                              {city[0]}
                            </option>
                          ))}
                        </select>
                        <select
                          className={styles.select}
                          value={weatherDistrictIdx}
                          onChange={(e) => {
                            const di = Number(e.target.value)
                            setWeatherDistrictIdx(di)
                            const key =
                              weatherProvinces[weatherProvinceIdx]?.[1]?.[weatherCityIdx]?.[1]?.[di]?.[1]
                            if (key) void setPresetParam('weather', key)
                          }}
                          disabled={!enabled}
                          aria-label={t('caldav.presetWeatherDistrictAria')}
                        >
                          {weatherProvinces[weatherProvinceIdx]?.[1]?.[weatherCityIdx]?.[1]?.map(
                            (d, i) => (
                              <option key={i} value={i}>
                                {d[0]}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    ) : (
                      <input
                        className={styles.textInput}
                        type="text"
                        defaultValue={presetState.weather}
                        key={presetState.weather}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          if (v && v !== presetState.weather) {
                            void setPresetParam('weather', v)
                          }
                        }}
                        disabled={!enabled}
                        placeholder="Beijing_Beijing_Haidian"
                        aria-label={t('caldav.presetWeatherAria')}
                      />
                    ))}
                  <label className={styles.toggle}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => void togglePreset(preset.id, e.target.checked)}
                      aria-label={preset.name}
                    />
                    <span className={styles.pill} />
                    <span className={styles.knob} />
                  </label>
                </div>
              </div>
            )
          })}
        </div>

        {subscriptions
          .filter((subscription) => !subscription.presetId)
          .map((subscription) => (
          <div key={subscription.id} data-component="subscription-row-wrapper">
            <div
              className={styles.accountRow}
              data-component="subscription-row"
              data-subscription-id={subscription.id}
              data-subscription-name={subscription.name}
            >
              <div
                className={styles.accountIcon}
                style={{ background: 'color-mix(in srgb, var(--accent) 10%, var(--canvas))' }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <rect width="20" height="20" rx="5" fill="var(--accent)" opacity="0.8" />
                  <text
                    x="10"
                    y="14"
                    textAnchor="middle"
                    fontSize="11"
                    fill="white"
                    fontFamily="sans-serif"
                  >
                    {subscription.name.charAt(0)}
                  </text>
                </svg>
              </div>
              <div className={styles.accountInfo}>
                <div className={styles.accountName}>{subscription.name}</div>
                <div className={styles.accountStatus}>
                  <div
                    className={`${styles.statusDot} ${subscription.lastError ? styles.statusDotWarn : styles.statusDotOk}`}
                  />
                  {subscription.lastError
                    ? t('caldav.failedWithMessage', { message: subscription.lastError })
                    : subscription.lastFetchedAt
                      ? t('caldav.syncedOn', {
                          date: new Date(subscription.lastFetchedAt).toLocaleDateString(),
                        })
                      : t('caldav.notYetSynced')}
                </div>
              </div>
              <div className={styles.accountActions}>
                <button
                  className={styles.rowBtn}
                  onClick={() => setEditingSubscription(subscription)}
                  aria-label={t('caldav.editAriaLabel', { name: subscription.name })}
                  data-component="action-button"
                  data-action="edit-subscription"
                  type="button"
                >
                  {t('caldav.edit')}
                </button>
                <button
                  className={styles.rowBtn}
                  onClick={() => handleSyncSubscription(subscription.id)}
                  disabled={syncingSubscriptionId === subscription.id}
                  aria-label={t('caldav.syncAriaLabel', { name: subscription.name })}
                  data-component="action-button"
                  data-action="sync-subscription"
                  type="button"
                >
                  {syncingSubscriptionId === subscription.id
                    ? t('caldav.syncing')
                    : t('caldav.syncNow')}
                </button>
                {!subscription.isPreconfigured && (
                  <button
                    className={styles.disconnect}
                    onClick={() => handleRemoveSubscription(subscription.id)}
                    aria-label={t('caldav.removeAriaLabel', { name: subscription.name })}
                    type="button"
                  >
                    {t('caldav.remove')}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        <button
          className={styles.connectBtn}
          onClick={() => setIsSubscribing(true)}
          data-component="action-button"
          data-action="subscribe-calendar"
          type="button"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M8 2v12M2 8h12" />
          </svg>
          {t('caldav.subscribe')}
        </button>
      </div>

      <AddCalendarModal isOpen={isAddingAccount} onClose={() => setIsAddingAccount(false)} />
      {editingAccount && (
        <AddCalendarModal
          isOpen
          mode="edit"
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
        />
      )}
      <SubscribeCalendarModal
        isOpen={isSubscribing}
        onClose={() => setIsSubscribing(false)}
        addSubscription={addSubscription}
        updateSubscription={updateSubscription}
      />
      {editingSubscription && (
        <SubscribeCalendarModal
          isOpen
          mode="edit"
          subscription={editingSubscription}
          addSubscription={addSubscription}
          updateSubscription={updateSubscription}
          onClose={() => setEditingSubscription(null)}
        />
      )}
    </section>
  )
}
