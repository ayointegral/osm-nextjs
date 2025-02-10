/// <reference types="cypress" />

describe('Map Interactions', () => {
  beforeEach(() => {
    // Start intercepting network requests before loading the page
    cy.intercept('GET', '/api/settings', {
      fixture: 'defaultSettings.json'
    }).as('getSettings');

    cy.intercept('POST', '/api/settings').as('saveSettings');
    
    // Visit the page
    cy.visit('/');
    cy.wait('@getSettings');
  });

  describe('Map Controls', () => {
    it('should zoom in when clicking the plus button', () => {
      cy.get('.leaflet-control-zoom-in').click();
      cy.wait('@saveSettings').then((interception) => {
        cy.wrap(interception.request.body.defaultZoom).should('be.gt', 13);
      });
    });

    it('should zoom out when clicking the minus button', () => {
      cy.get('.leaflet-control-zoom-out').click();
      cy.wait('@saveSettings').then((interception) => {
        cy.wrap(interception.request.body.defaultZoom).should('be.lt', 13);
      });
    });

    it('should update center when panning the map', () => {
      // Simulate a map pan by triggering a drag event
      cy.get('.leaflet-container')
        .trigger('mousedown', { which: 1 })
        .trigger('mousemove', { clientX: 100, clientY: 100 })
        .trigger('mouseup');

      cy.wait('@saveSettings').then((interception) => {
        cy.wrap(interception.request.body.defaultCenter).should('have.property', 'lat');
        cy.wrap(interception.request.body.defaultCenter).should('have.property', 'lng');
      });
    });
  });

  describe('Layer Controls', () => {
    it('should change map provider when selecting different layers', () => {
      // Open layer control
      cy.get('.leaflet-control-layers-toggle').click();

      // Select a different layer
      cy.get('.leaflet-control-layers-base label').contains('Satellite').click();

      cy.wait('@saveSettings').then((interception) => {
        cy.wrap(interception.request.body.defaultProvider).should('eq', 'satellite');
      });
    });

    it('should persist layer selection after page reload', () => {
      // Select satellite layer
      cy.get('.leaflet-control-layers-toggle').click();
      cy.get('.leaflet-control-layers-base label').contains('Satellite').click();
      cy.wait('@saveSettings');

      // Reload page
      cy.reload();
      cy.wait('@getSettings');

      // Verify satellite layer is still selected
      cy.get('.leaflet-control-layers-toggle').click();
      cy.get('.leaflet-control-layers-base input[type="radio"]')
        .should('have.length.at.least', 2)
        .then(($inputs) => {
          const checkedInput = $inputs.filter(':checked');
          cy.wrap(checkedInput.next('span').text()).should('include', 'Satellite');
        });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', () => {
      // Simulate network error
      cy.intercept('POST', '/api/settings', {
        statusCode: 500,
        body: { error: 'Internal Server Error' }
      }).as('saveError');

      // Trigger a save operation
      cy.get('.leaflet-control-zoom-in').click();

      // Verify the map is still usable
      cy.get('.leaflet-container').should('be.visible');
      cy.get('.leaflet-control-zoom').should('be.visible');
    });

    it('should handle malformed responses', () => {
      // Simulate malformed JSON response
      cy.intercept('POST', '/api/settings', {
        statusCode: 200,
        body: 'invalid json'
      }).as('invalidResponse');

      // Trigger a save operation
      cy.get('.leaflet-control-zoom-in').click();

      // Verify the map is still usable
      cy.get('.leaflet-container').should('be.visible');
      cy.get('.leaflet-control-zoom').should('be.visible');
    });

    it('should retry failed requests', () => {
      let attempts = 0;
      cy.intercept('POST', '/api/settings', (req: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        attempts++;
        if (attempts === 1) {
          req.reply({ statusCode: 500 });
        } else {
          req.reply({ statusCode: 200, body: {} });
        }
      }).as('retryRequest');

      // Trigger a save operation
      cy.get('.leaflet-control-zoom-in').click();

      // Wait for retry
      cy.wait('@retryRequest');
      cy.wait('@retryRequest');
    });
  });

  describe('Performance', () => {
    it('should debounce rapid map interactions', () => {
      // Simulate rapid zoom changes
      cy.get('.leaflet-control-zoom-in')
        .click()
        .click()
        .click();

      // Should only make one API call within debounce period
      cy.get('@saveSettings.all').should('have.length', 1);
    });
  });
});
