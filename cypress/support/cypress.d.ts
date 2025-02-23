/// <reference types="cypress" />
/// <reference types="leaflet" />

/* eslint-disable @typescript-eslint/no-explicit-any */
declare namespace Cypress {
  interface Chainable<Subject = any> {
    // Custom map commands
    dragMap(startX: number, startY: number, endX: number, endY: number): Chainable<void>;
    waitForMap(): Chainable<void>;
    checkMapState(zoom: number, center: { lat: number; lng: number }): Chainable<void>;
    verifySettingsUpdate(callback: (settings: Record<string, unknown>) => void): Chainable<void>;
    
    // Built-in Cypress commands
    intercept(url: string, response?: any): Chainable<null>
    intercept(method: string, url: string, response?: any): Chainable<null>
    intercept(method: string, url: string, handler: (req: any) => void): Chainable<null>
    visit(url: string, options?: Partial<VisitOptions>): Chainable<AUTWindow>
    wait(alias: string): Chainable<Interception>
    get(selector: string): Chainable<JQuery<HTMLElement>>
    contains(content: string): Chainable<JQuery<HTMLElement>>
    click(): Chainable<JQuery<HTMLElement>>
    trigger(eventName: string, options?: any): Chainable<JQuery<HTMLElement>>
    should(chainers: string, value?: any): Chainable<Subject>
    reload(): Chainable<AUTWindow>
  }

  interface Interception {
    request: {
      body: any
    }
  }
}

declare global {
  namespace Chai {
    interface Assertion {
      greaterThan(value: number): void
      lessThan(value: number): void
      property(name: string): void
      include(value: string): void
    }
  }
  
  interface Window {
    map: import('leaflet').Map;
  }
}
