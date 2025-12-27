import { describe, it, expect } from "bun:test";
import { buildTitleBlockPrompt } from "../../src/prompts/detectTitleBlock";

describe('buildTitleBlockPrompt', () => {
  it('should include image dimensions', () => {
    const prompt = buildTitleBlockPrompt(5100, 3300);
    
    expect(prompt).toContain('5100');
    expect(prompt).toContain('3300');
  });

  it('should mention visual characteristics for identification', () => {
    const prompt = buildTitleBlockPrompt(5100, 3300);
    
    expect(prompt).toContain('Visual Characteristics');
    expect(prompt).toContain('Structured layout');
    expect(prompt).toContain('labeled fields');
    expect(prompt).toContain('Position-independent');
  });

  it('should include sheet number detection instructions', () => {
    const prompt = buildTitleBlockPrompt(5100, 3300);
    
    expect(prompt).toContain('SHEET NUMBER');
    expect(prompt).toContain('SHEET NO.');
  });

  it('should include sheet title detection instructions', () => {
    const prompt = buildTitleBlockPrompt(5100, 3300);
    
    expect(prompt).toContain('SHEET TITLE');
    expect(prompt).toContain('FOUNDATION PLAN');
  });

  it('should include notes detection instructions', () => {
    const prompt = buildTitleBlockPrompt(5100, 3300);
    
    expect(prompt).toContain('NOTES');
    expect(prompt).toContain('GENERAL NOTES');
  });
});

