# OpenStreetMap Web Application

## Overview

A feature-rich map implementation built with modern web technologies, providing smooth tile loading, high zoom level support, and persistent user settings.

## Tech Stack

- **Frontend Framework**: Next.js 15.1.6
- **UI Library**: React 19.0.0
- **Map Library**: Leaflet 1.9.4 with react-leaflet 5.0.0
- **Language**: TypeScript 5
- **Styling**: TailwindCSS 3.4.1
- **Database**: Prisma 6.3.1
- **Testing**:
  - Unit/Integration: Jest 29.7.0
  - E2E: Playwright 1.50.1
  - Component: Storybook 8.5.3
  - Additional E2E: Cypress 14.0.2

## Prerequisites

- Node.js (Latest LTS version recommended)
- npm or yarn
- PostgreSQL (for Prisma database)

## Getting Started

1. **Clone the Repository**
   ```bash
   git clone [repository-url]
   cd webapp
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Database**
   ```bash
   # Initialize Prisma
   npx prisma generate
   npx prisma migrate dev
   ```

4. **Environment Setup**
   Create a `.env.local` file:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/map_db"
   NEXT_PUBLIC_API_URL="http://localhost:3000"
   ```

## Development

1. **Start Development Server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`

2. **Run Tests**
   ```bash
   # Unit and Integration Tests
   npm run test
   npm run test:watch    # Watch mode
   npm run test:coverage # Coverage report

   # E2E Tests
   npm run test:e2e
   npm run test:e2e:ui   # With UI
   npm run test:e2e:debug # Debug mode

   # Run All Tests
   npm run test:all
   ```

3. **Linting**
   ```bash
   npm run lint
   ```

## Production Deployment

1. **Build the Application**
   ```bash
   npm run build
   ```

2. **Start Production Server**
   ```bash
   npm run start
   ```

3. **Docker Deployment**
   ```bash
   # Build Docker image
   docker build -t map-webapp .

   # Run container
   docker run -p 3000:3000 map-webapp
   ```

## Testing Strategy

1. **Unit Tests** (`/src/**/*.test.tsx`)
   - Component rendering
   - Function behavior
   - State management
   - Event handling

2. **Integration Tests** (`/src/**/*.integration.test.tsx`)
   - Component interactions
   - API integration
   - State persistence
   - Event propagation

3. **E2E Tests**
   - Playwright (`/tests/e2e/*.test.ts`)
     - User journeys
     - Cross-browser testing
     - Performance monitoring
   - Cypress (`/cypress/e2e/*.cy.ts`)
     - Interactive features
     - Real-time updates
     - Network requests

4. **Component Tests**
   - Storybook stories
   - Visual regression testing
   - Component isolation

## Component Architecture

### Core Components

#### 1. Map.tsx
The main map component that orchestrates the entire map functionality.

**Features:**
- Multiple tile layer support
- Settings persistence
- Event handling
- UI controls (zoom, layers, scale)

**Props:**
```typescript
interface MapProps {
  center?: [number, number];    // Default: [51.505, -0.09] (London)
  zoom?: number;                // Default: 13
  minZoom?: number;            // Default: 0
  maxZoom?: number;            // Default: 20
}
```

**Example:**
```tsx
import { Map } from '@/components/Map';

function App() {
  return (
    <Map
      center={[51.505, -0.09]}
      zoom={13}
      minZoom={0}
      maxZoom={20}
    />
  );
}
```

#### 2. HighZoomTileLayer.tsx
A specialized tile layer component for optimized high-zoom rendering.

**Features:**
- High zoom level optimizations
- Progressive tile loading
- Hardware-accelerated transforms
- Smart tile caching

**Props:**
```typescript
interface HighZoomTileLayerProps {
  url: string;                  // Tile server URL template
  attribution: string;          // Attribution text
  maxZoom: number;             // Maximum zoom level
  minZoom: number;             // Minimum zoom level
  maxNativeZoom: number;       // Maximum zoom with native tiles
  onTileLoad?: () => void;     // Tile load callback
  onTileError?: () => void;    // Tile error callback
  onTileLoading?: () => void;  // Tile loading callback
  highZoomConfig?: {
    quality: 'low' | 'medium' | 'high';
    progressiveLoading: boolean;
    scaleMethod: 'nearest' | 'bilinear' | 'pixelated' | 'auto';
  };
}
```

### Supporting Components

#### 1. MapInitializer
Handles map initialization and global instance setup.

#### 2. TileLoadHandler
Manages tile loading, prefetching, and error handling.

#### 3. MapEventHandler
Coordinates map events and user interactions.

## Features & Implementation

### 1. Tile Management
```typescript
// Example: Configure tile loading
<HighZoomTileLayer
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  attribution="© OpenStreetMap contributors"
  maxZoom={20}
  minZoom={0}
  maxNativeZoom={18}
  highZoomConfig={{
    quality: 'high',
    progressiveLoading: true,
    scaleMethod: 'auto'
  }}
  onTileLoad={() => console.log('Tile loaded')}
  onTileError={(e) => console.error('Tile error:', e)}
/>
```

### 2. High Zoom Support
```typescript
// Example: Configure high zoom behavior
const highZoomConfig = {
  quality: 'high' as const,
  progressiveLoading: true,
  scaleMethod: 'auto' as const
};

<Map
  maxZoom={22}
  maxNativeZoom={18}
  highZoomConfig={highZoomConfig}
/>
```

### 3. Settings Persistence
```typescript
// Example: Custom settings persistence
const handleSettingsChange = async (settings: MapSettings) => {
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};
```

### 4. Multiple Tile Providers
```typescript
// Example: Add custom tile provider
const customProvider = {
  name: 'Custom Style',
  url: 'https://your-tile-server/{z}/{x}/{y}.png',
  attribution: '© Your Attribution',
  maxZoom: 20,
  minZoom: 0,
  maxNativeZoom: 18,
  highZoomConfig: {
    quality: 'high',
    progressiveLoading: true,
    scaleMethod: 'auto'
  }
};
```

## Performance Optimizations

1. **Caching**
- Browser's native tile caching
- In-memory tile state tracking
- Parent tile caching for zoom transitions
- See [CACHING.md](../../docs/CACHING.md) for details

2. **Loading**
- Progressive tile loading
- Adjacent tile preloading
- Hardware acceleration
- Smooth transitions

3. **Memory Management**
- Efficient tile cleanup
- Optimized state updates
- Smart cache invalidation

## Usage

```tsx
import { Map } from './components/Map';

function App() {
  return (
    <Map
      center={[51.505, -0.09]} // Default to London
      zoom={13}
      minZoom={0}
      maxZoom={20}
    />
  );
}
```

## Configuration

The map can be configured through the `tileProviders` configuration in `tile-utils.ts`. Each provider can specify:
- URL template
- Attribution
- Zoom level constraints
- High zoom behavior
- Quality settings

## Event Handling

The implementation provides several event handlers:
- Zoom changes
- Map movement
- Tile loading states
- Layer changes

## Styling

The implementation includes:
- Responsive text sizing
- High-contrast labels
- Smooth transitions
- Hardware-accelerated transforms

## Future Improvements

1. **Performance**
- Optimize settings persistence frequency
- Consolidate tile tracking mechanisms
- Implement tile load prioritization

2. **Features**
- Add tile load analytics
- Implement offline support
- Add custom tile provider support

3. **Monitoring**
- Add performance metrics
- Track cache effectiveness
- Monitor memory usage

## Performance Monitoring

### Development
1. **Chrome DevTools**
   - Network tab for tile loading performance
   - Performance tab for rendering metrics
   - Memory tab for heap snapshots

2. **React DevTools**
   - Component rendering performance
   - Hook dependencies tracking
   - State updates monitoring

3. **Playwright Tracing**
   ```bash
   # Record a trace
   npm run test:e2e -- --trace on
   
   # View the trace
   npm run test:e2e:report
   ```

### Production
1. **Monitoring Metrics**
   - Tile load success/failure rates
   - Average tile load time
   - Memory usage patterns
   - Cache hit/miss ratios

2. **Error Tracking**
   - Tile loading errors
   - API failures
   - Client-side exceptions
   - Performance bottlenecks

## Troubleshooting

### Common Issues

1. **Tile Loading Failures**
   ```typescript
   // Add error boundary for tile loading
   <ErrorBoundary fallback={<ErrorTile />}>
     <HighZoomTileLayer {...props} />
   </ErrorBoundary>
   ```

2. **Memory Leaks**
   - Check cleanup in useEffect hooks
   - Monitor tile cache size
   - Verify event listener cleanup

3. **Performance Issues**
   - Reduce unnecessary re-renders
   - Optimize tile preloading
   - Adjust cache sizes

### Debugging Tips

1. **Development Mode**
   ```bash
   # Enable detailed logging
   DEBUG=map:* npm run dev
   
   # Run with performance tracing
   TRACE=1 npm run dev
   ```

2. **Production Issues**
   ```bash
   # Enable source maps
   NODE_ENV=production SOURCE_MAPS=true npm start
   
   # Monitor memory usage
   NODE_OPTIONS=--max-old-space-size=4096 npm start
   ```

## Related Documentation

- [CACHING.md](../../docs/CACHING.md) - Detailed caching documentation
- [tile-utils.ts](../../utils/tile-utils.ts) - Utility functions and provider configuration
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Contribution guidelines
- [DEPLOYMENT.md](../../DEPLOYMENT.md) - Deployment guides
