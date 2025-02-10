import { useState } from 'react';

interface TestCase {
  id: string;
  category: string;
  description: string;
  steps: string[];
  expectedResult: string;
}

export default function TestPlan() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [completedTests, setCompletedTests] = useState<Set<string>>(new Set());

  const testCases: TestCase[] = [
    // Map Navigation Tests
    {
      id: 'nav-1',
      category: 'navigation',
      description: 'Basic Map Navigation',
      steps: [
        'Click and drag the map in different directions',
        'Verify smooth panning',
        'Check that tiles load properly during movement'
      ],
      expectedResult: 'Map should pan smoothly with proper tile loading'
    },
    {
      id: 'nav-2',
      category: 'navigation',
      description: 'Zoom Controls',
      steps: [
        'Use + button to zoom in',
        'Use - button to zoom out',
        'Use mouse wheel to zoom',
        'Double click to zoom in',
        'Check zoom level indicator updates'
      ],
      expectedResult: 'Zoom should work smoothly with all methods'
    },

    // Tile Loading Tests
    {
      id: 'tile-1',
      category: 'tiles',
      description: 'Tile Loading Performance',
      steps: [
        'Rapidly zoom in/out',
        'Pan quickly across the map',
        'Check tile loading indicators'
      ],
      expectedResult: 'Tiles should load efficiently with proper loading states'
    },
    {
      id: 'tile-2',
      category: 'tiles',
      description: 'Tile Styles',
      steps: [
        'Switch between different tile styles',
        'Verify style changes at different zoom levels',
        'Check attribution updates'
      ],
      expectedResult: 'All tile styles should render correctly'
    },

    // UI Tests
    {
      id: 'ui-1',
      category: 'ui',
      description: 'Responsive Layout',
      steps: [
        'Resize browser window',
        'Test on mobile view',
        'Check control positioning'
      ],
      expectedResult: 'UI should adapt smoothly to different screen sizes'
    },
    {
      id: 'ui-2',
      category: 'ui',
      description: 'Dark Mode',
      steps: [
        'Toggle dark mode',
        'Check all UI elements',
        'Verify readability',
        'Test at different times of day'
      ],
      expectedResult: 'Dark mode should apply correctly to all elements'
    },

    // Search Tests
    {
      id: 'search-1',
      category: 'search',
      description: 'Location Search',
      steps: [
        'Search for a city',
        'Search for a country',
        'Test partial matches',
        'Verify map centers on result'
      ],
      expectedResult: 'Search should work accurately with proper map centering'
    },

    // Feature Tests
    {
      id: 'feature-1',
      category: 'features',
      description: 'Tile Information',
      steps: [
        'Check tile coordinates',
        'Verify geographic bounds',
        'Test scale indicator',
        'Check load time display'
      ],
      expectedResult: 'All tile information should be accurate and update properly'
    }
  ];

  const categories = ['all', ...new Set(testCases.map(test => test.category))];

  const toggleTestCompletion = (id: string) => {
    setCompletedTests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const filteredTests = testCases.filter(
    test => activeCategory === 'all' || test.category === activeCategory
  );

  return (
    <div className="max-w-4xl mx-auto p-6 bg-card">
      <h1 className="text-2xl font-bold mb-6">Map Testing Plan</h1>
      
      {/* Category filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-3 py-1 rounded capitalize ${
              activeCategory === category
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span>Progress</span>
          <span>
            {completedTests.size} / {testCases.length} tests completed
          </span>
        </div>
        <div className="w-full bg-secondary rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-all"
            style={{
              width: `${(completedTests.size / testCases.length) * 100}%`
            }}
          />
        </div>
      </div>

      {/* Test cases */}
      <div className="space-y-4">
        {filteredTests.map(test => (
          <div
            key={test.id}
            className={`p-4 rounded-lg border ${
              completedTests.has(test.id)
                ? 'bg-secondary/50'
                : 'bg-card'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-semibold">{test.description}</h3>
              <button
                onClick={() => toggleTestCompletion(test.id)}
                className={`px-3 py-1 rounded ${
                  completedTests.has(test.id)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {completedTests.has(test.id) ? 'Completed' : 'Mark Complete'}
              </button>
            </div>
            <div className="text-sm text-muted-foreground mb-2">
              Category: <span className="capitalize">{test.category}</span>
            </div>
            <div className="space-y-2">
              <div>
                <h4 className="font-medium mb-1">Steps:</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {test.steps.map((step, index) => (
                    <li key={index} className="text-sm">{step}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-1">Expected Result:</h4>
                <p className="text-sm">{test.expectedResult}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
