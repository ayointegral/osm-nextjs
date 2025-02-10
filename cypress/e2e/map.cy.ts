describe('Map Page', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/settings', {
      statusCode: 200,
      body: {
        defaultProvider: 'osm',
        defaultZoom: 13,
        defaultCenter: { lat: 51.505, lng: -0.09 },
      },
    }).as('getSettings');

    cy.intercept('POST', '/api/settings', {
      statusCode: 200,
      body: {
        defaultProvider: 'osm',
        defaultZoom: 13,
        defaultCenter: { lat: 51.505, lng: -0.09 },
      },
    }).as('saveSettings');

    cy.visit('/');
  });

  it('should load the map', () => {
    cy.wait('@getSettings');
    cy.get('.leaflet-container').should('be.visible');
    cy.get('.leaflet-control-zoom').should('be.visible');
  });

  it('should show zoom level', () => {
    cy.wait('@getSettings');
    cy.contains('Zoom Level:').should('be.visible');
  });

  it('should save settings when zooming', () => {
    cy.wait('@getSettings');
    cy.get('.leaflet-control-zoom-in').click();
    cy.wait('@saveSettings').its('request.body').should('deep.include', {
      defaultZoom: 14,
    });
  });

  it('should handle API errors gracefully', () => {
    cy.intercept('POST', '/api/settings', {
      statusCode: 500,
      body: { error: 'Server error' },
    }).as('saveSettingsError');

    cy.wait('@getSettings');
    cy.get('.leaflet-control-zoom-in').click();
    cy.wait('@saveSettingsError');
    // Map should still be usable
    cy.get('.leaflet-container').should('be.visible');
  });
});
