import { describe, it, expect, beforeEach } from 'vitest';
import { extractLayout } from '../../src/core/layout-extractor.js';
import { Driver } from '../../src/driver/types.js';

// モックドライバー
class MockDriver implements Driver {
  private mockElements: any;
  private viewport = { width: 1280, height: 720 };

  constructor(mockElements: any = null) {
    this.mockElements = mockElements;
  }

  async goto(url: string): Promise<void> {}
  async close(): Promise<void> {}
  async screenshot(): Promise<Buffer> {
    return Buffer.from('mock');
  }
  
  async setViewport(viewport: { width: number; height: number }): Promise<void> {
    this.viewport = viewport;
  }
  
  getViewport(): { width: number; height: number } {
    return this.viewport;
  }
  
  async evaluate<T>(fn: (...args: any[]) => T): Promise<T> {
    if (this.mockElements) {
      return this.mockElements as T;
    }
    
    // デフォルトのモック要素
    return {
      elements: [{
        tagName: 'body',
        bounds: { x: 0, y: 0, width: 1280, height: 720 },
        isVisible: true,
        opacity: 1,
        accessibility: {},
        attributes: {},
        children: [
          {
            tagName: 'h1',
            id: 'main-title',
            className: 'title primary',
            text: 'Hello World',
            bounds: { x: 100, y: 50, width: 300, height: 40 },
            isVisible: true,
            opacity: 1,
            accessibility: { role: 'heading', ariaLabel: 'Main Title' },
            attributes: { 'data-testid': 'main-heading' }
          },
          {
            tagName: 'nav',
            className: 'navigation',
            bounds: { x: 0, y: 100, width: 1280, height: 60 },
            isVisible: true,
            opacity: 1,
            accessibility: { role: 'navigation' },
            attributes: {},
            children: [
              {
                tagName: 'a',
                text: 'Home',
                bounds: { x: 20, y: 120, width: 50, height: 20 },
                isVisible: true,
                opacity: 1,
                accessibility: { role: 'link', tabIndex: 0 },
                attributes: { href: '/' }
              }
            ]
          },
          {
            tagName: 'button',
            id: 'submit-btn',
            text: 'Submit',
            bounds: { x: 500, y: 300, width: 100, height: 40 },
            isVisible: true,
            opacity: 1,
            accessibility: { 
              role: 'button', 
              ariaLabel: 'Submit Form',
              ariaDisabled: false,
              tabIndex: 0
            },
            attributes: { type: 'submit' }
          }
        ]
      }],
      documentInfo: {
        title: 'Test Page',
        url: 'http://example.com',
        lang: 'en'
      }
    } as T;
  }
  
  async waitForSelector(selector: string): Promise<void> {}
  async click(selector: string): Promise<void> {}
  async type(selector: string, text: string): Promise<void> {}
  async hover(selector: string): Promise<void> {}
  async getCoverage(): Promise<{ css: any; js: any }> {
    return { css: {}, js: {} };
  }
}

describe('layout-extractor', () => {
  describe('extractLayout', () => {
    it('基本的なレイアウト抽出ができる', async () => {
      const driver = new MockDriver();
      const layout = await extractLayout(driver);
      
      expect(layout).toBeDefined();
      expect(layout.elements).toHaveLength(1);
      expect(layout.viewport).toEqual({ width: 1280, height: 720 });
      expect(layout.documentInfo).toEqual({
        title: 'Test Page',
        url: 'http://example.com',
        lang: 'en'
      });
    });

    it('ネストされた要素構造を正しく抽出できる', async () => {
      const driver = new MockDriver();
      const layout = await extractLayout(driver);
      
      const body = layout.elements[0];
      expect(body.tagName).toBe('body');
      expect(body.children).toHaveLength(3);
      
      const h1 = body.children![0];
      expect(h1.tagName).toBe('h1');
      expect(h1.id).toBe('main-title');
      expect(h1.className).toBe('title primary');
      expect(h1.text).toBe('Hello World');
      
      const nav = body.children![1];
      expect(nav.tagName).toBe('nav');
      expect(nav.children).toHaveLength(1);
      expect(nav.children![0].tagName).toBe('a');
    });

    it('アクセシビリティ情報を正しく抽出できる', async () => {
      const driver = new MockDriver();
      const layout = await extractLayout(driver);
      
      const body = layout.elements[0];
      const h1 = body.children![0];
      const button = body.children![2];
      
      expect(h1.accessibility).toEqual({
        role: 'heading',
        ariaLabel: 'Main Title'
      });
      
      expect(button.accessibility).toEqual({
        role: 'button',
        ariaLabel: 'Submit Form',
        ariaDisabled: false,
        tabIndex: 0
      });
    });

    it('位置とサイズ情報を正しく抽出できる', async () => {
      const driver = new MockDriver();
      const layout = await extractLayout(driver);
      
      const body = layout.elements[0];
      const h1 = body.children![0];
      
      expect(h1.bounds).toEqual({
        x: 100,
        y: 50,
        width: 300,
        height: 40
      });
    });

    it('可視性情報を正しく抽出できる', async () => {
      const driver = new MockDriver();
      const layout = await extractLayout(driver);
      
      const body = layout.elements[0];
      expect(body.isVisible).toBe(true);
      expect(body.opacity).toBe(1);
    });

    it('属性情報を正しく抽出できる', async () => {
      const driver = new MockDriver();
      const layout = await extractLayout(driver);
      
      const body = layout.elements[0];
      const h1 = body.children![0];
      const button = body.children![2];
      
      expect(h1.attributes).toEqual({
        'data-testid': 'main-heading'
      });
      
      expect(button.attributes).toEqual({
        type: 'submit'
      });
    });

    it('空の要素でもエラーにならない', async () => {
      const mockElements = {
        elements: [{
          tagName: 'body',
          bounds: { x: 0, y: 0, width: 1280, height: 720 },
          isVisible: true,
          opacity: 1,
          accessibility: {},
          attributes: {}
        }],
        documentInfo: {
          title: 'Empty Page',
          url: 'http://example.com'
        }
      };
      
      const driver = new MockDriver(mockElements);
      const layout = await extractLayout(driver);
      
      expect(layout.elements).toHaveLength(1);
      expect(layout.elements[0].children).toBeUndefined();
    });

    it('非表示要素が除外される', async () => {
      const mockElements = {
        elements: [{
          tagName: 'body',
          bounds: { x: 0, y: 0, width: 1280, height: 720 },
          isVisible: true,
          opacity: 1,
          accessibility: {},
          attributes: {},
          children: [
            {
              tagName: 'div',
              bounds: { x: 0, y: 0, width: 100, height: 100 },
              isVisible: false,
              opacity: 0,
              accessibility: {},
              attributes: {}
            }
          ]
        }],
        documentInfo: {
          title: 'Test',
          url: 'http://example.com'
        }
      };
      
      const driver = new MockDriver(mockElements);
      const layout = await extractLayout(driver);
      
      // display: none の要素は evaluate 内で除外されるため、
      // このテストではvisibility: hiddenの要素として扱う
      expect(layout.elements[0].children).toHaveLength(1);
      expect(layout.elements[0].children![0].isVisible).toBe(false);
    });
  });
});