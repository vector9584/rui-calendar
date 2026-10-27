import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CalendarSkeleton } from '../Skeleton'

describe('CalendarSkeleton', () => {
  it('renders month skeleton by default', () => {
    const { container } = render(<CalendarSkeleton />)
    // Month has 7-column grid rows
    expect(container.querySelectorAll('.skeleton-grid-row').length).toBe(5)
    expect(container.querySelectorAll('.skeleton-cell').length).toBe(35) // 5 rows × 7 cols
  })

  it('renders month skeleton when view=month', () => {
    const { container } = render(<CalendarSkeleton view="month" />)
    expect(container.querySelectorAll('.skeleton-grid-row').length).toBe(5)
  })

  it('renders week skeleton', () => {
    const { container } = render(<CalendarSkeleton view="week" />)
    expect(container.querySelector('.skeleton-week')).toBeTruthy()
    expect(container.querySelectorAll('.skeleton-week-row').length).toBe(12) // 7am–6pm
    expect(container.querySelectorAll('.skeleton-week-cell').length).toBe(84) // 12 rows × 7 cols
  })

  it('renders day skeleton', () => {
    const { container } = render(<CalendarSkeleton view="day" />)
    expect(container.querySelector('.skeleton-day')).toBeTruthy()
    expect(container.querySelectorAll('.skeleton-day-row').length).toBe(14) // 6am–7pm
  })

  it('renders agenda skeleton', () => {
    const { container } = render(<CalendarSkeleton view="agenda" />)
    expect(container.querySelector('.skeleton-agenda')).toBeTruthy()
    expect(container.querySelectorAll('.skeleton-agenda-item').length).toBe(6)
  })

  it('renders todo skeleton', () => {
    const { container } = render(<CalendarSkeleton view="todo" />)
    expect(container.querySelector('.skeleton-todo')).toBeTruthy()
    expect(container.querySelectorAll('.skeleton-todo-item').length).toBe(5)
  })

  it('has aria-hidden for accessibility', () => {
    const { container } = render(<CalendarSkeleton />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.getAttribute('aria-hidden')).toBe('true')
  })

  it('applies skeleton container class', () => {
    const { container } = render(<CalendarSkeleton />)
    expect(container.firstChild).toHaveClass('skeleton')
  })
})
