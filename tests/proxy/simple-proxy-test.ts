// プロキシが正しく動作することを確認する簡単なテスト

const PROXY_ENDPOINT = process.env.PROXY_ENDPOINT || 'http://localhost:8787';

async function testProxy() {
  console.log('=== Cloudflare Worker Proxy Test ===\n');
  
  const targetUrl = 'https://example.com';
  const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`;
  
  try {
    // 直接アクセス
    console.log(`1. Direct access to ${targetUrl}`);
    const directResponse = await fetch(targetUrl);
    const directText = await directResponse.text();
    console.log(`   Status: ${directResponse.status}`);
    console.log(`   Content-Type: ${directResponse.headers.get('content-type')}`);
    console.log(`   Body length: ${directText.length} bytes`);
    
    // プロキシ経由でアクセス
    console.log(`\n2. Proxy access to ${proxyUrl}`);
    const proxyResponse = await fetch(proxyUrl);
    const proxyText = await proxyResponse.text();
    console.log(`   Status: ${proxyResponse.status}`);
    console.log(`   Content-Type: ${proxyResponse.headers.get('content-type')}`);
    console.log(`   CORS: ${proxyResponse.headers.get('access-control-allow-origin')}`);
    console.log(`   Proxy-By: ${proxyResponse.headers.get('x-proxy-by')}`);
    console.log(`   Original-URL: ${proxyResponse.headers.get('x-original-url')}`);
    console.log(`   Body length: ${proxyText.length} bytes`);
    
    // コンテンツの比較
    console.log('\n3. Content comparison:');
    if (directText === proxyText) {
      console.log('   ✅ Content is IDENTICAL!');
    } else {
      console.log('   ❌ Content is DIFFERENT!');
      console.log(`   Direct length: ${directText.length}`);
      console.log(`   Proxy length: ${proxyText.length}`);
      
      // 差分を見つける
      if (directText.includes('<title>Example Domain</title>') && 
          proxyText.includes('<title>Example Domain</title>')) {
        console.log('   Both contain the expected title tag');
      }
    }
    
    // HTMLの特定部分を確認
    console.log('\n4. HTML validation:');
    const expectedStrings = [
      '<title>Example Domain</title>',
      'Example Domain',
      'This domain is for use in illustrative examples',
      'More information...'
    ];
    
    let allFound = true;
    for (const expected of expectedStrings) {
      const found = proxyText.includes(expected);
      console.log(`   ${found ? '✅' : '❌'} Contains: "${expected}"`);
      if (!found) allFound = false;
    }
    
    console.log('\n=== Test Result ===');
    console.log(allFound ? '✅ Proxy is working correctly!' : '❌ Proxy has issues');
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// テストを実行
testProxy();