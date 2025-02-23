/// <reference types="cypress" />
import { Map as LeafletMap } from 'leaflet';

// Remove conflicting Window interface declaration and import the one from window.d.ts
declare global {
  namespace Cypress {
    interface Chainable<Subject = any> {
      dragMap(startX: number, startY: number, endX: number, endY: number): Chainable<void>;
      waitForMap(): Chainable<void>;
      checkMapState(zoom: number, center: { lat: number; lng: number }): Chainable<void>;
      verifySettingsUpdate(callback: (settings: Record<string, unknown>) => void): Chainable<void>;
    }
  }
}

// @ts-expect-error - Cypress namespace issue
Cypress.Commands.add('dragMap', (startX: number, startY: number, endX: number, endY: number) => {
  return cy.get('.leaflet-container')
    .trigger('mousedown', { clientX: String(startX), clientY: String(startY) })
    .trigger('mousemove', { clientX: String(endX), clientY: String(endY) })
    .trigger('mouseup');
});

// @ts-expect-error - Cypress namespace issue
Cypress.Commands.add('waitForMap', () => {
  return cy.get('.leaflet-container', { timeout: 10000 })
    .should('be.visible')
    .then(() => {
      cy.get('.leaflet-control-zoom').should('be.visible');
    });
});

// @ts-expect-error - Cypress namespace issue
Cypress.Commands.add('checkMapState', (expectedZoom: number, expectedCenter: { lat: number; lng: number }) => {
  return cy.window().then((win) => {
    const map = win.map;
    const zoom = map.getZoom();
    const center = map.getCenter();
    
    cy.wrap({ value: zoom }).should('have.property', 'value', expectedZoom);
    cy.wrap({ value: center.lat }).should('have.property', 'value').and('be.closeTo', String(expectedCenter.lat), 0.001);
    cy.wrap({ value: center.lng }).should('have.property', 'value').and('be.closeTo', String(expectedCenter.lng), 0.001);
  });
});

// @ts-expect-error - Cypress namespace issue
Cypress.Commands.add('verifySettingsUpdate', (callback: (settings: Record<string, unknown>) => void) => {
  return cy.wait('@saveSettings').then((interception) => {
    cy.wrap(interception.request.body).should('exist');
    callback(interception.request.body);
  });
});

// Type definitions
export interface CypressCustomCommands {
  dragMap(startX: number, startY: number, endX: number, endY: number): Cypress.Chainable<void>;
  waitForMap(): Cypress.Chainable<void>;
  checkMapState(zoom: number, center: { lat: number; lng: number }): Cypress.Chainable<void>;
  verifySettingsUpdate(callback: (settings: Record<string, unknown>) => void): Cypress.Chainable<void>;
}

declare global {
  namespace Cypress {
    interface Chainable extends CypressCustomCommands {}
  }
}

export {};
