import { describe, test, expect, beforeEach } from 'vitest';
import { getSemanticType, calculateImportance, detectPatterns } from '../../src/layout/extractor';

// Mock DOM要素を作成
function createMockElement(tag: string, attrs: any = {}): HTMLElement {
  const element = document.createElement(tag);
  
  if (attrs.className) element.className = attrs.className;
  if (attrs.id) element.id = attrs.id;
  if (attrs.role) element.setAttribute('role', attrs.role);
  if (attrs.onclick) element.onclick = attrs.onclick;
  if (attrs.children) {
    attrs.children.forEach((child: HTMLElement) => element.appendChild(child));
  }
  
  // getBoundingClientRectのモック
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => attrs.rect || {
      x: 0, y: 0, width: 100, height: 50,
      top: 0, left: 0, right: 100, bottom: 50
    }
  });
  
  return element;
}

describe('getSemanticType', () => {
  test('ナビゲーション要素を正しく識別する', () => {
    const nav = createMockElement('nav');
    expect(getSemanticType(nav)).toBe('navigation');
    
    const divWithRole = createMockElement('div', { role: 'navigation' });
    expect(getSemanticType(divWithRole)).toBe('navigation');
    
    const divWithClass = createMockElement('div', { className: 'nav' });
    expect(getSemanticType(divWithClass)).toBe('navigation');
  });

  test('セクション要素を正しく識別する', () => {
    const section = createMockElement('section');
    expect(getSemanticType(section)).toBe('section');
    
    const article = createMockElement('article');
    expect(getSemanticType(article)).toBe('section');
    
    const main = createMockElement('main');
    expect(getSemanticType(main)).toBe('section');
    
    const header = createMockElement('header');
    expect(getSemanticType(header)).toBe('section');
  });

  test('インタラクティブ要素を正しく識別する', () => {
    const button = createMockElement('button');
    expect(getSemanticType(button)).toBe('interactive');
    
    const link = createMockElement('a');
    expect(getSemanticType(link)).toBe('interactive');
    
    const input = createMockElement('input');
    expect(getSemanticType(input)).toBe('interactive');
    
    const divWithOnclick = createMockElement('div', { onclick: () => {} });
    expect(getSemanticType(divWithOnclick)).toBe('interactive');
  });

  test('コンテナ要素を正しく識別する', () => {
    const container = createMockElement('div', {
      children: [
        createMockElement('div'),
        createMockElement('div'),
        createMockElement('div')
      ]
    });
    expect(getSemanticType(container)).toBe('container');
  });

  test('グループ要素を正しく識別する', () => {
    const group = createMockElement('ul', {
      children: [
        createMockElement('li'),
        createMockElement('li')
      ]
    });
    expect(getSemanticType(group)).toBe('group');
  });

  test('コンテンツ要素を正しく識別する', () => {
    const p = createMockElement('p');
    expect(getSemanticType(p)).toBe('content');
    
    const span = createMockElement('span');
    expect(getSemanticType(span)).toBe('content');
  });
});

describe('calculateImportance', () => {
  beforeEach(() => {
    // window.innerWidth/innerHeightのモック
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1280
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 720
    });
  });

  test('大きな要素は高い重要度を持つ', () => {
    const largeElement = createMockElement('div', {
      rect: { x: 0, y: 0, width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 }
    });
    const importance = calculateImportance(largeElement, largeElement.getBoundingClientRect());
    expect(importance).toBeGreaterThan(30);
  });

  test('上部の要素は高い重要度を持つ', () => {
    const topElement = createMockElement('div', {
      rect: { x: 0, y: 0, width: 200, height: 100, top: 0, left: 0, right: 200, bottom: 100 }
    });
    const topImportance = calculateImportance(topElement, topElement.getBoundingClientRect());
    
    const bottomElement = createMockElement('div', {
      rect: { x: 0, y: 600, width: 200, height: 100, top: 600, left: 0, right: 200, bottom: 700 }
    });
    const bottomImportance = calculateImportance(bottomElement, bottomElement.getBoundingClientRect());
    
    expect(topImportance).toBeGreaterThan(bottomImportance);
  });

  test('重要なタグは高い重要度を持つ', () => {
    const h1 = createMockElement('h1', {
      rect: { x: 0, y: 0, width: 200, height: 50, top: 0, left: 0, right: 200, bottom: 50 }
    });
    const h1Importance = calculateImportance(h1, h1.getBoundingClientRect());
    
    const div = createMockElement('div', {
      rect: { x: 0, y: 0, width: 200, height: 50, top: 0, left: 0, right: 200, bottom: 50 }
    });
    const divImportance = calculateImportance(div, div.getBoundingClientRect());
    
    expect(h1Importance).toBeGreaterThan(divImportance);
  });

  test('重要度は100を超えない', () => {
    const veryImportant = createMockElement('main', {
      rect: { x: 0, y: 0, width: 1280, height: 720, top: 0, left: 0, right: 1280, bottom: 720 }
    });
    const importance = calculateImportance(veryImportant, veryImportant.getBoundingClientRect());
    expect(importance).toBeLessThanOrEqual(100);
  });
});

describe('detectPatterns', () => {
  test('同じタグとサイズの要素をパターンとして検出する', () => {
    const elements = [
      {
        tagName: 'DIV',
        className: 'card',
        rect: { x: 0, y: 0, width: 300, height: 200 }
      },
      {
        tagName: 'DIV',
        className: 'card',
        rect: { x: 320, y: 0, width: 300, height: 200 }
      },
      {
        tagName: 'DIV',
        className: 'card',
        rect: { x: 640, y: 0, width: 300, height: 200 }
      }
    ];
    
    const patterns = detectPatterns(elements);
    expect(patterns).toHaveLength(1);
    expect(patterns[0].elements).toHaveLength(3);
    expect(patterns[0].type).toBe('DIV');
    expect(patterns[0].className).toBe('card');
  });

  test('異なるサイズの要素はパターンとして検出しない', () => {
    const elements = [
      {
        tagName: 'DIV',
        className: 'item',
        rect: { x: 0, y: 0, width: 300, height: 200 }
      },
      {
        tagName: 'DIV',
        className: 'item',
        rect: { x: 320, y: 0, width: 200, height: 100 }
      }
    ];
    
    const patterns = detectPatterns(elements);
    expect(patterns).toHaveLength(0);
  });

  test('異なるタグの要素はパターンとして検出しない', () => {
    const elements = [
      {
        tagName: 'DIV',
        className: 'item',
        rect: { x: 0, y: 0, width: 300, height: 200 }
      },
      {
        tagName: 'SPAN',
        className: 'item',
        rect: { x: 320, y: 0, width: 300, height: 200 }
      }
    ];
    
    const patterns = detectPatterns(elements);
    expect(patterns).toHaveLength(0);
  });

  test('単一の要素はパターンとして検出しない', () => {
    const elements = [
      {
        tagName: 'DIV',
        className: 'unique',
        rect: { x: 0, y: 0, width: 300, height: 200 }
      }
    ];
    
    const patterns = detectPatterns(elements);
    expect(patterns).toHaveLength(0);
  });
});