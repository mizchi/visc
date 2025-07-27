import { describe, it, expect } from 'vitest';
import { ProxyOverrideHandler, commonOverrides } from '../../src/proxy/override-handler.js';
import type { ProxyOverride } from '../../src/types.js';

describe('ProxyOverrideHandler', () => {
  describe('マッチング', () => {
    it('URLパターン（文字列）でマッチする', () => {
      const handler = new ProxyOverrideHandler([
        {
          match: { url: '/api/' },
          response: { status: 200 }
        }
      ]);

      const override = handler.findMatchingOverride(
        'https://example.com/api/users',
        'GET',
        {}
      );

      expect(override).toBeTruthy();
      expect(override?.response?.status).toBe(200);
    });

    it('URLパターン（正規表現）でマッチする', () => {
      const handler = new ProxyOverrideHandler([
        {
          match: { url: /\.json$/ },
          response: { status: 201 }
        }
      ]);

      const override = handler.findMatchingOverride(
        'https://example.com/data.json',
        'GET',
        {}
      );

      expect(override).toBeTruthy();
      expect(override?.response?.status).toBe(201);
    });

    it('HTTPメソッドでマッチする', () => {
      const handler = new ProxyOverrideHandler([
        {
          match: { method: ['POST', 'PUT'] },
          response: { status: 202 }
        }
      ]);

      const postOverride = handler.findMatchingOverride(
        'https://example.com/api',
        'POST',
        {}
      );
      expect(postOverride).toBeTruthy();

      const getOverride = handler.findMatchingOverride(
        'https://example.com/api',
        'GET',
        {}
      );
      expect(getOverride).toBeNull();
    });

    it('ヘッダーでマッチする', () => {
      const handler = new ProxyOverrideHandler([
        {
          match: { headers: { 'x-api-key': 'secret123' } },
          response: { status: 203 }
        }
      ]);

      const override = handler.findMatchingOverride(
        'https://example.com/api',
        'GET',
        { 'x-api-key': 'secret123' }
      );

      expect(override).toBeTruthy();
      expect(override?.response?.status).toBe(203);
    });

    it('優先度に基づいて選択される', () => {
      const handler = new ProxyOverrideHandler([
        {
          match: { url: '/api/' },
          response: { status: 100 },
          priority: 1
        },
        {
          match: { url: '/api/' },
          response: { status: 200 },
          priority: 10
        }
      ]);

      const override = handler.findMatchingOverride(
        'https://example.com/api/users',
        'GET',
        {}
      );

      expect(override?.response?.status).toBe(200);
    });

    it('無効なオーバーライドはスキップされる', () => {
      const handler = new ProxyOverrideHandler([
        {
          match: { url: '/api/' },
          response: { status: 100 },
          enabled: false
        },
        {
          match: { url: '/api/' },
          response: { status: 200 }
        }
      ]);

      const override = handler.findMatchingOverride(
        'https://example.com/api/users',
        'GET',
        {}
      );

      expect(override?.response?.status).toBe(200);
    });
  });

  describe('リクエスト書き換え', () => {
    it('URLを書き換える', () => {
      const handler = new ProxyOverrideHandler([]);
      const override: ProxyOverride = {
        match: {},
        request: {
          url: 'https://mock.example.com/api'
        }
      };

      const result = handler.applyRequestOverride(
        override,
        'https://example.com/api',
        {},
        undefined
      );

      expect(result.url).toBe('https://mock.example.com/api');
    });

    it('URL書き換え関数を実行する', () => {
      const handler = new ProxyOverrideHandler([]);
      const override: ProxyOverride = {
        match: {},
        request: {
          url: (original) => original.replace('http://', 'https://')
        }
      };

      const result = handler.applyRequestOverride(
        override,
        'http://example.com/api',
        {},
        undefined
      );

      expect(result.url).toBe('https://example.com/api');
    });

    it('ヘッダーを追加する', () => {
      const handler = new ProxyOverrideHandler([]);
      const override: ProxyOverride = {
        match: {},
        request: {
          headers: {
            'Authorization': 'Bearer token123',
            'X-Custom': 'value'
          }
        }
      };

      const result = handler.applyRequestOverride(
        override,
        'https://example.com/api',
        { 'Content-Type': 'application/json' },
        undefined
      );

      expect(result.headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token123',
        'X-Custom': 'value'
      });
    });

    it('ボディを書き換える', () => {
      const handler = new ProxyOverrideHandler([]);
      const override: ProxyOverride = {
        match: {},
        request: {
          body: JSON.stringify({ modified: true })
        }
      };

      const result = handler.applyRequestOverride(
        override,
        'https://example.com/api',
        {},
        JSON.stringify({ original: true })
      );

      expect(result.body).toBe(JSON.stringify({ modified: true }));
    });
  });

  describe('レスポンス書き換え', () => {
    it('ステータスコードを書き換える', () => {
      const handler = new ProxyOverrideHandler([]);
      const override: ProxyOverride = {
        match: {},
        response: {
          status: 404
        }
      };

      const result = handler.applyResponseOverride(
        override,
        200,
        {},
        'OK'
      );

      expect(result.status).toBe(404);
    });

    it('レスポンス全体を置き換える', () => {
      const handler = new ProxyOverrideHandler([]);
      const override: ProxyOverride = {
        match: {},
        response: {
          replace: {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mocked: true })
          }
        }
      };

      const result = handler.applyResponseOverride(
        override,
        500,
        { 'Content-Type': 'text/html' },
        'Error'
      );

      expect(result.status).toBe(200);
      expect(result.headers).toEqual({
        'Content-Type': 'application/json'
      });
      expect(result.body).toBe(JSON.stringify({ mocked: true }));
    });

    it('ヘッダー書き換え関数を実行する', () => {
      const handler = new ProxyOverrideHandler([]);
      const override: ProxyOverride = {
        match: {},
        response: {
          headers: {
            'X-Modified': (original) => `${original || 'none'}-modified`
          }
        }
      };

      const result = handler.applyResponseOverride(
        override,
        200,
        { 'X-Modified': 'original' },
        undefined
      );

      expect(result.headers['X-Modified']).toBe('original-modified');
    });
  });

  describe('共通オーバーライドプリセット', () => {
    it('認証ヘッダーを追加する', () => {
      const override = commonOverrides.addAuthHeader('test-token');
      const handler = new ProxyOverrideHandler([override]);

      const result = handler.applyRequestOverride(
        override,
        'https://api.example.com',
        {},
        undefined
      );

      expect(result.headers['Authorization']).toBe('Bearer test-token');
    });

    it('APIエンドポイントをモックする', () => {
      const mockData = { users: [{ id: 1, name: 'Test' }] };
      const override = commonOverrides.mockApiEndpoint('/api/users', mockData);
      const handler = new ProxyOverrideHandler([override]);

      const matched = handler.findMatchingOverride(
        'https://example.com/api/users',
        'GET',
        {}
      );

      expect(matched).toBeTruthy();
      expect(matched?.response?.replace?.body).toBe(JSON.stringify(mockData));
    });

    it('トラッキングスクリプトをブロックする', () => {
      const override = commonOverrides.blockTracking();
      const handler = new ProxyOverrideHandler([override]);

      const matched = handler.findMatchingOverride(
        'https://www.google-analytics.com/analytics.js',
        'GET',
        {}
      );

      expect(matched).toBeTruthy();
      expect(matched?.response?.replace?.status).toBe(204);
    });

    it('キャッシュを無効化する', () => {
      const override = commonOverrides.disableCache();
      const handler = new ProxyOverrideHandler([override]);

      const requestResult = handler.applyRequestOverride(
        override,
        'https://example.com',
        {},
        undefined
      );

      const responseResult = handler.applyResponseOverride(
        override,
        200,
        {},
        undefined
      );

      expect(requestResult.headers['Cache-Control']).toBe('no-cache');
      expect(responseResult.headers['Cache-Control']).toBe('no-store, no-cache, must-revalidate');
    });

    it('Cookieを削除する', () => {
      const override = commonOverrides.removeCookie('session');
      const handler = new ProxyOverrideHandler([override]);

      const result = handler.applyResponseOverride(
        override,
        200,
        {
          'Set-Cookie': 'session=abc123; Path=/; HttpOnly, tracking=xyz; Path=/'
        },
        undefined
      );

      expect(result.headers['Set-Cookie']).toBe(' tracking=xyz; Path=/');
    });
  });
});