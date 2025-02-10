/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    dragMap(startX: number, startY: number, endX: number, endY: number): Chainable<void>
    waitForMap(): Chainable<JQuery<HTMLElement>>
    checkMapState(zoom: number, center: { lat: number, lng: number }): Chainable<void>
    verifySettingsUpdate(callback: (settings: Record<string, unknown>) => void): Chainable<void>
  }
}
