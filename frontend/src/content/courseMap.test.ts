import { describe, expect, it } from 'vitest';
import {
  COURSE_LESSONS_FLAT,
  friendNode,
  friendNodeKey,
  friendPositionLabel,
} from './courseMap';

describe('friendNode', () => {
  it('places a learner who has finished nothing on the first lesson', () => {
    expect(friendNode(0, 0)).toEqual({ kind: 'lesson', index: 0 });
  });

  it('places a learner who finished a lesson but not its set on that problem set', () => {
    expect(friendNode(1, 0)).toEqual({ kind: 'pset', index: 0 });
  });

  it('advances to the next lesson once the prior set is done', () => {
    expect(friendNode(1, 1)).toEqual({ kind: 'lesson', index: 1 });
    expect(friendNode(2, 1)).toEqual({ kind: 'pset', index: 1 });
  });

  it('clamps a problem-set count that exceeds the lesson count', () => {
    // A profile can never have more sets done than lessons; treat it as the lesson node.
    expect(friendNode(1, 5)).toEqual({ kind: 'lesson', index: 1 });
  });

  it('clamps negative / fractional inputs to a safe node', () => {
    expect(friendNode(-3, -1)).toEqual({ kind: 'lesson', index: 0 });
    expect(friendNode(1.9, 0.9)).toEqual({ kind: 'pset', index: 0 });
  });

  it('reports the end once every lesson and set is complete', () => {
    const total = COURSE_LESSONS_FLAT.length;
    expect(friendNode(total, total)).toEqual({ kind: 'end' });
  });
});

describe('friendNodeKey', () => {
  it('encodes lesson, problem-set, and end nodes', () => {
    expect(friendNodeKey(0, 0)).toBe('lesson:0');
    expect(friendNodeKey(1, 0)).toBe('pset:0');
    expect(friendNodeKey(1, 1)).toBe('lesson:1');
    const total = COURSE_LESSONS_FLAT.length;
    expect(friendNodeKey(total, total)).toBe('end');
  });
});

describe('friendPositionLabel', () => {
  it('labels a lesson node with the lesson title', () => {
    expect(friendPositionLabel(0, 0)).toBe("Coulomb's Law");
  });

  it('labels a problem-set node with the lesson title and Problem Set', () => {
    expect(friendPositionLabel(1, 0)).toBe("Coulomb's Law \u00b7 Problem Set");
  });

  it('labels the next lesson once the prior set is done', () => {
    expect(friendPositionLabel(1, 1)).toBe('Charging, Conductors & Insulators');
  });

  it('labels the finished course at the end', () => {
    const total = COURSE_LESSONS_FLAT.length;
    expect(friendPositionLabel(total, total)).toBe('Finished the course');
  });
});
