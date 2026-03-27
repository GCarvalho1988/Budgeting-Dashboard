import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Logo from '../src/components/Logo'

describe('Logo', () => {
  it('renders an SVG element', () => {
    const { container } = render(<Logo />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders at default 24×24 size', () => {
    const { container } = render(<Logo />)
    const svg = container.querySelector('svg')
    expect(svg.getAttribute('width')).toBe('24')
    expect(svg.getAttribute('height')).toBe('24')
  })

  it('accepts a custom size prop', () => {
    const { container } = render(<Logo size={48} />)
    const svg = container.querySelector('svg')
    expect(svg.getAttribute('width')).toBe('48')
    expect(svg.getAttribute('height')).toBe('48')
  })
})
