import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { decision, tooltipProps } from '../../test/fixtures'
import { DecisionTooltip } from './DecisionChart'
import { buildDecisionRows } from './decisionModel'

describe('DecisionTooltip', () => {
  it('lists forecast, plan-to, range and outturn', () => {
    const row = buildDecisionRows(decision(), true)[0]
    render(<DecisionTooltip {...tooltipProps([row])} />)
    expect(screen.getByText('10,000 MW')).toBeInTheDocument()
    expect(screen.getByText('9,000 MW')).toBeInTheDocument()
    expect(screen.getByText('7,000 MW – 10,500 MW')).toBeInTheDocument()
    expect(screen.getByText('6,000 MW')).toBeInTheDocument()
  })

  it('renders nothing when inactive', () => {
    const { container } = render(<DecisionTooltip {...tooltipProps([], false)} />)
    expect(container).toBeEmptyDOMElement()
  })
})
