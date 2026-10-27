import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ShortcutsHelp } from '../ShortcutsHelp'

describe('ShortcutsHelp', () => {
  it('does not render when closed', () => {
    render(<ShortcutsHelp isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByText(/keyboard shortcuts/i)).not.toBeInTheDocument()
  })

  it('lists the main shortcuts when open', () => {
    render(<ShortcutsHelp isOpen={true} onClose={vi.fn()} />)
    // Title
    expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument()
    // A few well-known shortcuts
    expect(screen.getByText(/jump to today/i)).toBeInTheDocument()
    expect(screen.getByText(/new event/i)).toBeInTheDocument()
    expect(screen.getByText(/new task/i)).toBeInTheDocument()
    // Keys rendered as <kbd>
    expect(screen.getAllByText('T').length).toBeGreaterThan(0)
    expect(screen.getAllByText('C').length).toBeGreaterThan(0)
  })

  it('calls onClose when the modal close button is clicked', async () => {
    const onClose = vi.fn()
    render(<ShortcutsHelp isOpen={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    // onClose fires after the exit animation completes.
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
