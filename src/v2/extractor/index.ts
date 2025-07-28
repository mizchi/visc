/**
 * V2 Layout Extractor - レイアウト抽出機能
 */

import { Driver } from '../../driver/types.js';
import { ExtractedLayout, ExtractedElement, AccessibilityInfo } from '../types/index.js';

/**
 * レイアウトを抽出
 */
export async function extractLayout(driver: Driver): Promise<ExtractedLayout> {
  const { url, viewport } = await driver.evaluate(() => ({
    url: window.location.href,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  }));

  const elements = await driver.evaluate(() => {
    const extractElement = (element: Element, index: number): ExtractedElement | null => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return null;
      }

      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return null;
      }

      // アクセシビリティ情報を抽出
      const accessibility: AccessibilityInfo = {
        role: element.getAttribute('role') || undefined,
        ariaLabel: element.getAttribute('aria-label') || undefined,
        ariaLabelledBy: element.getAttribute('aria-labelledby') || undefined,
        ariaDescribedBy: element.getAttribute('aria-describedby') || undefined,
        ariaHidden: element.getAttribute('aria-hidden') === 'true',
        ariaExpanded: element.getAttribute('aria-expanded') === 'true',
        ariaSelected: element.getAttribute('aria-selected') === 'true',
        ariaChecked: element.getAttribute('aria-checked') === 'true',
        ariaDisabled: element.getAttribute('aria-disabled') === 'true',
        ariaValueNow: element.getAttribute('aria-valuenow') ? 
          parseFloat(element.getAttribute('aria-valuenow')!) : undefined,
        ariaValueMin: element.getAttribute('aria-valuemin') ? 
          parseFloat(element.getAttribute('aria-valuemin')!) : undefined,
        ariaValueMax: element.getAttribute('aria-valuemax') ? 
          parseFloat(element.getAttribute('aria-valuemax')!) : undefined,
        ariaValueText: element.getAttribute('aria-valuetext') || undefined,
        tabIndex: element.hasAttribute('tabindex') ? 
          parseInt(element.getAttribute('tabindex')!, 10) : undefined
      };

      // 子要素を再帰的に処理
      const children: ExtractedElement[] = [];
      const childElements = Array.from(element.children);
      for (let i = 0; i < childElements.length; i++) {
        const child = extractElement(childElements[i], i);
        if (child) {
          children.push(child);
        }
      }

      // テキストコンテンツを取得（子要素のテキストを除く）
      let textContent = '';
      const textNodes = Array.from(element.childNodes).filter(
        node => node.nodeType === Node.TEXT_NODE
      );
      textContent = textNodes
        .map(node => node.textContent?.trim() || '')
        .filter(text => text.length > 0)
        .join(' ');

      return {
        id: `element_${index}`,
        tagName: element.tagName.toLowerCase(),
        className: element.className || undefined,
        textContent: textContent || undefined,
        position: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        },
        accessibility,
        children
      };
    };

    const body = document.body;
    const rootElement = extractElement(body, 0);
    return rootElement ? [rootElement] : [];
  });

  return {
    url,
    timestamp: Date.now(),
    viewport,
    elements
  };
}