export interface CursorState {
  x: number;
  y: number;
  down: boolean;
  pointer: 'mouse' | 'touch';
  hidden: boolean;
}

export interface TimelineFrame {
  frame: number;
  cursor: CursorState;
  scrollY: number;
}

export interface TimelineEvent {
  frame: number;
  type: 'click' | 'key' | 'mark' | 'theme' | 'tap';
  name: string;
}

export interface TimelineData {
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  durationSeconds: number;
  frames: TimelineFrame[];
  events: TimelineEvent[];
}

