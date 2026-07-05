import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { Badge, Card, DataChip, HeatDot, Modal, Panel, Pill, Tabs } from './index'

// Modal teleports into document.body; keep tests isolated from each other.
afterEach(() => {
  document.body.innerHTML = ''
})

describe('nunc-ui primitives', () => {
  it('Panel renders its title and the cold surface class', () => {
    const w = mount(Panel, { props: { title: 'T', cold: true }, slots: { default: 'body' } })
    expect(w.text()).toContain('T')
    expect(w.text()).toContain('body')
    expect(w.classes()).toContain('nui-panel--cold')
  })

  it('Card renders default and meta slots', () => {
    const w = mount(Card, { slots: { default: 'main', meta: 'meta line' } })
    expect(w.text()).toContain('main')
    expect(w.find('.nui-card-meta').text()).toBe('meta line')
  })

  it('Badge applies the variant class', () => {
    const w = mount(Badge, { props: { variant: 'success' }, slots: { default: 'ok' } })
    expect(w.classes()).toContain('nui-badge--success')
  })

  it('Pill toggles the active class', () => {
    const w = mount(Pill, { props: { active: true }, slots: { default: 'p' } })
    expect(w.classes()).toContain('nui-pill--active')
  })

  it('Tabs emits update:modelValue with the clicked id', async () => {
    const tabs = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]
    const w = mount(Tabs, { props: { tabs, modelValue: 'a' } })
    await w.findAll('button')[1].trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual(['b'])
  })

  it('Modal renders only when open and closes on backdrop click', async () => {
    const w = mount(Modal, { props: { open: false }, slots: { default: 'inner' } })
    expect(document.body.querySelector('.nui-modal')).toBeNull()
    await w.setProps({ open: true })
    expect(document.body.querySelector('.nui-modal')).toBeTruthy()
    const backdrop = document.body.querySelector('.nui-modal-backdrop') as HTMLElement
    backdrop.click()
    expect(w.emitted('close')).toBeTruthy()
  })

  it('DataChip shows label and mono value', () => {
    const w = mount(DataChip, { props: { label: 'run', value: 'abc123' } })
    expect(w.find('.nui-datachip-label').text()).toBe('run')
    expect(w.find('.nui-datachip-value').text()).toBe('abc123')
  })

  it('HeatDot carries the level class', () => {
    const w = mount(HeatDot, { props: { level: 4 } })
    expect(w.classes()).toContain('nui-heatdot--4')
  })
})
