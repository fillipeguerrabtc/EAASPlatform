/**
 * REQUEST QUEUE SYSTEM
 * 
 * Implements a FIFO queue with concurrency control for expensive operations like Puppeteer.
 * Prevents memory exhaustion and ensures fair processing.
 * 
 * Based on external security review recommendations:
 * - Max 2 concurrent Puppeteer operations
 * - Queue overflow protection
 * - Timeout enforcement
 * - Memory-efficient design
 */

interface QueueItem<T> {
  id: string;
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  createdAt: Date;
  timeout: number;
}

export class RequestQueue<T = any> {
  private queue: QueueItem<T>[] = [];
  private running = 0;
  private maxConcurrent: number;
  private maxQueueSize: number;
  private defaultTimeout: number;

  constructor(options: {
    maxConcurrent?: number;
    maxQueueSize?: number;
    defaultTimeout?: number;
  } = {}) {
    this.maxConcurrent = options.maxConcurrent || 2;
    this.maxQueueSize = options.maxQueueSize || 10;
    this.defaultTimeout = options.defaultTimeout || 30000; // 30 seconds
  }

  /**
   * Add a task to the queue
   * Returns a promise that resolves when the task completes
   */
  async enqueue(task: () => Promise<T>, options?: { timeout?: number }): Promise<T> {
    // Check queue size limit
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error(
        `Queue is full (${this.maxQueueSize} items). Too many concurrent requests. Please try again later.`
      );
    }

    return new Promise<T>((resolve, reject) => {
      const queueItem: QueueItem<T> = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        task,
        resolve,
        reject,
        createdAt: new Date(),
        timeout: options?.timeout || this.defaultTimeout,
      };

      this.queue.push(queueItem);
      this.processNext();
    });
  }

  /**
   * Process next item in queue if capacity allows
   */
  private async processNext(): Promise<void> {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.running++;

    let timeoutHandle: NodeJS.Timeout | null = null;

    try {
      // Create timeout promise with handle for cleanup
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Task ${item.id} timed out after ${item.timeout}ms`));
        }, item.timeout);
      });

      // Race between task completion and timeout
      const result = await Promise.race([
        item.task(),
        timeoutPromise
      ]);

      // Clear timeout if task completed before timeout
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      item.resolve(result);
    } catch (error: any) {
      // Clear timeout on error
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      
      item.reject(error);
    } finally {
      this.running--;
      // Process next item
      this.processNext();
    }
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueueSize: this.maxQueueSize,
    };
  }

  /**
   * Clear all pending tasks
   */
  clear() {
    const clearedCount = this.queue.length;
    
    // Reject all pending tasks
    this.queue.forEach(item => {
      item.reject(new Error("Queue cleared"));
    });
    
    this.queue = [];
    
    return { clearedCount };
  }
}
