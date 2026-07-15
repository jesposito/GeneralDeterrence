import { describe, expect, it } from 'vitest';
import { debriefStoryCount, generateSavedLifeStories, STORY_TEMPLATE_COUNT } from './stories';

describe('debrief stories', () => {
  it('always supplies several stories and caps busy shifts at four', () => {
    expect(STORY_TEMPLATE_COUNT).toBeGreaterThanOrEqual(217);
    expect(debriefStoryCount(0, 0)).toBe(3);
    expect(debriefStoryCount(1, 1)).toBe(3);
    expect(debriefStoryCount(2, 2)).toBe(4);
    expect(debriefStoryCount(8, 8)).toBe(4);
  });

  it('is deterministic with distinct people', () => {
    const stories = generateSavedLifeStories(3, 42);
    expect(stories).toEqual(generateSavedLifeStories(3, 42));
    expect(new Set(stories.map(story => story.name))).toHaveLength(3);
  });
});
