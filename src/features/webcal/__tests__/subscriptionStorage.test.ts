import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createLocalStorageMock } from '@/test/storageMock'
import {
  saveSubscription,
  getAllSubscriptions,
  getSubscriptionById,
  updateSubscription,
  deleteSubscription,
} from '../subscriptionStorage'

describe('subscriptionStorage', () => {
  const storage = createLocalStorageMock()

  beforeEach(() => {
    storage.install()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    storage.reset()
  })

  it('saves and retrieves a subscription', () => {
    const saved = saveSubscription({
      calendarId: 'cal-1',
      name: 'Holidays',
      url: 'https://example.com/cal.ics',
      refreshIntervalMinutes: 60,
    })

    expect(saved.id).toBeTruthy()
    expect(saved.lastFetchedAt).toBeNull()
    expect(getAllSubscriptions()).toEqual([saved])
    expect(getSubscriptionById(saved.id)).toEqual(saved)
  })

  it('returns empty array when nothing stored', () => {
    expect(getAllSubscriptions()).toEqual([])
  })

  it('returns empty array and does not throw on corrupted JSON', () => {
    localStorage.setItem('calino_webcal_subscriptions', '{not json')
    expect(getAllSubscriptions()).toEqual([])
  })

  it('updates a subscription', () => {
    const saved = saveSubscription({
      calendarId: 'cal-1',
      name: 'Holidays',
      url: 'https://example.com/cal.ics',
      refreshIntervalMinutes: 60,
    })

    updateSubscription(saved.id, { lastFetchedAt: '2026-01-01T00:00:00.000Z', lastError: null })

    const updated = getSubscriptionById(saved.id)
    expect(updated?.lastFetchedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('deletes a subscription', () => {
    const saved = saveSubscription({
      calendarId: 'cal-1',
      name: 'Holidays',
      url: 'https://example.com/cal.ics',
      refreshIntervalMinutes: 60,
    })

    deleteSubscription(saved.id)

    expect(getAllSubscriptions()).toEqual([])
  })
})
