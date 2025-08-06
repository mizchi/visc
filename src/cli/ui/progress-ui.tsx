/**
 * Ink-based TUI for visual progress display
 */

import React, { useState, useEffect } from 'react';
import { Text, Box, useApp, Static } from 'ink';
import Spinner from 'ink-spinner';

// Simple progress bar component
const SimpleProgressBar: React.FC<{ value: number; width?: number }> = ({ 
  value, 
  width = 20 
}) => {
  const clampedValue = Math.max(0, Math.min(100, value));
  const filled = Math.floor((clampedValue / 100) * width);
  const empty = width - filled;
  
  return (
    <Text>
      <Text color="cyan">{'█'.repeat(filled)}</Text>
      <Text color="gray">{'░'.repeat(empty)}</Text>
    </Text>
  );
};

export interface TaskProgress {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  total?: number;
  message?: string;
}

export interface ProgressUIProps {
  title: string;
  tasks: TaskProgress[];
  phase?: 'capture' | 'compare' | 'calibration';
  overallProgress?: number;
  onComplete?: () => void;
}

const StatusIcon: React.FC<{ status: TaskProgress['status'] }> = ({ status }) => {
  switch (status) {
    case 'pending':
      return <Text color="gray">⏸ </Text>;
    case 'running':
      return <Text color="blue"><Spinner type="dots" /></Text>;
    case 'completed':
      return <Text color="green">✓ </Text>;
    case 'failed':
      return <Text color="red">✗ </Text>;
  }
};

const PhaseEmoji: React.FC<{ phase?: string }> = ({ phase }) => {
  switch (phase) {
    case 'capture':
      return <Text>📥</Text>;
    case 'compare':
      return <Text>📊</Text>;
    case 'calibration':
      return <Text>🔧</Text>;
    default:
      return <Text>🚀</Text>;
  }
};

export const ProgressUI: React.FC<ProgressUIProps> = ({
  title,
  tasks,
  phase,
  overallProgress = 0,
  onComplete
}) => {
  const { exit } = useApp();
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);

  useEffect(() => {
    const allCompleted = tasks.every(task => 
      task.status === 'completed' || task.status === 'failed'
    );
    
    if (allCompleted && tasks.length > 0) {
      onComplete?.();
    }
  }, [tasks, onComplete]);

  // Group tasks by status
  const runningTasks = tasks.filter(t => t.status === 'running');
  const completedTasksList = tasks.filter(t => t.status === 'completed');
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const failedTasks = tasks.filter(t => t.status === 'failed');

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <PhaseEmoji phase={phase} />
        <Text bold> {title}</Text>
      </Box>

      {/* Overall Progress */}
      {overallProgress > 0 && (
        <Box marginBottom={1}>
          <Text>[</Text>
          <SimpleProgressBar value={overallProgress} width={30} />
          <Text>] {Math.round(overallProgress)}%</Text>
        </Box>
      )}

      {/* Completed Tasks (Static) */}
      {completedTasksList.length > 0 && (
        <Static items={completedTasksList}>
          {(task) => (
            <Box key={task.id}>
              <StatusIcon status="completed" />
              <Text dimColor>{task.label}</Text>
              {task.message && <Text color="gray"> - {task.message}</Text>}
            </Box>
          )}
        </Static>
      )}

      {/* Running Tasks */}
      {runningTasks.map(task => (
        <Box key={task.id}>
          <StatusIcon status={task.status} />
          <Text bold color="blue">{task.label}</Text>
          {task.progress !== undefined && task.total && (
            <Text color="gray"> ({task.progress}/{task.total})</Text>
          )}
          {task.message && <Text color="yellow"> - {task.message}</Text>}
        </Box>
      ))}

      {/* Failed Tasks */}
      {failedTasks.map(task => (
        <Box key={task.id}>
          <StatusIcon status="failed" />
          <Text color="red">{task.label}</Text>
          {task.message && <Text color="red"> - {task.message}</Text>}
        </Box>
      ))}

      {/* Summary */}
      <Box marginTop={1}>
        <Text dimColor>
          {completedTasksList.length}/{tasks.length} completed
          {failedTasks.length > 0 && <Text color="red"> ({failedTasks.length} failed)</Text>}
        </Text>
      </Box>
    </Box>
  );
};

// Calibration specific UI
export const CalibrationUI: React.FC<{
  testCase: string;
  viewport: string;
  samples: number;
  currentSample: number;
  confidence?: number;
}> = ({ testCase, viewport, samples, currentSample, confidence }) => {
  return (
    <Box flexDirection="column">
      <Box>
        <Text>🔧 Calibrating </Text>
        <Text bold>{testCase}</Text>
        <Text> @ </Text>
        <Text color="cyan">{viewport}</Text>
      </Box>
      
      <Box marginTop={1}>
        <Text>Collecting samples: [</Text>
        <SimpleProgressBar value={(currentSample / samples) * 100} width={20} />
        <Text>] {currentSample}/{samples}</Text>
      </Box>

      {confidence !== undefined && (
        <Box marginTop={1}>
          <Text>Confidence: </Text>
          <Text color={confidence > 90 ? 'green' : confidence > 70 ? 'yellow' : 'red'}>
            {confidence.toFixed(1)}%
          </Text>
        </Box>
      )}
    </Box>
  );
};

// Comparison result UI
export const ComparisonResultUI: React.FC<{
  results: Array<{
    testCase: string;
    viewport: string;
    similarity: number;
    hasIssues: boolean;
    changes?: number;
  }>;
}> = ({ results }) => {
  const issueCount = results.filter(r => r.hasIssues).length;
  
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>📊 Comparison Results</Text>
      </Box>

      {results.map((result, index) => (
        <Box key={index}>
          <Text>
            {result.hasIssues ? '⚠️ ' : '✅ '}
            {result.testCase} @ {result.viewport}: 
          </Text>
          <Text color={result.hasIssues ? 'yellow' : 'green'}>
            {' '}{result.similarity.toFixed(1)}% similar
          </Text>
          {result.changes && result.changes > 0 && (
            <Text color="gray"> ({result.changes} changes)</Text>
          )}
        </Box>
      ))}

      <Box marginTop={1}>
        <Text bold>
          {issueCount === 0 ? (
            <Text color="green">✨ All tests passed!</Text>
          ) : (
            <Text color="yellow">⚠️  {issueCount} tests with visual changes</Text>
          )}
        </Text>
      </Box>
    </Box>
  );
};