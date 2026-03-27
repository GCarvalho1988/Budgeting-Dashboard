import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import KpiCard from '../src/components/KpiCard'

describe('KpiCard', () => {
  it('renders label and value', () => {
    render(<KpiCard label="Total Spend" value="£2,847" />)
    expect(screen.getByText('Total Spend')).toBeInTheDocument()
    expect(screen.getByText('£2,847')).toBeInTheDocument()
  })

  it('shows upward arrow and red colour for positive delta (overspend)', () => {
    render(<KpiCard label="Spend" value="£100" delta={12} deltaLabel="vs last month" />)
    const delta = screen.getByText(/12%/)
    expect(delta.textContent).toContain('↑')
    expect(delta.className).toContain('DC9F85')
  })

  it('shows downward arrow and green colour for negative delta (underspend)', () => {
    render(<KpiCard label="Spend" value="£100" delta={-8} deltaLabel="vs last month" />)
    const delta = screen.getByText(/8%/)
    expect(delta.textContent).toContain('↓')
    expect(delta.className).toContain('B6A596')
  })

  it('omits delta section when delta is not provided', () => {
    render(<KpiCard label="Spend" value="£100" />)
    expect(screen.queryByText(/↑|↓/)).not.toBeInTheDocument()
  })
})

describe('KpiCard — subLine prop', () => {
  it('renders subLine text when provided', () => {
    render(<KpiCard label="Bills" value="£1,200" subLine="Nursery £550" />)
    expect(screen.getByText('Nursery £550')).toBeInTheDocument()
  })

  it('does not render subLine element when not provided', () => {
    render(<KpiCard label="Bills" value="£1,200" />)
    expect(screen.queryByTestId('kpi-subline')).toBeNull()
  })
})

describe('KpiCard — muted prop', () => {
  it('renders value in muted colour when muted=true', () => {
    render(<KpiCard label="Transfers" value="£300" muted />)
    const valueEl = screen.getByText('£300')
    expect(valueEl.className).toContain('66473B')
  })
})
