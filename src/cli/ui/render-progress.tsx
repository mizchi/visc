/**
 * Render progress UI using Ink
 */

import React, { useState, useEffect } from 'react';
import { render } from 'ink';
import { ProgressUI, CalibrationUI, ComparisonResultUI } from './progress-ui.js';
import { progressManager } from './progress-manager.js';
import type { TaskProgress } from './progress-ui.js';

interface AppState {
  phase: 'capture' | 'compare' | 'calibration';
  tasks: TaskProgress[];
  overallProgress: number;
}

const App: React.FC<{ title: string }> = ({ title }) => {
  const [state, setState] = useState<AppState>({
    phase: 'capture',
    tasks: [],
    overallProgress: 0
  });

  useEffect(() => {
    const handleUpdate = (newState: AppState) => {
      setState(newState);
    };

    progressManager.on('update', handleUpdate);
    
    // Get initial state
    setState(progressManager.getState());

    return () => {
      progressManager.off('update', handleUpdate);
    };
  }, []);

  return (
    <ProgressUI
      title={title}
      phase={state.phase}
      tasks={state.tasks}
      overallProgress={state.overallProgress}
    />
  );
};

let inkInstance: any = null;

export function startProgress(title: string) {
  if (inkInstance) {
    inkInstance.unmount();
  }
  
  inkInstance = render(<App title={title} />);
}

export function stopProgress() {
  if (inkInstance) {
    inkInstance.unmount();
    inkInstance = null;
  }
}

// Helper to show calibration UI
export function showCalibrationProgress(
  testCase: string,
  viewport: string,
  samples: number
) {
  let currentSample = 0;
  
  const { unmount } = render(
    <CalibrationUI
      testCase={testCase}
      viewport={viewport}
      samples={samples}
      currentSample={currentSample}
    />
  );

  return {
    updateSample: (sample: number, confidence?: number) => {
      currentSample = sample;
      // Re-render with new values
      unmount();
      render(
        <CalibrationUI
          testCase={testCase}
          viewport={viewport}
          samples={samples}
          currentSample={currentSample}
          confidence={confidence}
        />
      );
    },
    complete: () => unmount()
  };
}

// Helper to show comparison results
export function showComparisonResults(results: Array<{
  testCase: string;
  viewport: string;
  similarity: number;
  hasIssues: boolean;
  changes?: number;
}>) {
  const { unmount, waitUntilExit } = render(
    <ComparisonResultUI results={results} />
  );

  return waitUntilExit();
}