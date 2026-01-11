/**
 * Debug Service for topic-specific logging
 *
 * Provides conditional console logging based on enabled debug topics.
 * Topics can be toggled individually in the Debug settings.
 */

export type DebugTopic =
  | 'presentation-view'
  | 'presentation-window'
  | 'slide-parsing'
  | 'font-handling'
  | 'renderer'
  | 'inspector'
  | 'thumbnail-navigator'
  | 'excalidraw';

export interface DebugTopicConfig {
  [key: string]: boolean;
}

export class DebugService {
  private enabledTopics: DebugTopicConfig = {};

  constructor(initialConfig: DebugTopicConfig = {}) {
    this.enabledTopics = { ...initialConfig };
  }

  /**
   * Update enabled topics
   */
  setTopicConfig(config: DebugTopicConfig): void {
    this.enabledTopics = { ...config };
  }

  /**
   * Enable a specific topic
   */
  enableTopic(topic: DebugTopic): void {
    this.enabledTopics[topic] = true;
  }

  /**
   * Disable a specific topic
   */
  disableTopic(topic: DebugTopic): void {
    this.enabledTopics[topic] = false;
  }

  /**
   * Check if a topic is enabled
   */
  isEnabled(topic: DebugTopic): boolean {
    return this.enabledTopics[topic] === true;
  }

  /**
   * Log a message for a specific topic
   */
  log(topic: DebugTopic, message: string, data?: any): void {
    if (this.isEnabled(topic)) {
      const prefix = `[${topic}]`;
      if (data !== undefined) {
        console.log(prefix, message, data);
      } else {
        console.log(prefix, message);
      }
    }
  }

  /**
   * Log a warning for a specific topic
   */
  warn(topic: DebugTopic, message: string, data?: any): void {
    if (this.isEnabled(topic)) {
      const prefix = `[${topic}]`;
      if (data !== undefined) {
        console.warn(prefix, message, data);
      } else {
        console.warn(prefix, message);
      }
    }
  }

  /**
   * Log an error for a specific topic
   */
  error(topic: DebugTopic, message: string, data?: any): void {
    if (this.isEnabled(topic)) {
      const prefix = `[${topic}]`;
      if (data !== undefined) {
        console.error(prefix, message, data);
      } else {
        console.error(prefix, message);
      }
    }
  }

  /**
   * Get all available topics with their enabled status
   */
  getTopics(): Array<{ topic: DebugTopic; enabled: boolean }> {
    const allTopics: DebugTopic[] = [
      'presentation-view',
      'presentation-window',
      'slide-parsing',
      'font-handling',
      'renderer',
      'inspector',
      'thumbnail-navigator',
      'excalidraw',
    ];
    return allTopics.map((topic) => ({
      topic,
      enabled: this.isEnabled(topic),
    }));
  }
}

// Global debug service instance
let debugService: DebugService | null = null;

export function getDebugService(): DebugService {
  if (!debugService) {
    debugService = new DebugService();
  }
  return debugService;
}

export function setDebugService(service: DebugService): void {
  debugService = service;
}
